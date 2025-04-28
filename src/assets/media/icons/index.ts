import LogoIconLight from '@/assets/media/icons/LogoIconLight.vue'
import LogoIconDark from '@/assets/media/icons/LogoIconDark.vue'
import LogoFullLight from '@/assets/media/icons/LogoFullLight.vue'
import LogoFullDark from '@/assets/media/icons/LogoFullDark.vue'

import { createThemeVariants } from '@/assets/media/icons/factory'

export const icons = {
    logoIcon: createThemeVariants(LogoIconLight, LogoIconDark),
    logoFull: createThemeVariants(LogoFullLight, LogoFullDark),
}
