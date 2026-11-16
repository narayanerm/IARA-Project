(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var raiz = document.documentElement;

  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function ler(k, padrao) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var avisoT;
  function avisar(msg) {
    var a = $("#aviso"); a.textContent = msg; a.classList.add("ver");
    clearTimeout(avisoT); avisoT = setTimeout(function () { a.classList.remove("ver"); }, 3500);
  }

  /* ---------- dados pesados, carregados só quando precisa ---------- */
  var carregando = {};
  function dados(nome) {
    if (window.IARA_D && IARA_D[nome]) return Promise.resolve(IARA_D[nome]);
    if (!carregando[nome]) {
      carregando[nome] = new Promise(function (ok, erro) {
        var s = document.createElement("script"); s.src = "dados/" + nome + ".js";
        s.onload = function () { ok(IARA_D[nome]); }; s.onerror = erro; document.head.appendChild(s);
      });
    }
    return carregando[nome];
  }

  /* ---------- dados ao vivo: ANA e INPE, buscados toda vez que o app abre ---------- */
  var ANA = "https://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos";
  var INPE = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/focos_diario_br_";
  var AMAZONIA = [-19, -75, 6, -43]; /* sul, oeste, norte, leste: só guarda os focos desta caixa */
  var vivo = { rio: "carregando", fogo: "carregando", focos: [], dias: {}, quando: 0, rodada: 0 };
  var celulas = {};

  function dois(x) { return ("0" + x).slice(-2); }
  function dataBr(d) { return dois(d.getDate()) + "/" + dois(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function hora(t) { var d = new Date(t); return dois(d.getHours()) + ":" + dois(d.getMinutes()); }
  function diaHora(t) {
    var d = new Date(t), hoje = new Date();
    var dia = d.toDateString() === hoje.toDateString() ? "hoje" : d.toDateString() === new Date(Date.now() - 864e5).toDateString() ? "ontem" : "em " + dois(d.getDate()) + "/" + dois(d.getMonth() + 1);
    return dia + " às " + hora(t);
  }

  function baixar(url) {
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 45000);
    return fetch(url, { cache: "no-cache", signal: ctl ? ctl.signal : undefined }).then(function (r) {
      clearTimeout(t); if (!r.ok) throw new Error("HTTP " + r.status); return r.text();
    }, function (e) { clearTimeout(t); throw e; });
  }

  /* Rio: telemetria da ANA, uma leitura a cada 15 minutos. A hora vem no horário de Brasília. */
  function lerAna(xml) {
    var doc = new DOMParser().parseFromString(xml, "text/xml"), out = [];
    var regs = doc.getElementsByTagName("DadosHidrometereologicos");
    for (var i = 0; i < regs.length; i++) {
      var dh = regs[i].getElementsByTagName("DataHora")[0], nv = regs[i].getElementsByTagName("Nivel")[0];
      if (!dh || !nv || !nv.textContent.trim()) continue;
      var v = parseFloat(nv.textContent), t = Date.parse(dh.textContent.trim().replace(" ", "T") + "-03:00");
      if (isFinite(v) && isFinite(t)) out.push([t, v]);
    }
    return out.sort(function (a, b) { return a[0] - b[0]; });
  }
  /* mediana das leituras perto de uma hora, para um valor errado do sensor não aparecer como cota */
  function cotaPerto(L, alvo, folga) {
    var xs = L.filter(function (p) { return Math.abs(p[0] - alvo) <= folga; }).map(function (p) { return p[1]; }).sort(function (a, b) { return a - b; });
    return xs.length ? Math.round(xs[(xs.length - 1) >> 1]) : null;
  }
  function buscarRio(rodada) {
    var hoje = new Date(), ini = new Date(Date.now() - 5 * 864e5);
    return Promise.all(IARA.ESTACOES.map(function (e) {
      var url = ANA + "?codEstacao=" + e.cod + "&dataInicio=" + dataBr(ini) + "&dataFim=" + dataBr(hoje);
      return baixar(url).then(function (xml) {
        if (rodada !== vivo.rodada) return false;
        var L = lerAna(xml);
        var ult = L.length ? L[L.length - 1][0] : 0;
        if (!ult || Date.now() - ult > 3 * 864e5) { e.cm = null; return false; }
        e.cm = cotaPerto(L, ult, 36e5); e.hora = ult;
        e.ontem = cotaPerto(L, ult - 864e5, 2 * 36e5);
        e.d4 = cotaPerto(L, ult - 4 * 864e5, 3 * 36e5);
        return true;
      }).catch(function () { e.cm = null; return false; });
    })).then(function (ok) {
      if (rodada !== vivo.rodada) return;
      vivo.rio = ok.some(Boolean) ? "pronto" : "erro";
    });
  }

  /* Fogo: arquivo do dia do INPE, com os focos de todos os satélites. Vários satélites veem
     o mesmo fogo, então os focos são juntados em quadrados de cerca de 2 km. */
  function diaUtc(k) { return new Date(Date.now() - k * 864e5).toISOString().slice(0, 10).replace(/-/g, ""); }
  function lerFocos(txt) {
    var linhas = txt.split("\n"), cab = linhas[0].split(",").map(function (x) { return x.trim(); });
    var iLat = cab.indexOf("lat"), iLon = cab.indexOf("lon"), iT = cab.indexOf("data_hora_gmt"), iR = cab.indexOf("risco_fogo"), iS = cab.indexOf("numero_dias_sem_chuva");
    if (iLat < 0 || iLon < 0 || iT < 0) throw new Error("formato");
    var A = AMAZONIA;
    for (var i = 1; i < linhas.length; i++) {
      var c = linhas[i].split(","); if (c.length < cab.length) continue;
      var lat = +c[iLat], lon = +c[iLon];
      if (!(lat >= A[0] && lat <= A[2] && lon >= A[1] && lon <= A[3])) continue;
      var t = Date.parse(c[iT].trim().replace(" ", "T") + "Z"); if (!isFinite(t)) continue;
      var r = iR >= 0 ? parseFloat(c[iR]) : NaN, sc = iS >= 0 ? parseInt(c[iS], 10) : NaN;
      var k = Math.round(lat * 50) + ":" + Math.round(lon * 50), f = celulas[k];
      if (!f) { f = celulas[k] = { lat: lat, lon: lon, t: t, r: -1, s: -1 }; vivo.focos.push(f); }
      else if (t > f.t) f.t = t;
      if (r >= 0 && r <= 1 && r > f.r) f.r = r;
      if (sc >= 0 && sc < 999 && sc > f.s) f.s = sc;
    }
  }
  var pedidosFogo = {};
  function buscarFogo(ate, rodada) {
    var lista = [];
    for (var k = 0; k <= ate; k++) if (!vivo.dias[k]) lista.push(k);
    return Promise.all(lista.map(function (k) {
      if (!pedidosFogo[k]) {
        pedidosFogo[k] = baixar(INPE + diaUtc(k) + ".csv").then(function (txt) {
          if (rodada !== vivo.rodada) return false;
          lerFocos(txt); vivo.dias[k] = true; return true;
        }).catch(function () { return false; }).then(function (ok) { delete pedidosFogo[k]; return ok; });
      }
      return pedidosFogo[k];
    })).then(function () {
      if (rodada !== vivo.rodada) return;
      vivo.fogo = vivo.dias[0] || vivo.dias[1] ? "pronto" : "erro";
    });
  }

  function atualizar() {
    vivo.rodada++; var rodada = vivo.rodada;
    vivo.rio = vivo.fogo = "carregando"; vivo.focos = []; vivo.dias = {}; celulas = {}; pedidosFogo = {};
    IARA.ESTACOES.forEach(function (e) { e.cm = e.ontem = e.d4 = e.hora = null; });
    if (!navigator.onLine) { vivo.rio = vivo.fogo = "erro"; semInternet(true); return; }
    semInternet(false); rota(true);
    var pr = buscarRio(rodada).then(function () { if (rodada === vivo.rodada) rota(true); });
    var pf = buscarFogo(janelaFogo === 48 ? 2 : 1, rodada).then(function () { if (rodada === vivo.rodada) rota(true); });
    Promise.all([pr, pf]).then(function () {
      if (rodada !== vivo.rodada) return;
      vivo.quando = Date.now();
      if (vivo.rio === "erro" && vivo.fogo === "erro") semInternet(true); else rota(true);
    });
  }

  function semInternet(ver) {
    var t = $("#sem-net");
    if (!ver) { t.hidden = true; raiz.classList.remove("bloqueado"); return; }
    var off = !navigator.onLine;
    $("#sem-net-titulo").textContent = off ? "Sem internet" : "Não deu para atualizar";
    $("#sem-net-texto").textContent = off
      ? "O IARA precisa de internet para buscar o nível do rio na ANA e os focos de fogo no INPE. Ligue os dados móveis ou o Wi-Fi e tente de novo."
      : "A ANA e o INPE não responderam agora. Pode ser a internet fraca ou os sites fora do ar. Tente de novo em alguns minutos.";
    t.hidden = false; raiz.classList.add("bloqueado");
  }

  /* ---------- contas de mapa ---------- */
  function km(a, b, c, d) {
    var r = Math.PI / 180, dl = (c - a) * r, dn = (d - b) * r;
    var h = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dn / 2) * Math.sin(dn / 2);
    return 12742 * Math.asin(Math.sqrt(h));
  }
  function rumo(a, b, c, d) {
    var ang = Math.atan2((d - b) * Math.cos(a * Math.PI / 180), c - a) * 180 / Math.PI;
    var nomes = ["ao norte", "a nordeste", "a leste", "a sudeste", "ao sul", "a sudoeste", "a oeste", "a noroeste"];
    return nomes[Math.round(((ang + 360) % 360) / 45) % 8];
  }
  function dentro(lat, lon, anel) {
    var d = false;
    for (var i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      var xi = anel[i][0], yi = anel[i][1], xj = anel[j][0], yj = anel[j][1];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) d = !d;
    }
    return d;
  }
  function m(cm) { return (cm / 100).toFixed(2).replace(".", ","); }
  function n(x) { return x.toLocaleString("pt-BR"); }


  /* ---------- lugar ---------- */
  var lugar = ler("iara-lugar", null);

  function definirLugar(l) {
    lugar = l; guardar("iara-lugar", l);
    fecharFolha();
    var e = estacaoPerto();
    if (e) { estacaoSel = e.id; guardar("iara-estacao", e.id); }
    desenharTudo();
  }

  function pedirGps() {
    if (!navigator.geolocation) { avisar("Este celular não deixou usar a localização. Escolha na lista."); abrirFolha(); return; }
    avisar("Procurando sua localização");
    navigator.geolocation.getCurrentPosition(function (p) {
      var lat = p.coords.latitude, lon = p.coords.longitude;
      var perto = IARA.CIDADES.map(function (c) { return { c: c, d: km(lat, lon, c[2], c[3]) }; }).sort(function (a, b) { return a.d - b.d; })[0];
      var nome = perto.d < 15 ? perto.c[0] : "Perto de " + perto.c[0];
      definirLugar({ nome: nome, lat: lat, lon: lon, gps: true });
      avisar("Pronto. Localização guardada só neste celular.");
    }, function () {
      avisar("Não deu para pegar a localização. Escolha na lista.");
      abrirFolha();
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  }

  function abrirFolha() {
    $("#folha-lugar").hidden = false; raiz.classList.add("folha-aberta");
    $("#busca").value = ""; buscar("");
    dados("territorios");
  }
  function fecharFolha() { $("#folha-lugar").hidden = true; raiz.classList.remove("folha-aberta"); }

  function semAcento(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function buscar(q) {
    q = semAcento(q.trim());
    var lista = IARA.CIDADES.map(function (c) { return { nome: c[0], sub: "Cidade, " + c[1], lat: c[2], lon: c[3] }; });
    if (window.IARA_D && IARA_D.territorios && q.length >= 2) {
      IARA_D.territorios.forEach(function (t) {
        var b = t.b;
        lista.push({ nome: t.n, sub: t.t === "TI" ? "Terra indígena" + (t.e ? ", povo " + t.e : "") : "Unidade de conservação federal, ICMBio",
          lat: (b[0] + b[2]) / 2, lon: (b[1] + b[3]) / 2, terr: true });
      });
    }
    var achados = q ? lista.filter(function (x) { return semAcento(x.nome + " " + x.sub).indexOf(q) >= 0; }) : lista.slice(0, 12);
    var ul = $("#resultados");
    ul.innerHTML = achados.slice(0, 40).map(function (x, i) {
      return '<li><button type="button" data-i="' + i + '">' + esc(x.nome) + "<small>" + esc(x.sub) + "</small></button></li>";
    }).join("") || '<li class="nota" style="padding:12px 2px">Nada encontrado. Tente o nome da cidade mais perto.</li>';
    ul.onclick = function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      var x = achados[+b.dataset.i];
      definirLugar({ nome: x.nome, lat: x.lat, lon: x.lon, terr: !!x.terr });
    };
  }

  /* ---------- rio ---------- */
  var estacaoSel = ler("iara-estacao", null);
  function estacaoPerto() {
    if (!lugar) return null;
    return IARA.ESTACOES.map(function (e) { return { e: e, d: km(lugar.lat, lugar.lon, e.lat, e.lon) }; }).sort(function (a, b) { return a.d - b.d; })[0].e;
  }
  function estacao() { return IARA.ESTACOES.filter(function (e) { return e.id === estacaoSel; })[0] || estacaoPerto() || IARA.ESTACOES[0]; }

  function variacao(e) {
    var d = e.ontem == null ? null : e.cm - e.ontem, d4 = e.d4 == null ? null : e.cm - e.d4;
    var hoje = d == null ? "Sem medição de ontem para comparar" : d === 0 ? "Ficou igual desde ontem" : (d < 0 ? "Desceu " + (-d) + " cm desde ontem" : "Subiu " + d + " cm desde ontem");
    var quatro = d4 == null ? "" : d4 === 0 ? "Igual a quatro dias atrás." : (d4 < 0 ? "Há quatro dias estava " + (-d4) + " cm mais alto." : "Há quatro dias estava " + d4 + " cm mais baixo.");
    return { hoje: hoje, quatro: quatro, d: d };
  }
  function situacao(e) {
    if (e.cheia && e.cm >= e.cheia) return "Acima da cota de inundação (" + m(e.cheia) + " m).";
    if (e.cm < e.seca) return m(e.seca - e.cm) + " m abaixo da cota de seca (" + m(e.seca) + " m). A ANA chama isso de estiagem.";
    return m(e.cm - e.seca) + " m acima da cota de seca (" + m(e.seca) + " m)." + (e.cheia ? " A inundação começa em " + m(e.cheia) + " m." : "");
  }

  function desenharRegua(e) {
    var svg = $("#regua"), NS = "http://www.w3.org/2000/svg";
    var cs = getComputedStyle(raiz);
    var cor = function (v) { return cs.getPropertyValue(v).trim(); };
    var topo = Math.max(e.cheia || 0, e.cm, e.seca) + 150, base = Math.min(e.cm, e.seca) - 250;
    topo = Math.ceil(topo / 100) * 100; base = Math.floor(base / 100) * 100;
    var Y0 = 12, Y1 = 308, y = function (v) { return Y1 - (v - base) / (topo - base) * (Y1 - Y0); };
    var h = '<desc id="regua-desc">Régua do rio: ' + m(e.cm) + " metros hoje" + "</desc>";
    h += '<rect x="34" y="' + y(e.cm) + '" width="34" height="' + (Y1 - y(e.cm)) + '" fill="' + cor("--agua") + '"/>';
    h += '<rect x="34" y="' + Y0 + '" width="34" height="' + (Y1 - Y0) + '" fill="none" stroke="' + cor("--tinta") + '" stroke-width="1.5"/>';
    var passo = (topo - base) > 1500 ? 500 : 100;
    for (var v = base; v <= topo; v += 50) {
      var cheio = v % passo === 0;
      h += '<line x1="34" x2="' + (cheio ? 46 : 40) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="' + cor("--tinta") + '" stroke-width="1"/>';
      if (cheio) h += '<text x="28" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="' + cor("--apagado") + '">' + (v / 100) + "</text>";
    }
    var marca = function (v, txt, c) {
      h += '<line x1="30" x2="74" y1="' + y(v) + '" y2="' + y(v) + '" stroke="' + c + '" stroke-width="2.5" stroke-dasharray="5 3"/>';
      h += '<text x="78" y="' + (y(v) + 4) + '" font-size="11" font-weight="700" fill="' + c + '">' + txt + "</text>";
    };
    marca(e.seca, "seca", cor("--fogo"));
    if (e.cheia) marca(e.cheia, "cheia", cor("--risco-4"));
    h += '<text x="78" y="' + (y(e.cm) + 4) + '" font-size="12" font-weight="700" fill="' + cor("--agua") + '">hoje</text>';
    svg.innerHTML = h;
  }

  function desenharRio() {
    var e = estacao(), v = variacao(e);
    var sel = $("#rio-estacao");
    if (!sel.options.length) {
      sel.innerHTML = IARA.ESTACOES.map(function (x) { return '<option value="' + x.id + '">' + esc(x.nome + " (" + x.rio + ")") + "</option>"; }).join("");
      sel.onchange = function () { estacaoSel = sel.value; guardar("iara-estacao", estacaoSel); desenharRio(); };
    }
    sel.value = e.id;
    $("#rio-nome").textContent = e.rio + " em " + e.nome;
    var painel = $(".rio-painel");
    painel.classList.toggle("sem-dado", e.cm == null);
    if (e.cm == null) {
      $("#rio-cota").innerHTML = "&nbsp;";
      $("#rio-variacao").textContent = vivo.rio === "carregando" ? "Buscando a medição na ANA." : "Esta estação não mandou medição nos últimos dias. Escolha outra na lista abaixo.";
      $("#rio-situacao").innerHTML = vivo.rio === "erro" ? '<button class="link-texto" type="button" data-acao="atualizar">Tentar de novo</button>' : "";
      $("#rio-data").textContent = "";
      $("#regua").innerHTML = "";
    } else {
      $("#rio-cota").innerHTML = m(e.cm) + "<small>m</small>";
      $("#rio-variacao").textContent = v.hoje + ". " + v.quatro;
      $("#rio-situacao").textContent = situacao(e);
      $("#rio-data").textContent = "Medição automática da ANA, " + diaHora(e.hora) + ".";
      desenharRegua(e);
    }

    var lista = IARA.ESTACOES.slice();
    if (lugar) lista.sort(function (a, b) { return km(lugar.lat, lugar.lon, a.lat, a.lon) - km(lugar.lat, lugar.lon, b.lat, b.lon); });
    $("#lista-estacoes").innerHTML = lista.map(function (x) {
      var d = x.cm == null || x.ontem == null ? 0 : x.cm - x.ontem, seta = d < 0 ? "arrow-down" : (d > 0 ? "arrow-up" : "minus");
      var dist = lugar ? ", a " + n(Math.round(km(lugar.lat, lugar.lon, x.lat, x.lon))) + " km" : "";
      return '<li><button type="button" data-id="' + x.id + '"' + (x.id === e.id ? ' aria-current="true"' : "") + "><span>" + esc(x.nome) +
        "<small>" + esc(x.rio) + dist + '</small></span><span class="n">' + (x.cm == null ? (vivo.rio === "carregando" ? "..." : "sem dado") : m(x.cm) + " m") + '</span><i class="ph ph-' + seta + '" aria-label="' + (x.cm == null ? "sem medição" : d < 0 ? "descendo" : d > 0 ? "subindo" : "estável") + '"></i></button></li>';
    }).join("");
  }

  /* ---------- fogo ---------- */
  var janelaFogo = ler("iara-janela", 24), raioFogo = ler("iara-raio", 30);
  if (janelaFogo !== 24 && janelaFogo !== 48) janelaFogo = 24;

  function focosPerto(janela, raio) {
    var g = raio / 111 + 0.1, desde = Date.now() - janela * 36e5, out = [], F = vivo.focos;
    for (var i = 0; i < F.length; i++) {
      var f = F[i];
      if (f.t < desde || Math.abs(f.lat - lugar.lat) > g || Math.abs(f.lon - lugar.lon) > g) continue;
      var d = km(lugar.lat, lugar.lon, f.lat, f.lon);
      if (d <= raio) out.push({ lat: f.lat, lon: f.lon, t: f.t, r: f.r, s: f.s, d: d });
    }
    return out.sort(function (a, b) { return a.d - b.d; });
  }
  function fogoPronto(janela) { return vivo.fogo === "pronto" && (janela !== 48 || vivo.dias[2]); }
  function fraseFocos(n_, raio, janela) {
    return (n_ === 0 ? "Nenhum foco de calor" : n(n_) + (n_ === 1 ? " foco de calor" : " focos de calor")) + " a até " + raio + " km nas últimas " + janela + " horas.";
  }

  function desenharRadar(lista, raio) {
    var cv = $("#radar"), ctx = cv.getContext("2d"), W = cv.width, c = W / 2, R = W / 2 - 34;
    var cs = getComputedStyle(raiz), cor = function (v) { return cs.getPropertyValue(v).trim(); };
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = cor("--superficie"); ctx.beginPath(); ctx.arc(c, c, R, 0, 7); ctx.fill();
    ctx.strokeStyle = cor("--linha"); ctx.lineWidth = 2;
    var aneis = { 10: [5, 10], 30: [10, 20, 30], 50: [10, 25, 50] }[raio] || [raio];
    aneis.forEach(function (a) { ctx.beginPath(); ctx.arc(c, c, R * a / raio, 0, 7); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(c - R, c); ctx.lineTo(c + R, c); ctx.moveTo(c, c - R); ctx.lineTo(c, c + R); ctx.stroke();
    ctx.fillStyle = cor("--apagado"); ctx.font = "600 24px Geist, Arial, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("N", c, 24);
    ctx.font = "20px Geist, Arial, sans-serif"; ctx.textAlign = "left";
    aneis.forEach(function (a) { ctx.fillText(a + " km", c + 6, c - R * a / raio + 22); });
    var escala = R / raio, kx = 111 * Math.cos(lugar.lat * Math.PI / 180);
    ctx.fillStyle = cor("--fogo");
    lista.forEach(function (f) {
      var x = c + (f.lon - lugar.lon) * kx * escala, y = c - (f.lat - lugar.lat) * 111 * escala;
      var s = 14;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    });
    ctx.fillStyle = cor("--tinta"); ctx.beginPath(); ctx.arc(c, c, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = cor("--superficie"); ctx.lineWidth = 3; ctx.stroke();
  }

  function segmento(el, opcoes, atual, aoEscolher) {
    el.innerHTML = opcoes.map(function (o) {
      return '<button type="button" role="radio" aria-checked="' + (o[0] === atual) + '" data-v="' + o[0] + '">' + esc(o[1]) + "</button>";
    }).join("");
    el.onclick = function (ev) { var b = ev.target.closest("button"); if (b) aoEscolher(+b.dataset.v); };
  }

  function desenharFogo() {
    segmento($("#fogo-janela"), [[24, "24 horas"], [48, "48 horas"]], janelaFogo, function (v) { janelaFogo = v; guardar("iara-janela", v); desenharFogo(); });
    segmento($("#fogo-raio"), [[10, "10 km"], [30, "30 km"], [50, "50 km"]], raioFogo, function (v) { raioFogo = v; guardar("iara-raio", v); desenharFogo(); });
    $("#fogo").classList.toggle("sem-lugar-fogo", !lugar);
    if (!lugar) {
      $("#fogo-resumo").textContent = "Para ver o fogo perto de você, diga onde está.";
      $("#fogo-perto").innerHTML = '<button class="btn btn-cheio" type="button" data-acao="gps"><i class="ph ph-crosshair"></i>Usar minha localização</button>';
      $("#fogo-risco").innerHTML = '<button class="link-texto" type="button" data-acao="escolher">Escolher cidade ou reserva</button>';
      $("#fogo-nota").textContent = "";
      return;
    }
    if (vivo.fogo === "pronto" && janelaFogo === 48 && !vivo.dias[2]) {
      var rodada = vivo.rodada;
      buscarFogo(2, rodada).then(function () { if (rodada === vivo.rodada && document.body.dataset.tela === "fogo") desenharFogo(); });
    }
    if (!fogoPronto(janelaFogo)) {
      $("#fogo-resumo").textContent = vivo.fogo === "erro" ? "Não deu para buscar os focos no INPE agora." : "Buscando os focos de calor no INPE.";
      $("#fogo-perto").innerHTML = vivo.fogo === "erro" ? '<button class="link-texto" type="button" data-acao="atualizar">Tentar de novo</button>' : "";
      $("#fogo-risco").textContent = ""; $("#fogo-nota").textContent = "";
      desenharRadar([], raioFogo);
      return;
    }
    var lista = focosPerto(janelaFogo, raioFogo);
    $("#fogo-resumo").textContent = fraseFocos(lista.length, raioFogo, janelaFogo);
    var p = lista[0];
    $("#fogo-perto").textContent = p ? "O mais perto fica a " + Math.max(1, Math.round(p.d)) + " km, " + rumo(lugar.lat, lugar.lon, p.lat, p.lon) + ", visto " + diaHora(p.t) + "." : "";
    $("#fogo-risco").textContent = "";
    $("#fogo-nota").textContent = "Focos de todos os satélites que o INPE usa, juntados em quadrados de 2 km para não contar o mesmo fogo duas vezes. Um foco é um ponto quente visto do espaço: pode ser roça, mata ou pasto. Dados buscados no INPE às " + hora(vivo.quando || Date.now()) + ".";
    desenharRadar(lista, raioFogo);
  }

  /* ---------- início ---------- */
  function desenharInicio() {
    var tem = !!lugar;
    $("#lugar-vazio").hidden = tem; $("#lugar-cheio").hidden = !tem;
    $("#inicio-datas").textContent = vivo.rio === "carregando" || vivo.fogo === "carregando" ? "Atualizando os dados da ANA e do INPE."
      : "Atualizado às " + hora(vivo.quando || Date.now()) + ". Rio: medição automática da ANA. Fogo: focos de calor do INPE.";
    if (!tem) return;
    $("#lugar-nome").textContent = lugar.nome;
    var e = estacao();
    var dist = Math.round(km(lugar.lat, lugar.lon, e.lat, e.lon));
    var cabRio = '<i class="ph ph-waves"></i><span><small>' + esc(e.rio + " em " + e.nome) + (dist > 40 ? ", a " + n(dist) + " km" : "") + "</small>";
    if (e.cm == null) {
      $("#resumo-rio").innerHTML = cabRio + "<b>" + (vivo.rio === "carregando" ? "Atualizando" : "Sem medição agora") + "</b><small>" + (vivo.rio === "carregando" ? "Buscando na ANA." : "Toque para ver outras estações.") + '</small></span><i class="ph ph-caret-right"></i>';
    } else {
      var v = variacao(e);
      $("#resumo-rio").innerHTML = cabRio + "<b>" + m(e.cm) + " m</b><small>" + v.hoje + "." + (e.cm < e.seca ? " Abaixo da cota de seca." : "") + '</small></span><i class="ph ph-caret-right"></i>';
    }
    var bf = $("#resumo-fogo"), cab = '<i class="ph ph-fire"></i><span><small>Fogo a até 30 km, nas últimas 24 horas</small>';
    if (vivo.fogo !== "pronto") {
      bf.innerHTML = cab + "<b>" + (vivo.fogo === "carregando" ? "Atualizando" : "Sem dados agora") + "</b><small>" + (vivo.fogo === "carregando" ? "Buscando no INPE." : "O INPE não respondeu.") + '</small></span><i class="ph ph-caret-right"></i>';
    } else {
      var lista = focosPerto(24, 30), p = lista[0];
      bf.innerHTML = cab + "<b>" + (lista.length === 0 ? "Nenhum foco de calor" : n(lista.length) + (lista.length === 1 ? " foco de calor" : " focos de calor")) + "</b><small>" +
        (p ? "O mais perto fica a " + Math.max(1, Math.round(p.d)) + " km, " + rumo(lugar.lat, lugar.lon, p.lat, p.lon) + "." : "Nada visto pelos satélites.") +
        '</small></span><i class="ph ph-caret-right"></i>';
    }
    ocultarIcones();
    dados("territorios").then(function (T) {
      var achado = null;
      for (var i = 0; i < T.length && !achado; i++) {
        var t = T[i], b = t.b;
        if (lugar.lat < b[0] || lugar.lat > b[2] || lugar.lon < b[1] || lugar.lon > b[3]) continue;
        for (var k = 0; k < t.p.length; k++) if (dentro(lugar.lat, lugar.lon, t.p[k])) { achado = t; break; }
      }
      var el = $("#resumo-terr");
      if (!achado) { el.hidden = true; return; }
      var nome = (achado.t === "TI" && achado.n.indexOf("Terra") !== 0 ? "Terra indígena " : "") + achado.n;
      var txt = "Este lugar fica na <strong>" + esc(nome) + "</strong>" + (achado.e ? ", do povo " + esc(achado.e) : "") + ".";
      if (vivo.fogo === "pronto") {
        var desde = Date.now() - 24 * 36e5, b2 = achado.b, nf = 0;
        vivo.focos.forEach(function (f) {
          if (f.t < desde || f.lat < b2[0] || f.lat > b2[2] || f.lon < b2[1] || f.lon > b2[3]) return;
          for (var k = 0; k < achado.p.length; k++) if (dentro(f.lat, f.lon, achado.p[k])) { nf++; break; }
        });
        txt += " " + (nf ? n(nf) + (nf === 1 ? " foco de calor" : " focos de calor") : "Nenhum foco de calor") + " dentro do território nas últimas 24 horas.";
      }
      el.innerHTML = txt; el.hidden = false;
    });
  }

  /* ---------- denunciar ---------- */
  var sitAtual = null;
  function telefone(num) { return IARA.TELEFONES.filter(function (t) { return t.num === num; })[0]; }

  function desenharDenunciar(sub) {
    $("#situacoes").innerHTML = IARA.SITUACOES.map(function (s) {
      return '<li><button type="button" data-id="' + s.id + '"><i class="ph ph-' + s.icone + '"></i><span><strong>' + esc(s.titulo) + "</strong><small>" + esc(s.resumo) + '</small></span></button></li>';
    }).join("");
    $("#telefones").innerHTML = IARA.TELEFONES.map(function (t) {
      return '<li><a href="tel:' + t.num + '"><span class="num">' + esc(t.rot || t.num) + "</span><span><strong>" + esc(t.nome) + "</strong><small>" + esc(t.quando) + "</small></span></a></li>";
    }).join("") + '<li><a href="sms:40199"><span class="num">SMS 40199</span><span><strong>Alerta de cheia da Defesa Civil</strong><small>Mande o CEP da comunidade e receba avisos de cheia e de chuva forte. É de graça.</small></span></a></li>';
    desenharNotas();
    var s = IARA.SITUACOES.filter(function (x) { return x.id === sub; })[0];
    $("#den-lista").hidden = !!s; $("#den-detalhe").hidden = !s;
    if (sub === "telefones") rolarAte = "#telefones-titulo";
    if (!s) return;
    sitAtual = s;
    $("#den-titulo").textContent = s.titulo;
    $("#den-passos").innerHTML = s.passos.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("");
    $("#den-canais").innerHTML = s.canais.map(function (c) {
      if (c.indexOf("tel:") === 0) {
        var t = telefone(c.slice(4));
        return '<a class="canal canal-tel" href="' + c + '"><span><strong>Ligar ' + esc(t.rot || t.num) + "</strong><small>" + esc(t.nome) + '</small></span><i class="ph ph-phone-call"></i></a>';
      }
      var k = IARA.CANAIS[c];
      var extra = k.email ? '<a class="canal" href="mailto:' + k.email + '"><span><strong>Mandar e-mail ao Ibama</strong><small>' + esc(k.email) + '</small></span><i class="ph ph-envelope"></i></a>' : "";
      return '<a class="canal" href="' + k.url + '" target="_blank" rel="noopener"><span><strong>' + esc(k.nome) + "</strong><small>" + esc(k.desc) + '</small></span><i class="ph ph-arrow-square-out"></i></a>' + extra;
    }).join("");
    var f = $("#anotar"); f.reset();
    $("#n-onde").value = lugar ? lugar.nome + (lugar.gps ? " (" + lugar.lat.toFixed(4) + ", " + lugar.lon.toFixed(4) + ")" : "") : "";
    var agora = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    $("#n-quando").value = agora.toISOString().slice(0, 16);
    $("#n-aviso").textContent = "";
  }

  function textoNota(x) {
    var q = x.quando ? new Date(x.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
    return "Denúncia: " + x.tipo + "\nO que vi: " + x.oque + (x.onde ? "\nOnde: " + x.onde : "") + (q ? "\nQuando: " + q : "") + (x.quem ? "\nIdentificação: " + x.quem : "");
  }
  function notaDoForm() {
    return { tipo: sitAtual ? sitAtual.titulo : "", oque: $("#n-oque").value.trim(), onde: $("#n-onde").value.trim(), quando: $("#n-quando").value, quem: $("#n-quem").value.trim(), em: Date.now() };
  }
  function mandar(texto) {
    if (navigator.share) { navigator.share({ text: texto }).catch(function () {}); return; }
    if (navigator.clipboard) { navigator.clipboard.writeText(texto).then(function () { avisar("Texto copiado. Cole no WhatsApp, no e-mail ou no formulário."); }); return; }
    window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank");
  }
  function desenharNotas() {
    var notas = ler("iara-notas", []);
    var ul = $("#notas-lista");
    if (!notas.length) { ul.innerHTML = '<li class="vazio">Nenhuma anotação ainda. Escolha uma situação acima para anotar.</li>'; return; }
    ul.innerHTML = notas.map(function (x, i) {
      var d = new Date(x.em).toLocaleDateString("pt-BR");
      return '<li><button type="button" data-i="' + i + '"><span class="txt">' + esc(x.tipo) + "<small>" + d + ", " + esc(x.oque.slice(0, 60)) + '</small></span><i class="ph ph-share-network"></i></button></li>';
    }).join("");
    ul.onclick = function (ev) { var b = ev.target.closest("button"); if (b) mandar(textoNota(notas[+b.dataset.i])); };
  }

  $("#anotar").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var x = notaDoForm(); if (!x.oque) return;
    var notas = ler("iara-notas", []); notas.unshift(x); guardar("iara-notas", notas.slice(0, 30));
    $("#n-aviso").textContent = "Guardado em Minhas anotações, na tela Denunciar.";
  });
  $("#n-enviar").addEventListener("click", function () {
    var x = notaDoForm();
    if (!x.oque) { $("#n-oque").focus(); $("#n-aviso").textContent = "Escreva primeiro o que você viu."; return; }
    mandar(textoNota(x));
  });

  /* ---------- mapa de satélite ---------- */
  var mapa = null, camadaFundo = null, camadaDados = null, terrMapa = null, fundoMapa = ler("iara-fundo", "esri");
  var GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{camada}/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.{ext}";
  var FUNDOS = [["esri", "Satélite"], ["nasa", "NASA, ontem"], ["calor", "Calor, NASA"]];

  function ontem() { var d = new Date(Date.now() - 864e5); return d.toISOString().slice(0, 10); }
  function carregarLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise(function (ok, erro) {
      var css = document.createElement("link"); css.rel = "stylesheet"; css.href = "vendor/leaflet/leaflet.css"; document.head.appendChild(css);
      var s = document.createElement("script"); s.src = "vendor/leaflet/leaflet.js"; s.onload = ok; s.onerror = erro; document.head.appendChild(s);
    });
  }
  function fundoDe(id) {
    var esri = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 17, attribution: "Imagem: Esri, Maxar, Earthstar Geographics" });
    if (id === "esri") return esri;
    var nasa = L.tileLayer(GIBS, { camada: "VIIRS_SNPP_CorrectedReflectance_TrueColor", time: ontem(), ext: "jpg", maxNativeZoom: 9, maxZoom: 13, attribution: "NASA GIBS, VIIRS" });
    if (id === "nasa") return nasa;
    var calor = L.tileLayer(GIBS, { camada: "VIIRS_SNPP_Thermal_Anomalies_375m_All", time: ontem(), ext: "png", maxNativeZoom: 9, maxZoom: 17, attribution: "NASA FIRMS, VIIRS" });
    return L.layerGroup([esri, calor]);
  }
  function trocarFundo() {
    if (camadaFundo) mapa.removeLayer(camadaFundo);
    camadaFundo = fundoDe(fundoMapa).addTo(mapa);
    $("#mapa-data").textContent = fundoMapa === "esri" ? "Imagem de satélite de alta resolução. A data varia de lugar para lugar."
      : fundoMapa === "nasa" ? "Imagem do satélite Suomi NPP, da NASA, de " + ontem().split("-").reverse().join("/") + ". Mostra nuvens e fumaça do dia."
      : "Pontos vermelhos: fogo ativo visto pelo satélite da NASA em " + ontem().split("-").reverse().join("/") + ". Quadrados laranja: focos do INPE nas últimas " + janelaFogo + " horas.";
  }
  function desenharMapa() {
    segmento($("#mapa-fundo"), FUNDOS.map(function (f, i) { return [i, f[1]]; }), FUNDOS.map(function (f) { return f[0]; }).indexOf(fundoMapa), function (v) {
      fundoMapa = FUNDOS[v][0]; guardar("iara-fundo", fundoMapa); desenharMapa();
    });
    var sem = $("#mapa-sem");
    if (!navigator.onLine) { sem.textContent = "Sem internet agora. O mapa aparece quando o celular conectar."; sem.hidden = false; return; }
    if (mapa && terrMapa && redesenho) { desenharCamadas(); return; }
    sem.hidden = true;
    carregarLeaflet().then(function () {
      var centro = lugar ? [lugar.lat, lugar.lon] : [-3.4, -60.5];
      if (!mapa) {
        mapa = L.map("mapa-leaflet", { zoomControl: true, attributionControl: true }).setView(centro, lugar ? 10 : 6);
        mapa.attributionControl.setPrefix(false);
      } else { mapa.invalidateSize(); mapa.setView(centro, mapa.getZoom()); }
      trocarFundo();
      return dados("territorios");
    }).then(function (T) { terrMapa = T; desenharCamadas(); })
      .catch(function () { sem.textContent = "Não deu para abrir o mapa. Confira a internet e tente de novo."; sem.hidden = false; });
  }
  function desenharCamadas() {
      var T = terrMapa;
      if (camadaDados) mapa.removeLayer(camadaDados);
      camadaDados = L.layerGroup().addTo(mapa);
      var c = mapa.getCenter(), g = 1.2;
      T.forEach(function (t) {
        var b = t.b;
        if (b[2] < c.lat - g * 2 || b[0] > c.lat + g * 2 || b[3] < c.lng - g * 2 || b[1] > c.lng + g * 2) return;
        L.polygon(t.p.map(function (anel) { return anel.map(function (p) { return [p[1], p[0]]; }); }), { color: "#8fd6a6", weight: 2, fillOpacity: 0.08, interactive: false }).addTo(camadaDados);
      });
      var desde = Date.now() - janelaFogo * 36e5;
      vivo.focos.forEach(function (f) {
        if (f.t < desde || Math.abs(f.lat - c.lat) > g || Math.abs(f.lon - c.lng) > g) return;
        var s = 0.009;
        L.rectangle([[f.lat - s, f.lon - s], [f.lat + s, f.lon + s]], { color: "#5a1e08", weight: 1, fillColor: "#f07a45", fillOpacity: 0.9 })
          .bindTooltip("Foco de calor visto " + diaHora(f.t)).addTo(camadaDados);
      });
      IARA.ESTACOES.forEach(function (e) {
        L.circleMarker([e.lat, e.lon], { radius: 7, color: "#fff", weight: 2, fillColor: "#5aa7c9", fillOpacity: 1 })
          .bindTooltip(e.nome + ": " + (e.cm == null ? "sem medição agora" : m(e.cm) + " m"), { className: "mapa-rotulo" }).addTo(camadaDados);
      });
      if (lugar) {
        L.circleMarker([lugar.lat, lugar.lon], { radius: 8, color: "#102019", weight: 4, fillColor: "#fff", fillOpacity: 1 })
          .bindTooltip(lugar.nome, { permanent: true, direction: "right", offset: [10, 0], className: "mapa-rotulo" }).addTo(camadaDados);
      }
  }

  /* ---------- mais ---------- */
  function linkLinha(it) {
    return '<li><a href="' + it.url + '" target="_blank" rel="noopener"><span class="txt">' + esc(it.nome) + "<small>" + esc(it.desc) + '</small></span><i class="ph ph-arrow-square-out"></i></a></li>';
  }
  function guiasDe(ids) {
    return ids.map(function (id) {
      var g = IARA.GUIAS.filter(function (x) { return x.id === id; })[0];
      return '<li><a href="#mais/' + g.id + '"><span class="txt">' + esc(g.titulo) + '</span><i class="ph ph-caret-right"></i></a></li>';
    }).join("");
  }
  function desenharMais(sub) {
    $("#guias").innerHTML = guiasDe(IARA.GUIAS.map(function (g) { return g.id; }));
    $("#links-mais").innerHTML = IARA.APRENDER.map(function (g) {
      return '<h2 class="secao" id="sec-' + g.id + '">' + esc(g.grupo) + '</h2><ul class="linhas">' + g.itens.map(linkLinha).join("") + "</ul>";
    }).join("");
    var g = IARA.GUIAS.filter(function (x) { return x.id === sub; })[0];
    $("#mais-lista").hidden = !!g; $("#guia").hidden = !g;
    if (sub && !g) rolarAte = "#sec-" + sub;
    if (!g) return;
    $("#guia-titulo").textContent = g.titulo;
    $("#guia-corpo").innerHTML = g.blocos.map(function (b) {
      return "<h3>" + esc(b[0]) + "</h3><ul>" + b[1].map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>";
    }).join("");
  }

  $("#rio-guias").innerHTML = guiasDe(["cheia", "seca"]);
  $("#fogo-guias").innerHTML = guiasDe(["fogo", "fumaca"]);
  $("#rio-fontes").innerHTML = IARA.FONTES.slice(0, 3).map(linkLinha).join("");
  $("#fogo-fontes").innerHTML = IARA.FONTES.slice(3).map(linkLinha).join("") + linkLinha({ nome: "Denúncia ambiental ao Ibama", url: IARA.CANAIS["ibama-online"].url, desc: "Queimada ou desmatamento ilegal." });

  /* ---------- telas ---------- */
  var TELAS = ["inicio", "rio", "fogo", "mapa", "denunciar", "mais"];
  var rolarAte = null, redesenho = false;
  function desenharTudo() { rota(); }
  function ocultarIcones() { $$("i.ph:not([aria-label])").forEach(function (i) { i.setAttribute("aria-hidden", "true"); }); }

  function rota(semRolar) {
    redesenho = semRolar === true;
    var partes = (location.hash || "#inicio").slice(1).split("/");
    var tela = TELAS.indexOf(partes[0]) >= 0 ? partes[0] : "inicio", sub = partes[1];
    TELAS.forEach(function (t) { $("#" + t).hidden = t !== tela; });
    document.body.dataset.tela = tela;
    var titulo = $("#topo-titulo");
    titulo.textContent = tela === "inicio" ? "IARA" : (tela === "mais" && sub && IARA.GUIAS.some(function (g) { return g.id === sub; }) ? "Guia" : $("#" + tela).dataset.titulo);
    titulo.classList.toggle("so-leitor", tela === "inicio");
    var detalhe = sub && sub !== "telefones" && !/^(guias|cursos|funai|beneficios)$/.test(sub);
    $(".voltar-topo").setAttribute("href", detalhe ? "#" + tela : "#inicio");
    $(".voltar-topo").setAttribute("aria-label", detalhe ? "Voltar" : "Voltar ao início");
    $$(".abas a").forEach(function (a) { if (a.dataset.aba === tela) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    rolarAte = null;
    if (tela === "inicio") desenharInicio();
    if (tela === "rio") desenharRio();
    if (tela === "fogo") desenharFogo();
    if (tela === "mapa") desenharMapa();
    if (tela === "denunciar") desenharDenunciar(sub);
    if (tela === "mais") desenharMais(sub);
    ocultarIcones();
    var alvo = rolarAte && $(rolarAte);
    if (!redesenho) { if (alvo) window.scrollTo(0, alvo.getBoundingClientRect().top + window.scrollY - 90); else window.scrollTo(0, 0); }
    redesenho = false;
  }
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("hashchange", function () { rota(); });

  /* ---------- eventos ---------- */
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest("[data-acao]");
    if (a && a.dataset.acao === "gps") pedirGps();
    if (a && a.dataset.acao === "escolher") abrirFolha();
    if (a && a.dataset.acao === "atualizar") atualizar();
    if (a && a.dataset.acao === "tour") abrirTour();
    var sit = ev.target.closest("#situacoes button"); if (sit) location.hash = "denunciar/" + sit.dataset.id;
    var est = ev.target.closest("#lista-estacoes button");
    if (est) { estacaoSel = est.dataset.id; guardar("iara-estacao", estacaoSel); desenharRio(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  });
  $("#folha-fechar").addEventListener("click", fecharFolha);
  $("#folha-fundo").addEventListener("click", fecharFolha);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") fecharFolha(); });
  $("#busca").addEventListener("input", function () { dados("territorios").then(function () { buscar($("#busca").value); }); buscar($("#busca").value); });
  document.addEventListener("click", function (ev) { if (ev.target.closest('a[href^="sms:40199"]')) avisar("Escreva só o CEP da sua comunidade e envie para 40199."); });

  $("#btn-tema").addEventListener("click", function () {
    var escuro = raiz.dataset.theme ? raiz.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    raiz.dataset.theme = escuro ? "light" : "dark";
    try { localStorage.setItem("iara-tema", raiz.dataset.theme); } catch (e) {}
    rota(true);
  });
  $("#btn-letra").addEventListener("click", function () {
    var g = raiz.dataset.letra === "grande";
    if (g) delete raiz.dataset.letra; else raiz.dataset.letra = "grande";
    $("#letra-txt").textContent = g ? "Letra maior" : "Letra normal";
    try { localStorage.setItem("iara-letra", g ? "" : "grande"); } catch (e) {}
  });
  if (raiz.dataset.letra === "grande") $("#letra-txt").textContent = "Letra normal";

  var pedidoInstalar = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); pedidoInstalar = e; $("#li-instalar").hidden = false; });
  $("#btn-instalar").addEventListener("click", function () { if (pedidoInstalar) { pedidoInstalar.prompt(); pedidoInstalar = null; $("#li-instalar").hidden = true; } });

  /* ---------- só com internet ---------- */
  window.addEventListener("offline", function () { semInternet(true); });
  window.addEventListener("online", function () { atualizar(); });
  /* volta para o app depois de um tempo: busca de novo */
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && vivo.quando && Date.now() - vivo.quando > 15 * 60000) atualizar();
  });

  /* ---------- tour da primeira vez ---------- */
  var PASSOS = [
    { tela: "inicio", icone: "hand-waving", titulo: "Para que serve o IARA",
      texto: "O IARA mostra como está o rio e se tem fogo perto da sua comunidade, e diz onde denunciar e pedir ajuda. Os números vêm da ANA e do INPE e são buscados toda vez que você abre o app. Por isso ele precisa de internet." },
    { tela: "inicio", aba: "inicio", icone: "house", titulo: "Início",
      texto: "O resumo do seu lugar: a altura do rio na estação mais perto e quantos focos de fogo há a até 30 km. Os quadrados de Serviços levam para cada parte do app." },
    { tela: "rio", aba: "rio", icone: "waves", titulo: "Rio",
      texto: "A altura do rio medida pela ANA a cada 15 minutos, se subiu ou desceu desde ontem e quanto falta para a marca de seca ou de cheia. Dá para trocar de estação." },
    { tela: "fogo", aba: "fogo", icone: "fire", titulo: "Fogo",
      texto: "Os focos de calor vistos por satélite nas últimas 24 ou 48 horas, a até 10, 30 ou 50 km de você, e a que distância fica o mais perto." },
    { tela: "mapa", icone: "globe-hemisphere-west", titulo: "Mapa de satélite",
      texto: "A imagem de satélite do seu lugar, com os focos de fogo, as terras indígenas e as estações do rio. Abre pelo quadrado Mapa de satélite, no Início." },
    { tela: "denunciar", aba: "denunciar", icone: "megaphone", titulo: "Denunciar",
      texto: "Escolha o que está acontecendo, como garimpo, pesca ilegal ou invasão de terra, e veja os passos e os canais oficiais: Ibama, MPF, Funai e Disque 100. Dá para anotar tudo antes." },
    { tela: "mais", aba: "mais", icone: "list", titulo: "Mais",
      texto: "Guias de cheia, seca, fogo e fumaça, cursos gratuitos, serviços da Funai e benefícios como o seguro-defeso. Aqui também muda o tema, aumenta a letra e abre este tour de novo." },
    { tela: "inicio", icone: "map-pin", titulo: "Onde você está?",
      texto: "Com o seu lugar, o app mostra o rio e o fogo perto de você. A localização fica guardada só neste celular." }
  ];
  var passo = 0;
  function abrirTour() {
    fecharFolha(); passo = 0;
    $("#tour").hidden = false; raiz.classList.add("em-tour");
    $("#tour-pontos").innerHTML = PASSOS.map(function () { return "<span></span>"; }).join("");
    mostrarPasso();
  }
  function mostrarPasso() {
    var p = PASSOS[passo], ultimo = passo === PASSOS.length - 1;
    if ((location.hash || "#inicio").slice(1) !== p.tela) location.hash = p.tela;
    $$(".abas a").forEach(function (a) { a.classList.toggle("tour-alvo", a.dataset.aba === p.aba); });
    $("#tour-icone").className = "ph ph-" + p.icone;
    $("#tour-conta").textContent = (passo + 1) + " de " + PASSOS.length;
    $("#tour-titulo").textContent = p.titulo;
    $("#tour-texto").textContent = p.texto;
    $$("#tour-pontos span").forEach(function (sp, i) { sp.className = i === passo ? "atual" : ""; });
    $("#tour-seguir").innerHTML = ultimo ? (lugar ? "Começar" : '<i class="ph ph-map-pin" aria-hidden="true"></i>Escolher lugar') : "Próximo";
    $("#tour-voltar").hidden = passo === 0;
    $("#tour-pular").hidden = ultimo;
    $("#tour-seguir").focus();
  }
  function fecharTour(escolher) {
    $("#tour").hidden = true; raiz.classList.remove("em-tour");
    $$(".abas a").forEach(function (a) { a.classList.remove("tour-alvo"); });
    guardar("iara-tour", 1);
    if (location.hash !== "#inicio") location.hash = "inicio";
    if (escolher && !lugar) abrirFolha();
  }
  $("#tour-seguir").addEventListener("click", function () { if (passo === PASSOS.length - 1) fecharTour(true); else { passo++; mostrarPasso(); } });
  $("#tour-voltar").addEventListener("click", function () { if (passo > 0) { passo--; mostrarPasso(); } });
  $("#tour-pular").addEventListener("click", function () { fecharTour(false); });
  document.addEventListener("keydown", function (e) {
    if ($("#tour").hidden) return;
    if (e.key === "Escape") fecharTour(false);
    if (e.key === "ArrowRight") $("#tour-seguir").click();
    if (e.key === "ArrowLeft" && !$("#tour-voltar").hidden) $("#tour-voltar").click();
  });

  rota();
  atualizar();
  /* o navegador rola até a seção do #endereço depois de carregar; volta para o topo */
  window.addEventListener("load", function () { setTimeout(function () { window.scrollTo(0, 0); }, 0); });
  if (!ler("iara-tour", 0)) abrirTour();

  /* O app antigo guardava tudo para usar sem internet. Agora não guarda mais: tira o que ficou. */
  if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistrations) {
    navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); }).catch(function () {});
    if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); }).catch(function () {});
  }
})();
