// File: src/views/ListingView/components/Gallery/utils/maths.ts

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const rand = (min: number, max: number) => Math.random() * (max - min) + min
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))
export const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]