import { Source } from 'react-map-gl/maplibre'

export function TerrainSource() {
  return (
    <Source
      id="terrain-dem"
      type="raster-dem"
      tiles={['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png']}
      tileSize={256}
      encoding="terrarium"
      maxzoom={15}
      attribution="AWS Terrain Tiles"
    />
  )
}
