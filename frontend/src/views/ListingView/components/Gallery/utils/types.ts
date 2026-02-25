// File: src/views/ListingView/components/Gallery/utils/types.ts

export type Item = {
  src: string  // au lieu de 'image'
  alt: string
  index?: number
  position?: number
}
export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number
}
export type Slot = {
  id: number;
  rect: Rect;
  imageIndex: number;
  objPos: string
}
export type Ori = 'H' | 'V' | 'S'
