import type { RegionId } from '@/lib/types'

/**
 * Photos and videos for the case frames, read from src/assets/cases/<folder>/ at build time, so
 * dropping a file in the folder is enough. At rest a frame shows the satellite picture of its
 * region; on hover it plays the case's video, or rotates its photos when there is no video.
 */
const FOLDER: Record<RegionId, string> = { YANO: 'garimpo', ENCH: 'enchente', SECA: 'seca' }

const files = import.meta.glob('/src/assets/cases/*/*.{jpg,jpeg,png,webp,avif,mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export interface CaseMedia {
  /** Photos, shown on hover only when the case has no video. */
  images: string[]
  video: string | null
}

export function caseMedia(id: RegionId): CaseMedia {
  const prefix = `/src/assets/cases/${FOLDER[id]}/`
  const mine = Object.keys(files)
    .filter((k) => k.startsWith(prefix))
    .sort((a, b) => a.localeCompare(b))
  const isVideo = (k: string) => /\.(mp4|webm)$/i.test(k)
  const stills = mine.filter((k) => !isVideo(k))
  const videoKey = mine.find(isVideo)
  return {
    images: stills.map((k) => files[k]),
    video: videoKey ? files[videoKey] : null,
  }
}
