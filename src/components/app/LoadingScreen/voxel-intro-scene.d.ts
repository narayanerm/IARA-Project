export interface VoxelIntroElements {
  glc: HTMLCanvasElement
  cv: HTMLCanvasElement
  topo: HTMLElement
  hud: HTMLElement
  estado: HTMLElement
  barra: HTMLElement
}
export declare const INTRO_T: {
  sweep0: number
  sweep1: number
  fly0: number
  fly1: number
  morph1: number
  split0: number
  split1: number
}
/** Starts the intro; returns a function that stops it and frees every GPU and DOM resource. */
export declare function startVoxelIntro(els: VoxelIntroElements, onDone: () => void): () => void
