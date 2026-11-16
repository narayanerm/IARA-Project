"""Gera visualizer.html: o app inteiro num arquivo só, dentro de uma moldura de celular,
para ver no navegador do computador sem instalar nada.
Uso, na pasta do app:  python ferramentas/gerar_visualizador.py"""
import base64, html, mimetypes, re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
WWW = RAIZ / "www"


def ler(p):
    return (WWW / p).read_text(encoding="utf-8")


def data_url(p):
    tipo = mimetypes.guess_type(str(p))[0] or ("font/woff2" if str(p).endswith(".woff2") else "application/octet-stream")
    if str(p).endswith(".svg"): tipo = "image/svg+xml"
    return "data:%s;base64,%s" % (tipo, base64.b64encode((WWW / p).read_bytes()).decode())


css = ler("css/app.css")
css = re.sub(r'url\("\.\./(vendor/fontes/[^"]+)"\)', lambda m: 'url("%s")' % data_url(m.group(1)), css)
fonte_icones = '@font-face { font-family: "Phosphor"; src: url("%s") format("woff2"); font-weight: normal; font-style: normal; font-display: block; }' % data_url("vendor/phosphor/Phosphor.woff2")
icones = re.sub(r"@font-face\s*{[^}]*}", fonte_icones, ler("vendor/phosphor/style.css"), count=1)

pagina = ler("index.html")
pagina = pagina.replace('<link rel="manifest" href="manifest.webmanifest">\n', '<base href="about:srcdoc">\n')
pagina = pagina.replace('<link rel="stylesheet" href="vendor/phosphor/style.css">', "<style>" + icones + "</style>")
pagina = pagina.replace('<link rel="stylesheet" href="css/app.css">', "<style>" + css + "</style>\n<style>" + ler("vendor/leaflet/leaflet.css") + "</style>")
pagina = re.sub(r'(src|href)="(img/[^"]+)"', lambda m: '%s="%s"' % (m.group(1), data_url(m.group(2))), pagina)
dados = "".join("<script>" + ler("dados/%s.js" % n) + "</script>\n" for n in ["territorios"])
pagina = pagina.replace('<script src="js/base.js"></script>',
                        "<script>" + ler("vendor/leaflet/leaflet.js") + "</script>\n" + dados + "<script>" + ler("js/base.js") + "</script>")
pagina = pagina.replace('<script src="js/app.js"></script>', "<script>" + ler("js/app.js") + "</script>")
# dentro do visualizador não mexe em service worker
pagina = pagina.replace('if ("serviceWorker" in navigator &&', 'if (false &&')
assert 'src="js/' not in pagina and 'href="css/' not in pagina

moldura = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IARA Apoio, visualizador do app</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 40px; padding: 24px; box-sizing: border-box; background: #1b211e; font-family: Arial, sans-serif; color: #e6eee8; }
  .aparelho { width: 412px; height: 860px; padding: 14px; background: #0b0d0c; border-radius: 44px; box-shadow: 0 0 0 2px #3a403d; flex: none; }
  iframe { width: 100%; height: 100%; border: 0; border-radius: 32px; background: #eef3ee; display: block; }
  .texto { max-width: 340px; font-size: 15px; line-height: 1.5; }
  .texto h1 { font-size: 22px; margin: 0 0 10px; }
  .texto p { margin: 0 0 10px; color: #b9c8bf; }
  button { font: inherit; padding: 8px 14px; border-radius: 6px; border: 1px solid #56605a; background: #262d29; color: inherit; cursor: pointer; margin: 4px 8px 0 0; }
  @media (max-height: 920px) { .aparelho { zoom: 0.85; } }
</style>
</head>
<body>
<div class="aparelho"><iframe id="app" title="App de apoio do IARA" srcdoc="__APP__"></iframe></div>
<div class="texto">
  <h1>App de apoio do IARA</h1>
  <p>A parte principal do projeto IARA é o site, em <a href="https://iara.earth" target="_blank" rel="noopener" style="color:#8fd6a6">iara.earth</a>. Este é o app de apoio, para quem mora na beira do rio, rodando dentro de uma moldura de celular. Clique como se fosse o dedo.</p>
  <p>Na primeira vez abre um tour que mostra cada aba. Depois escolha uma cidade, por exemplo Tefé ou Lábrea.</p>
  <p>O app precisa de internet: o nível do rio vem da ANA e os focos de fogo vêm do INPE, buscados na hora.</p>
  <button type="button" onclick="try{localStorage.removeItem('iara-tour')}catch(e){};var f=document.getElementById('app');f.srcdoc=f.srcdoc">Ver o tour de novo</button>
</div>
</body>
</html>
""".replace("__APP__", html.escape(pagina, quote=True))

saida = RAIZ / "visualizer.html"
saida.write_text(moldura, encoding="utf-8")
print("visualizer.html:", saida.stat().st_size // 1024, "KB")
