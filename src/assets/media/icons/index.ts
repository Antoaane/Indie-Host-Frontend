import LogoIconLight from '@/assets/media/icons/logo-icon-light.svg'
import LogoIconDark from '@/assets/media/icons/logo-icon-dark.svg'
import LogoFullLight from '@/assets/media/icons/logo-full-light.svg'
import LogoFullDark from '@/assets/media/icons/logo-full-dark.svg'

import { createThemeVariants } from '@/assets/media/icons/factory'

export const icons = {
    logoIcon: createThemeVariants(LogoIconLight, LogoIconDark),
    logoFull: createThemeVariants(LogoFullLight, LogoFullDark),
}
