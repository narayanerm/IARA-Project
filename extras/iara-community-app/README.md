# IARA community app

A phone app for riverside and Indigenous communities in the Amazon. It is a separate product from the IARA website in the root of this repository. The website is for people who want to explore the radar data. This app is for people who live by the river and need four answers quickly:

- **River level.** What is the river doing near me, and how close is it to the flood or drought mark? The data comes from the daily ANA bulletin for 12 stations.
- **Fire nearby.** How many fire hotspots are within 10, 30 or 50 km of me, and how far away is the closest one? The data comes from INPE, June to November 2026.
- **Report.** Where do I report illegal logging, mining, fishing, invasion of Indigenous land, violence or oil in the water? Each case lists the official channels: Ibama, MPF, Funai and Disque 100.
- **Learn.** Guides that open without internet, free government courses, Funai services and benefits such as seguro-defeso and Bolsa Verde.

There is also a satellite map, with Esri imagery and yesterday's NASA VIIRS true colour and fire layers. Everything except that map works offline after the app is opened once. The chosen location stays on the phone and nothing is sent to a server.

## See it without a phone

Download **`visualizer.html`** and double-click it. It opens the real app inside a phone frame in any browser on a computer. The data and images are inside that single file, so it needs nothing else. Click as if it were a finger. Start with "Escolher cidade ou reserva" and pick a town, for example Tefé or Lábrea.

The satellite map needs internet. Everything else in the visualizer works offline.

## Install on an Android phone

1. Copy **`apk/IARA.apk`** to the phone, or download it on the phone from GitHub.
2. Open it. Android asks to allow installs from this source. Allow it once.
3. Open IARA and tap "Usar minha localização", or choose a town from the list.

The APK is a debug build signed with the standard Android debug key. Use it for testing and demos, not for the Play Store. It needs Android 7.0 or newer.

## What is in this folder

| Path | What it is |
|---|---|
| `visualizer.html` | The whole app in one file, inside a phone frame, for a computer browser |
| `apk/IARA.apk` | Android app, ready to install |
| `www/` | The app source: plain HTML, CSS and JavaScript, no framework |
| `www/dados/` | Fire hotspots, fire risk, deforestation alerts and territory outlines, built from the website's map layers |
| `ferramentas/` | Scripts that rebuild the data, the offline cache and the visualizer |
| `assets/`, `capacitor.config.json`, `package.json` | Android packaging with Capacitor 8 |
| `REVISAO_50_SINAIS.md` | Design review against 50 common signs of AI-generated interfaces (in Portuguese) |

## Rebuild

You need Node.js 20+ and Python 3. For the APK you also need the Android SDK, which Android Studio installs.

```
python ferramentas/gerar_dados.py PATH/TO/dados_mapa              # data, from the map layers of the IARA website
node ferramentas/gerar_sw.mjs                                      # offline cache, after any change in www/
python ferramentas/gerar_visualizador.py                           # visualizer.html
npm install
npm run android:criar                                              # first time only: creates android/
npm run apk                                                        # builds android/app/build/outputs/apk/debug/app-debug.apk
```

To update the river numbers, edit `DATA_RIO` and the station values in `www/js/base.js` from the latest ANA bulletin.

## Sources

ANA (river bulletin, 13 Nov 2026), INPE (Programa Queimadas and DETER), Funai and ICMBio (territory limits), and NASA GIBS and Esri for the satellite map. The fire risk is an index calculated by the IARA team. It is not an official forecast.

---

## Em português

App do IARA para comunidades ribeirinhas e indígenas, separado do site. Para ver sem celular, baixe `visualizer.html` e abra com dois cliques. Para instalar no Android, use `apk/IARA.apk` e permita a instalação quando o celular pedir. Depois de aberto uma vez, o app funciona sem internet, menos o mapa de satélite.
