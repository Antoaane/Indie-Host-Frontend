// File: src/components/svgs/index.ts

import LogoIconLight from '@/components/svgs/icons/LogoIconLight.vue'
import LogoIconDark from '@/components/svgs/icons/LogoIconDark.vue'
import LogoFullLight from '@/components/svgs/icons/LogoFullLight.vue'
import LogoFullDark from '@/components/svgs/icons/LogoFullDark.vue'

import { createThemeVariants } from '@/components/svgs/factory'

export const icons = {
    logoIcon: createThemeVariants(LogoIconLight, LogoIconDark),
    logoFull: createThemeVariants(LogoFullLight, LogoFullDark),
}
