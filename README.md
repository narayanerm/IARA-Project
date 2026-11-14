# IARA

## Refresh the flood forecasts

Run `npm run data:flood-forecasts` with Node.js 22.15 or newer. The script fetches the latest GEOGLOWS forecasts for the Amazon river preview points and writes `public/data/flood-forecasts.json`. Run it before building or publishing the app to include that day's file.

IARA uses the file on the UTC day it was generated. For a missing or outdated entry, it requests the forecast from GEOGLOWS. Gray map points open a river forecast and do not indicate a flood alert.
