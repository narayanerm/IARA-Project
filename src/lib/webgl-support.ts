// Creating a WebGL context is expensive and browsers cap how many can be alive at once (the oldest,
// possibly the map's, gets dropped), so probe once, release the probe context and cache the answer.
const cache: { webgl2?: boolean; webgl1?: boolean } = {}

function probe(kind: 'webgl2' | 'webgl'): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext(kind) ??
      (kind === 'webgl' ? canvas.getContext('experimental-webgl') : null)) as WebGLRenderingContext | null
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

export function hasWebGL2(): boolean {
  cache.webgl2 ??= probe('webgl2')
  return cache.webgl2
}

export function hasWebGL1(): boolean {
  cache.webgl1 ??= probe('webgl')
  return cache.webgl1
}
