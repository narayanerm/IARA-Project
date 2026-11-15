// Earth Engine script: deforestation / garimpo footprint inside TI Yanomami.
//
// How to run:
//   1. Open https://code.earthengine.google.com
//   2. Paste this whole file in a new script and press Run
//   3. Charts render in the Console; CSVs land in the Tasks panel to export to Drive
//
// What it produces:
//   - yanomami_alos_nonforest.csv : L-band (ALOS-1/2 PALSAR) non-forest area per year, 2007-2020
//   - yanomami_hansen_loss.csv    : optical-baseline cumulative forest loss (Hansen GFC), 2001-2023

// -----------------------------------------------------------------------------
// 1. AOI — TI Yanomami polygon (same shape used in the app's local snapshot)
// -----------------------------------------------------------------------------
var yano = ee.Geometry.Polygon([[
  [-65.2, 4.3], [-63.4, 4.4], [-62.2, 3.9], [-61.3, 3.2], [-61.0, 2.5],
  [-61.2, 1.7], [-61.9, 1.1], [-62.8, 0.8], [-63.9, 0.9], [-64.6, 1.3],
  [-65.1, 1.9], [-65.4, 2.8], [-65.3, 3.6], [-65.2, 4.3],
]]);
Map.centerObject(yano, 7);
Map.addLayer(yano, {color: 'F07A45'}, 'TI Yanomami AOI');

// -----------------------------------------------------------------------------
// 2. ALOS-1 FNF (2007-2017) — class 2 = non-forest
// -----------------------------------------------------------------------------
var fnfLegacy = ee.ImageCollection('JAXA/ALOS/PALSAR/YEARLY/FNF');
var legacyYears = ee.List([2007, 2008, 2009, 2010, 2015, 2016, 2017]);

var legacyFC = ee.FeatureCollection(legacyYears.map(function(y) {
  y = ee.Number(y);
  var img = fnfLegacy
    .filterDate(ee.Date.fromYMD(y, 1, 1), ee.Date.fromYMD(y.add(1), 1, 1))
    .first();
  var nf = ee.Image(img).select('fnf').eq(2);
  var km2 = nf.multiply(ee.Image.pixelArea()).divide(1e6).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: yano,
    scale: 25,
    maxPixels: 1e10,
  }).get('fnf');
  return ee.Feature(null, {year: y, sensor: 'ALOS-1', alos_nonforest_km2: km2});
}));

// -----------------------------------------------------------------------------
// 3. ALOS-2 FNF4 (2018-2020) — class 3 = non-forest
// -----------------------------------------------------------------------------
var fnf4 = ee.ImageCollection('JAXA/ALOS/PALSAR/YEARLY/FNF4');
var alos2Years = ee.List([2018, 2019, 2020]);

var alos2FC = ee.FeatureCollection(alos2Years.map(function(y) {
  y = ee.Number(y);
  var img = fnf4
    .filterDate(ee.Date.fromYMD(y, 1, 1), ee.Date.fromYMD(y.add(1), 1, 1))
    .first();
  var nf = ee.Image(img).select('fnf').eq(3);
  var km2 = nf.multiply(ee.Image.pixelArea()).divide(1e6).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: yano,
    scale: 25,
    maxPixels: 1e10,
  }).get('fnf');
  return ee.Feature(null, {year: y, sensor: 'ALOS-2', alos_nonforest_km2: km2});
}));

var alosFC = legacyFC.merge(alos2FC);

// -----------------------------------------------------------------------------
// 4. Hansen Global Forest Change — cumulative loss inside the AOI per year
// -----------------------------------------------------------------------------
var hansen = ee.Image('UMD/hansen/global_forest_change_2023_v1_11');
var lossyear = hansen.select('lossyear'); // 1 = 2001 ... 23 = 2023
var pxKm2 = ee.Image.pixelArea().divide(1e6);

var hansenYears = ee.List.sequence(2001, 2023);
var hansenFC = ee.FeatureCollection(hansenYears.map(function(y) {
  y = ee.Number(y);
  var code = y.subtract(2000);
  var mask = lossyear.gte(1).and(lossyear.lte(code));
  var km2 = mask.multiply(pxKm2).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: yano,
    scale: 30,
    maxPixels: 1e10,
  }).get('lossyear');
  return ee.Feature(null, {year: y, hansen_cum_loss_km2: km2});
}));

// -----------------------------------------------------------------------------
// 5. Map preview: most recent ALOS non-forest + Hansen loss footprint
// -----------------------------------------------------------------------------
var latestAlos = fnf4.filterDate('2020-01-01', '2021-01-01').first();
Map.addLayer(
  latestAlos.select('fnf').eq(3).selfMask().clip(yano),
  {palette: ['F07A45']},
  'ALOS non-forest 2020'
);
Map.addLayer(
  hansen.select('loss').selfMask().clip(yano),
  {palette: ['FF2E2E']},
  'Hansen loss (any year)'
);

// -----------------------------------------------------------------------------
// 6. In-editor charts for a quick look
// -----------------------------------------------------------------------------
print(ui.Chart.feature.byFeature(alosFC.sort('year'), 'year', 'alos_nonforest_km2')
  .setChartType('LineChart')
  .setOptions({
    title: 'TI Yanomami — L-band non-forest area (ALOS-1/2 PALSAR)',
    hAxis: {title: 'Year'},
    vAxis: {title: 'km²'},
    lineWidth: 2,
    pointSize: 6,
    colors: ['#F07A45'],
  }));

print(ui.Chart.feature.byFeature(hansenFC.sort('year'), 'year', 'hansen_cum_loss_km2')
  .setChartType('LineChart')
  .setOptions({
    title: 'TI Yanomami — Hansen cumulative forest loss (optical baseline)',
    hAxis: {title: 'Year'},
    vAxis: {title: 'km²'},
    lineWidth: 2,
    pointSize: 6,
    colors: ['#FFFFFF'],
  }));

// -----------------------------------------------------------------------------
// 7. Export CSVs (run the tasks in the right-hand panel to send to Drive)
// -----------------------------------------------------------------------------
Export.table.toDrive({
  collection: alosFC.sort('year'),
  description: 'yanomami_alos_nonforest',
  fileFormat: 'CSV',
  selectors: ['year', 'sensor', 'alos_nonforest_km2'],
});

Export.table.toDrive({
  collection: hansenFC.sort('year'),
  description: 'yanomami_hansen_loss',
  fileFormat: 'CSV',
  selectors: ['year', 'hansen_cum_loss_km2'],
});
