// File: src/views/ListingView/components/Gallery/utils/type.ts

export type Item = { image: string; alt?: string }
export type Rect = { x: number; y: number; w: number; h: number }
export type Slot = { id: number; rect: Rect; imageIndex: number; objPos: string }
export type Ori = 'H' | 'V' | 'S'