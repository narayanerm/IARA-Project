# Attributions

## 3D Models

All models under `public/models/` are licensed under
**Creative Commons Attribution 3.0 Unported (CC-BY 3.0)**
and sourced from [Poly Pizza](https://poly.pizza/).

| File | Title | Author | Source |
|---|---|---|---|
| `jaguar.glb` | Jaguar | Poly by Google | https://poly.pizza/m/4fb-oMr2uUF |
| `toucan.glb` | Toco Toucan | Poly Pizza author | https://poly.pizza/m/fFVqukPnc62 |
| `macaw.glb` | Macaw | Poly by Google | https://poly.pizza/m/frVFwZAW6z3 |
| `spider-monkey.glb` | Spider monkey | Poly by Google | https://poly.pizza/m/4Ci4DWwucRd |
| `sloth.glb` | Sloth | marioba | https://poly.pizza/m/KiJBu1Shwo |
| `capybara.glb` | Capybara | Poly by Google | https://poly.pizza/m/66d-mKAgF17 |
| `anaconda.glb` | Anaconda | Poly by Google | https://poly.pizza/m/1pi9DfAbsz0 |
| `dolphin.glb` | Dolphin | Poly by Google | https://poly.pizza/m/4Gkg2wLGJ_p |

License: https://creativecommons.org/licenses/by/3.0/

## Data Sources

| Source | Use | License / Terms |
|---|---|---|
| NISAR (NASA/ISRO) via ASF DAAC | L-band SAR granules | NASA Open Data Policy |
| Sentinel-1 (ESA) via ASF DAAC | C-band historical analogs | Copernicus Open Access |
| ALOS-2 PALSAR-2 (JAXA) | L-band historical analogs | ASF DAAC terms |
| NASA GIBS (MODIS, GPM IMERG, AMSR2) | Auxiliary context layers | NASA Open Data |
| MapBiomas Alerta | Deforestation / mining validation | CC-BY-SA 4.0 |
| DETER / PRODES (INPE) | Deforestation ground truth | Open data (INPE) |
| ANA cotas fluviais | Water level ground truth | Open data (ANA) |
| FUNAI via INPE TerraBrasilis (`indigenous_area_legal_amazon`) | 380 Indigenous Lands (386 source records; 6 boundary revisions merged into their land), simplified at 0.01° | Open data (FUNAI / INPE) |
| MMA/CNUC via INPE TerraBrasilis (`conservation_units_legal_amazon`) | 102 RESEX and RDS boundaries | Open data (MMA / INPE) |
| IBGE BC250 2023 (aglomerados rurais e vilas) | 1,538 riverside communities in Amazonas (within 2 km of water) | Open data (IBGE) |
| INPE Programa Queimadas (AQUA tarde) | Fire hotspots and fire-risk class per community and territory | Open data (INPE) |
| Terras Indígenas no Brasil (ISA) | Per-TI profile links | Linked only, no data copied |
| FUNAI · Geoprocessamento e Mapas | Official Indigenous Lands record (linked) | Open data (FUNAI) |
| IBGE | Amazon biome boundary | Open data (IBGE) |

Community layers come from the team data package (ITACUBE, 2026-11-14) and are
converted by `scripts/build-community-data.mjs` (`npm run data:communities`)
into `public/data/`. The TerraBrasilis TI layer may lag behind the records
FUNAI itself publishes. It lists six lands twice (the regularized area and a
boundary revision under way); the build keeps one entry per land with the
larger outline and shows the revision phase and area in the popup. Each TI popup
links to its ISA profile (344 of 380 matched by name) and to the official FUNAI
geodata page. The build also assigns each pin the zoom at which it appears, so
the overview shows a spaced-out subset and every pin is on the map from zoom 9
(TIs) or 11 (riverside communities). Hand-drawn TI outlines remain only for the
Leaflet fallback map shown when WebGL is unavailable.

## Base Map

OpenFreeMap vector tiles · https://openfreemap.org/
OpenMapTiles schema · https://openmaptiles.org/ · © OpenMapTiles
Map data © OpenStreetMap contributors · https://www.openstreetmap.org/copyright · ODbL
AWS Open Terrain Tiles · https://registry.opendata.aws/terrain-tiles/

## Software / AI Disclosure (NASA Space Apps 2026)

- Chatbot narration uses **Claude (Anthropic)** via a deterministic intent
  router in the current build. No free-form LLM generation of numbers or
  claims is used; narratives are pre-written per AOI.
- This codebase was developed with pair-programming assistance from Claude
  (Anthropic). Scientific interpretation, data sourcing and architectural
  decisions are the responsibility of the human authors.
