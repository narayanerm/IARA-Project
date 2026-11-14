let webGL2Supported: boolean | undefined

export function hasWebGL2(): boolean {
  if (typeof document === 'undefined') return false
  if (webGL2Supported !== undefined) return webGL2Supported

  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2')
    webGL2Supported = context !== null
    // This canvas only probes support. Give its context back before mounting the renderer.
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return webGL2Supported
  } catch {
    webGL2Supported = false
    return false
  }
}
