/**
 * Feature switches for the MVP (one case study per phenomenon).
 * Everything here still exists in the code base; flip a switch to bring it back.
 */
export const FEATURES = {
  /** NASA GIBS colour overlay on the map (IMERG rain, MODIS NDVI, AMSR2 soil moisture). */
  nasaOverlay: false,
  /** "Optical (MODIS)" true-colour toggle in the header. */
  trueColorToggle: false,
  /** Indigenous Land and riverside community pins, areas and their map legend. */
  communityLayers: false,
  /** Old left panel (Amazon overview, the three anchor regions, community search). */
  legacySidebar: false,
  /** "NISAR live" control and the click-to-load NISAR raster on the map. */
  nisarLive: false,
  /** Guided tour (it points at panels that are switched off). */
  guidedTour: false,
  /** Optical (MODIS/VIIRS) tab in the before/after comparison. */
  opticalTab: false,
} as const
