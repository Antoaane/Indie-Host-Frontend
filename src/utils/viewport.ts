// File: src/utils/viewport.ts

import { useBreakpoints } from '@vueuse/core'

const bp = useBreakpoints({
  xs: 360,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
  xxxl: 1920,
  xxxxl: 2560,
})

export const vp = {
  xs: bp.greater('xs'),
  sm: bp.greater('sm'),
  md: bp.greater('md'),
  lg: bp.greater('lg'),
  xl: bp.greater('xl'),
  xxl: bp.greater('xxl'),
  xxxl: bp.greater('xxxl'),
  xxxxl: bp.greater('xxxxl'),
}