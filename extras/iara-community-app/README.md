# IARA Apoio, the support app

**IARA is the website**, published at https://iara.earth from the root of this repository. The website is the main product of the project: it uses satellite radar to follow floods, drought and fire across the Amazon, with maps, radar images and analysis.

This folder holds **IARA Apoio**, a small support app that goes with the website. Together they make up the IARA project, but the app is only a companion. It carries to the phone the few things that people who live by the river need day to day, and it does not replace the website. It answers four questions quickly:

- **River level.** What is the river doing near me, and how close is it to the flood or drought mark? The app reads the latest automatic reading from ANA telemetry (every 15 minutes) for 12 stations.
- **Fire nearby.** How many fire hotspots were seen within 10, 30 or 50 km of me in the last 24 or 48 hours, and how far away is the closest one? The data is the INPE daily hotspot file, all satellites.
- **Report.** Where do I report illegal logging, mining, fishing, invasion of Indigenous land, violence or oil in the water? Each case lists the official channels: Ibama, MPF, Funai and Disque 100.
- **Learn.** Guides, free government courses, Funai services and benefits such as seguro-defeso and Bolsa Verde.

There is also a satellite map, with Esri imagery and yesterday's NASA VIIRS true colour and fire layers.

## Online only

The app needs internet. Every time it opens, it downloads the river readings from ANA and today's and yesterday's hotspots from INPE, so the numbers are always current. Both services allow direct browser requests (CORS), so there is no server of our own. Without internet the app shows a "Sem internet" screen with a retry button and a button to call 193. When the connection comes back it reloads by itself, and it reloads again when the user comes back to the app after 15 minutes.

The territory outlines (Funai and ICMBio) stay inside the app because they almost never change. The chosen location stays on the phone.

## First-run tour

The first time the app opens, a 9-step tour first says that this is a support app for the IARA website, then explains what the app is for and what each tab does (Início, Rio, Fogo, Mapa, Denunciar, Mais), then asks for the user's location. It can be opened again from Mais, Ajustes.

## See it without a phone

Download **`visualizer.html`** and double-click it. It opens the real app inside a phone frame in any browser on a computer. Click as if it were a finger. The tour opens first. Then pick a town, for example Tefé or Lábrea. The visualizer needs internet, like the app.

## Install on an Android phone

1. Copy **`apk/IARA.apk`** to the phone, or download it on the phone from GitHub.
2. Open it. Android asks to allow installs from this source. Allow it once.
3. Open IARA, follow the tour, and tap "Usar minha localização" or choose a town from the list.

The APK is a debug build signed with the standard Android debug key. Use it for testing and demos, not for the Play Store. It needs Android 7.0 or newer.

## What is in this folder

| Path | What it is |
|---|---|
| `visualizer.html` | The whole app in one file, inside a phone frame, for a computer browser |
| `apk/IARA.apk` | Android app, ready to install |
| `www/` | The app source: plain HTML, CSS and JavaScript, no framework |
| `www/dados/territorios.js` | Indigenous land and reserve outlines, built from the website's map layers |
| `ferramentas/` | Scripts that rebuild the territory data and the visualizer |
| `assets/`, `capacitor.config.json`, `package.json` | Android packaging with Capacitor 8 |
| `REVISAO_50_SINAIS.md` | Design review against 50 common signs of AI-generated interfaces (in Portuguese) |

## Rebuild

You need Node.js 20+ and Python 3. For the APK you also need the Android SDK, which Android Studio installs.

```
python ferramentas/gerar_dados.py PATH/TO/dados_mapa              # territory outlines, from the map layers of the IARA website
python ferramentas/gerar_visualizador.py                           # visualizer.html
npm install
npm run android:criar                                              # first time only: creates android/
npm run apk                                                        # builds android/app/build/outputs/apk/debug/app-debug.apk
```

The drought and flood marks of each river station are in `www/js/base.js`, next to the ANA station code.

## Sources

ANA (telemetry web service), INPE (Programa Queimadas, daily hotspot files), Funai and ICMBio (territory limits), and NASA GIBS and Esri for the satellite map.

---

## Em português

O IARA é o site (https://iara.earth), que é a parte principal do projeto. Esta pasta guarda o IARA Apoio, um app de apoio ao site para comunidades ribeirinhas e indígenas. Site e app fazem parte do mesmo projeto, mas o app é só um complemento. Precisa de internet: toda vez que abre, busca o nível do rio na ANA e os focos de fogo do dia no INPE. Na primeira vez abre um tour que mostra cada aba. Para ver sem celular, baixe `visualizer.html` e abra com dois cliques. Para instalar no Android, use `apk/IARA.apk` e permita a instalação quando o celular pedir.
