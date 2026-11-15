import { Layer, Source } from 'react-map-gl/maplibre'
import { useApp } from '@/lib/store'
import { useSarChunks } from '@/lib/sarChunks'

export const SAR_ANCHOR_ID = 'sar-chunks-anchor'

/**
 * Every pre-built NISAR chunk of the active case, as MapLibre image layers. The images are
 * preloaded when the case opens, so turning the SAR button on shows them all at once.
 */
export function SarChunksLayer() {
  const activeRegion = useApp((s) => s.activeRegion)
  const aoiActive = useApp((s) => s.aoiActive)
  const visible = useApp((s) => s.nisarVisible)
  const opacity = useApp((s) => s.nisarOpacity)
  const { chunks } = useSarChunks(aoiActive ? activeRegion : null)

  return (
    <>
      {/* Invisible anchor: chunks sit right below it (above imagery, below outlines and pins). */}
      <Layer id={SAR_ANCHOR_ID} type="background" paint={{ 'background-opacity': 0 }} />
      {aoiActive &&
        visible &&
        chunks.map((c) => (
          <Source key={c.id} id={`sar-${c.id}`} type="image" url={c.url} coordinates={c.corners}>
            <Layer
              id={`sar-layer-${c.id}`}
              type="raster"
              beforeId={SAR_ANCHOR_ID}
              paint={{ 'raster-opacity': opacity, 'raster-fade-duration': 0, 'raster-resampling': 'linear' }}
            />
          </Source>
        ))}
    </>
  )
}
