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

  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var MESES_DADOS = [6, 7, 8, 9, 10, 11];
  var ULTIMO_DIA = { 11: "até o dia 13" };
  var RISCO_NOME = ["baixo", "moderado", "alto", "muito alto"];

  /* ---------- lugar ---------- */
  var lugar = ler("iara-lugar", null);

  function definirLugar(l) {
    lugar = l; guardar("iara-lugar", l);
    fecharFolha();
    var e = estacaoPerto();
    if (e) { estacaoSel = e.id; }
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
    var d = e.cm - e.ontem, d4 = e.cm - e.d4;
    var hoje = d === 0 ? "Ficou igual desde ontem" : (d < 0 ? "Desceu " + (-d) + " cm desde ontem" : "Subiu " + d + " cm desde ontem");
    var quatro = d4 === 0 ? "igual a 9/11" : (d4 < 0 ? (-d4) + " cm abaixo de 9/11" : d4 + " cm acima de 9/11");
    return { hoje: hoje, quatro: quatro, d: d };
  }
  function situacao(e) {
    if (e.cheia && e.cm >= e.cheia) return "Acima da cota de inundação (" + m(e.cheia) + " m).";
    if (e.cm < e.seca) return m(e.seca - e.cm) + " m abaixo da cota de seca (" + m(e.seca) + " m).";
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
    $("#rio-cota").innerHTML = m(e.cm) + "<small>m</small>";
    $("#rio-variacao").textContent = v.hoje + ". " + v.quatro.charAt(0).toUpperCase() + v.quatro.slice(1) + ".";
    $("#rio-situacao").textContent = situacao(e) + " Situação na ANA: " + e.ana.toLowerCase() + ".";
    $("#rio-data").textContent = "Boletim da ANA de " + IARA.DATA_RIO + ".";
    desenharRegua(e);

    var lista = IARA.ESTACOES.slice();
    if (lugar) lista.sort(function (a, b) { return km(lugar.lat, lugar.lon, a.lat, a.lon) - km(lugar.lat, lugar.lon, b.lat, b.lon); });
    $("#lista-estacoes").innerHTML = lista.map(function (x) {
      var d = x.cm - x.ontem, seta = d < 0 ? "arrow-down" : (d > 0 ? "arrow-up" : "minus");
      var dist = lugar ? ", a " + n(Math.round(km(lugar.lat, lugar.lon, x.lat, x.lon))) + " km" : "";
      return '<li><button type="button" data-id="' + x.id + '"' + (x.id === e.id ? ' aria-current="true"' : "") + "><span>" + esc(x.nome) +
        "<small>" + esc(x.rio) + dist + '</small></span><span class="n">' + m(x.cm) + ' m</span><i class="ph ph-' + seta + '" aria-label="' + (d < 0 ? "descendo" : d > 0 ? "subindo" : "estável") + '"></i></button></li>';
    }).join("");
  }

  /* ---------- fogo ---------- */
  var mesFogo = ler("iara-mes", 11), raioFogo = ler("iara-raio", 30);

  function focosPerto(F, mes, raio) {
    var g = raio / 111 + 0.1, out = [];
    for (var i = 0; i < F.length; i++) {
      var f = F[i];
      if (f[2] !== mes || Math.abs(f[0] - lugar.lat) > g || Math.abs(f[1] - lugar.lon) > g) continue;
      var d = km(lugar.lat, lugar.lon, f[0], f[1]);
      if (d <= raio) out.push({ lat: f[0], lon: f[1], n: f[3], d: d });
    }
    return out.sort(function (a, b) { return a.d - b.d; });
  }
  function riscoPerto(R, mes) {
    var melhor = 0, dmin = 99;
    for (var i = 0; i < R.length; i++) {
      var r = R[i];
      if (r[2] !== mes) continue;
      var dl = Math.abs(r[0] - lugar.lat), dn = Math.abs(r[1] - lugar.lon);
      if (dl <= 0.13 && dn <= 0.13 && dl + dn < dmin) { dmin = dl + dn; melhor = r[3]; }
    }
    return melhor;
  }
  function desmatePerto(D, raio) {
    var g = raio / 111 + 0.1, out = [];
    D.forEach(function (x) {
      if (Math.abs(x[0] - lugar.lat) > g || Math.abs(x[1] - lugar.lon) > g) return;
      var d = km(lugar.lat, lugar.lon, x[0], x[1]);
      if (d <= raio) out.push({ d: d, classe: x[3], area: x[4], mes: x[2] });
    });
    return out.sort(function (a, b) { return a.d - b.d; });
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
      var s = Math.min(26, 9 + Math.sqrt(f.n) * 4);
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
    segmento($("#fogo-mes"), MESES_DADOS.map(function (x) { return [x, MESES[x - 1].slice(0, 3)]; }), mesFogo, function (v) { mesFogo = v; guardar("iara-mes", v); desenharFogo(); });
    segmento($("#fogo-raio"), [[10, "10 km"], [30, "30 km"], [50, "50 km"]], raioFogo, function (v) { raioFogo = v; guardar("iara-raio", v); desenharFogo(); });
    $("#fogo").classList.toggle("sem-lugar-fogo", !lugar);
    if (!lugar) {
      $("#fogo-resumo").textContent = "Para ver o fogo perto de você, diga onde está.";
      $("#fogo-perto").innerHTML = '<button class="btn btn-cheio" type="button" data-acao="gps"><i class="ph ph-crosshair"></i>Usar minha localização</button>';
      $("#fogo-risco").innerHTML = '<button class="link-texto" type="button" data-acao="escolher">Escolher cidade ou reserva</button>';
      $("#fogo-desmate").textContent = ""; $("#fogo-nota").textContent = "";
      return;
    }
    Promise.all([dados("focos"), dados("risco"), dados("deter")]).then(function (r) {
      var lista = focosPerto(r[0], mesFogo, raioFogo), total = lista.reduce(function (a, f) { return a + f.n; }, 0);
      var nomeMes = MESES[mesFogo - 1] + (ULTIMO_DIA[mesFogo] ? " (" + ULTIMO_DIA[mesFogo] + ")" : "");
      $("#fogo-resumo").textContent = total === 0
        ? "Nenhum foco de calor a até " + raioFogo + " km em " + nomeMes + "."
        : n(total) + (total === 1 ? " foco de calor" : " focos de calor") + " a até " + raioFogo + " km em " + nomeMes + ".";
      $("#fogo-perto").textContent = lista.length ? "O mais perto fica a " + Math.max(1, Math.round(lista[0].d)) + " km, " + rumo(lugar.lat, lugar.lon, lista[0].lat, lista[0].lon) + "." : "";
      var rk = riscoPerto(r[1], mesFogo);
      $("#fogo-risco").innerHTML = "Risco de fogo na sua área em " + MESES[mesFogo - 1] + ': <span class="risco-tag">' + RISCO_NOME[rk] + "</span>.";
      var dm = desmatePerto(r[2], raioFogo);
      $("#fogo-desmate").textContent = dm.length
        ? n(dm.length) + (dm.length === 1 ? " alerta" : " alertas") + " de desmatamento ou queimada do INPE a até " + raioFogo + " km desde junho."
        : "Nenhum alerta grande de desmatamento a até " + raioFogo + " km desde junho.";
      $("#fogo-nota").textContent = "Focos do satélite de referência do INPE, somados em quadrados de cerca de 10 km. Um foco é um ponto quente visto do espaço, pode ser roça, mata ou pasto. O risco é um índice da equipe IARA, não previsão oficial.";
      desenharRadar(lista, raioFogo);
    });
  }

  /* ---------- início ---------- */
  function desenharInicio() {
    var tem = !!lugar;
    $("#lugar-vazio").hidden = tem; $("#lugar-cheio").hidden = !tem;
    $("#inicio-datas").textContent = "Rio: boletim da ANA de " + IARA.DATA_RIO + ". Fogo: INPE, de junho a 13/11/2026.";
    if (!tem) return;
    $("#lugar-nome").textContent = lugar.nome;
    var e = estacao(), v = variacao(e);
    var dist = Math.round(km(lugar.lat, lugar.lon, e.lat, e.lon));
    $("#resumo-rio").innerHTML = '<i class="ph ph-waves"></i><span><small>' + esc(e.rio + " em " + e.nome) + (dist > 40 ? ", a " + n(dist) + " km" : "") + "</small><b>" + m(e.cm) + " m</b><small>" + v.hoje + "." + (e.cm < e.seca ? " Abaixo da cota de seca." : "") + '</small></span><i class="ph ph-caret-right"></i>';
    var bf = $("#resumo-fogo"), cab = '<i class="ph ph-fire"></i><span><small>Fogo a até 30 km, em novembro (até o dia 13)</small>';
    bf.innerHTML = cab + "<b>&nbsp;</b></span>";
    Promise.all([dados("focos"), dados("risco")]).then(function (r) {
      var ultimo = MESES_DADOS[MESES_DADOS.length - 1];
      var lista = focosPerto(r[0], ultimo, 30), total = lista.reduce(function (a, f) { return a + f.n; }, 0), rk = riscoPerto(r[1], ultimo);
      bf.innerHTML = cab + "<b>" + (total === 0 ? "Nenhum foco de calor" : n(total) + (total === 1 ? " foco de calor" : " focos de calor")) + "</b><small>" +
        (lista.length ? "O mais perto fica a " + Math.max(1, Math.round(lista[0].d)) + " km, " + rumo(lugar.lat, lugar.lon, lista[0].lat, lista[0].lon) + ". " : "") +
        "Risco de fogo: " + RISCO_NOME[rk] + '.</small></span><i class="ph ph-caret-right"></i>';
      ocultarIcones();
    });
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
      el.innerHTML = "Este lugar fica na <strong>" + esc(nome) + "</strong>" + (achado.e ? ", do povo " + esc(achado.e) : "") + ". " +
        (achado.fo ? n(achado.fo) + (achado.fo === 1 ? " foco de calor" : " focos de calor") + " dentro do território em 2026." : "Nenhum foco de calor dentro do território em 2026.");
      el.hidden = false;
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
  var mapa = null, camadaFundo = null, camadaDados = null, fundoMapa = ler("iara-fundo", "esri");
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
      : "Pontos vermelhos: fogo ativo visto pelo satélite da NASA em " + ontem().split("-").reverse().join("/") + ". Quadrados laranja: focos do INPE no mês.";
  }
  function desenharMapa() {
    segmento($("#mapa-fundo"), FUNDOS.map(function (f, i) { return [i, f[1]]; }), FUNDOS.map(function (f) { return f[0]; }).indexOf(fundoMapa), function (v) {
      fundoMapa = FUNDOS[v][0]; guardar("iara-fundo", fundoMapa); desenharMapa();
    });
    var sem = $("#mapa-sem");
    if (!navigator.onLine) { sem.textContent = "Sem internet agora. O mapa aparece quando o celular conectar."; sem.hidden = false; return; }
    sem.hidden = true;
    carregarLeaflet().then(function () {
      var centro = lugar ? [lugar.lat, lugar.lon] : [-3.4, -60.5];
      if (!mapa) {
        mapa = L.map("mapa-leaflet", { zoomControl: true, attributionControl: true }).setView(centro, lugar ? 10 : 6);
        mapa.attributionControl.setPrefix(false);
      } else { mapa.invalidateSize(); mapa.setView(centro, mapa.getZoom()); }
      trocarFundo();
      return Promise.all([dados("focos"), dados("territorios")]);
    }).then(function (r) {
      if (camadaDados) mapa.removeLayer(camadaDados);
      camadaDados = L.layerGroup().addTo(mapa);
      var c = mapa.getCenter(), g = 1.2;
      r[1].forEach(function (t) {
        var b = t.b;
        if (b[2] < c.lat - g * 2 || b[0] > c.lat + g * 2 || b[3] < c.lng - g * 2 || b[1] > c.lng + g * 2) return;
        L.polygon(t.p.map(function (anel) { return anel.map(function (p) { return [p[1], p[0]]; }); }), { color: "#8fd6a6", weight: 2, fillOpacity: 0.08, interactive: false }).addTo(camadaDados);
      });
      r[0].forEach(function (f) {
        if (f[2] !== mesFogo || Math.abs(f[0] - c.lat) > g || Math.abs(f[1] - c.lng) > g) return;
        var s = 0.02;
        L.rectangle([[f[0] - s, f[1] - s], [f[0] + s, f[1] + s]], { color: "#5a1e08", weight: 1, fillColor: "#f07a45", fillOpacity: 0.9 })
          .bindTooltip(n(f[3]) + (f[3] === 1 ? " foco" : " focos") + " em " + MESES[mesFogo - 1]).addTo(camadaDados);
      });
      IARA.ESTACOES.forEach(function (e) {
        L.circleMarker([e.lat, e.lon], { radius: 7, color: "#fff", weight: 2, fillColor: "#5aa7c9", fillOpacity: 1 })
          .bindTooltip(e.nome + ": " + m(e.cm) + " m", { className: "mapa-rotulo" }).addTo(camadaDados);
      });
      if (lugar) {
        L.circleMarker([lugar.lat, lugar.lon], { radius: 8, color: "#102019", weight: 4, fillColor: "#fff", fillOpacity: 1 })
          .bindTooltip(lugar.nome, { permanent: true, direction: "right", offset: [10, 0], className: "mapa-rotulo" }).addTo(camadaDados);
      }
    }).catch(function () { sem.textContent = "Não deu para abrir o mapa. Confira a internet e tente de novo."; sem.hidden = false; });
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
  var rolarAte = null;
  function desenharTudo() { rota(); }
  function ocultarIcones() { $$("i.ph:not([aria-label])").forEach(function (i) { i.setAttribute("aria-hidden", "true"); }); }

  function rota() {
    var partes = (location.hash || "#inicio").slice(1).split("/");
    var tela = TELAS.indexOf(partes[0]) >= 0 ? partes[0] : "inicio", sub = partes[1];
    TELAS.forEach(function (t) { $("#" + t).hidden = t !== tela; });
    document.body.dataset.tela = tela;
    var titulo = $("#topo-titulo");
    titulo.textContent = tela === "inicio" ? "IARA" : (tela === "mais" && sub && IARA.GUIAS.some(function (g) { return g.id === sub; }) ? "Guia sem internet" : $("#" + tela).dataset.titulo);
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
    if (alvo) window.scrollTo(0, alvo.getBoundingClientRect().top + window.scrollY - 90); else window.scrollTo(0, 0);
  }
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("hashchange", rota);

  /* ---------- eventos ---------- */
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest("[data-acao]");
    if (a && a.dataset.acao === "gps") pedirGps();
    if (a && a.dataset.acao === "escolher") abrirFolha();
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
    rota();
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

  window.addEventListener("offline", function () { avisar("Sem internet. Rio, fogo, guias e anotações continuam funcionando."); });

  rota();

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
