// File: src/types/vue-splide.d.ts

declare module '@splidejs/vue-splide' {
    import { DefineComponent, App } from 'vue'

    export const Splide: DefineComponent<Record<string, unknown>, any, any>
    export const SplideSlide: DefineComponent<Record<string, unknown>, any, any>
    export const SplideTrack: DefineComponent<Record<string, unknown>, any, any>

    const plugin: (app: App) => void
    export default plugin
}