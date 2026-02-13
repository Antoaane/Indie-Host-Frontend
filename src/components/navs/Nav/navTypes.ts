// File: src/components/navs/Nav/navTypes.ts

import type { VNodeRef } from 'vue'

export type NavVariant = 'landing' | 'host' | 'public'

export type NavItem = {
  id: string
  index?: number
  name: string
  link: string
  cta?: boolean
  target?: boolean
  action?: (event?: MouseEvent) => void
  attrs?: Record<string, string | number | boolean>
  ref?: VNodeRef
}
