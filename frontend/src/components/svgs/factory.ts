// File: src/components/svgs/factory.ts

import { useThemeStore } from '@/stores/theme'

function createThemeVariants(light: any, dark: any) {
    const resolve = (invert = false) => {
        const theme = useThemeStore().current
        const effective = invert ? (theme === 'dark' ? 'light' : 'dark') : theme
        return effective === 'dark' ? dark : light
    }

    return {
        light,
        dark,
        get adapt() {
            return Object.assign(resolve(false), {
                get invert() {
                    return resolve(true)
                }
            })
        }
    }
}

export { createThemeVariants }