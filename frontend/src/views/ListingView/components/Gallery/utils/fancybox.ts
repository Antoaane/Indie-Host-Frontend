// File: src/views/ListingView/components/Gallery/utils/fancybox.ts

import { Fancybox } from '@fancyapps/ui'
import '@fancyapps/ui/dist/fancybox/fancybox.css'

export function fancyboxShow(items: Array<{ src: string; type?: string; alt?: string }>, startIndex = 0) {
  (Fancybox as any).show(items as any, { startIndex } as any)
}
