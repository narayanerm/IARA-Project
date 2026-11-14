"""Gera os dados do app (www/dados/*.js) a partir das camadas do site em site_amazonia/dados_mapa/.
Uso, na pasta app_iara:  python ferramentas/gerar_dados.py ../site_amazonia/dados_mapa
Depois rode  node ferramentas/gerar_sw.mjs  para o app guardar os arquivos novos."""
import json, os, sys

D = sys.argv[1] if len(sys.argv) > 1 else os.path.join("..", "site_amazonia", "dados_mapa")
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "www", "dados")
MINUSCULAS = {"De", "Do", "Da", "Dos", "Das", "E", "Em", "No", "Na", "Nos", "Nas"}


def carregar(n):
    s = open(os.path.join(D, n + ".js"), encoding="utf-8").read()
    return json.loads(s[s.index("= {") + 2:].rstrip().rstrip(";"))


def centro(anel):
    xs = [p[0] for p in anel]; ys = [p[1] for p in anel]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def aneis(g):
    if g["type"] == "Polygon": return [g["coordinates"]]
    if g["type"] == "MultiPolygon": return g["coordinates"]
    return []


def nome(n):
    w = n.split(" ")
    return " ".join(x.lower() if i and x in MINUSCULAS else x for i, x in enumerate(w))


def simplificar(c):
    res, ult = [], None
    for x, y in c:
        q = (round(x, 2), round(y, 2))
        if q != ult: res.append(list(q)); ult = q
    return res


out = {}
# focos: [lat, lon, mes, focos]
out["focos"] = [[round(x["geometry"]["coordinates"][1], 2), round(x["geometry"]["coordinates"][0], 2), x["properties"]["mes"], x["properties"]["focos"]]
                for x in carregar("focos_inpe")["features"]]
# risco: só células moderado ou mais, [lat, lon, mes, classe 1 a 3]
CL = {"moderado": 1, "alto": 2, "muito alto": 3}
out["risco"] = []
for x in carregar("risco_fogo")["features"]:
    p = x["properties"]; k = CL.get(p["risco"])
    if not k: continue
    for poly in aneis(x["geometry"]):
        lon, lat = centro(poly[0][:-1]); out["risco"].append([round(lat, 3), round(lon, 3), p["mes"], k])
# deter: [lat, lon, mes, classe, area, municipio, uf]
out["deter"] = []
for x in carregar("desmatamento_deter")["features"]:
    p = x["properties"]; poly = aneis(x["geometry"])
    if not poly: continue
    lon, lat = centro(poly[0][0][:-1])
    out["deter"].append([round(lat, 3), round(lon, 3), p["mes"], p["classe"], p["area_km2"], p["municipio"], p["uf"]])
# territórios: nome, tipo, povo, fase, focos 2026, risco, caixa e polígono simplificado
out["territorios"] = []
for camada, ti in [("terras_indigenas", True), ("territorios_tradicionais", False)]:
    for x in carregar(camada)["features"]:
        p = x["properties"]; polys = aneis(x["geometry"])
        if not polys: continue
        pts = [pt for poly in polys for pt in poly[0]]
        xs = [a for a, b in pts]; ys = [b for a, b in pts]
        tipo = "TI" if ti else ("RESEX" if "Extrativista" in p.get("classe", "") else "RDS")
        out["territorios"].append({"n": nome(p["nome"]), "t": tipo, "e": p.get("etnia"), "f": p.get("fase"), "fo": p.get("focos_2026"), "r": p.get("risco"),
                                   "b": [round(min(ys), 2), round(min(xs), 2), round(max(ys), 2), round(max(xs), 2)],
                                   "p": [simplificar(poly[0]) for poly in polys]})

os.makedirs(SAIDA, exist_ok=True)
for k, v in out.items():
    arq = os.path.join(SAIDA, k + ".js")
    with open(arq, "w", encoding="utf-8") as f:
        f.write("window.IARA_D=window.IARA_D||{};IARA_D." + k + "=" + json.dumps(v, ensure_ascii=False, separators=(",", ":")) + ";")
    print(k, len(v), "itens,", os.path.getsize(arq) // 1024, "KB")
