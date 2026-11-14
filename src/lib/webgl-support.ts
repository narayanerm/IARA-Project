export function hasWebGL2(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    return !!gl
  } catch {
    return false
  }
}

export function hasWebGL1(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    return !!gl
  } catch {
    return false
  }
}
