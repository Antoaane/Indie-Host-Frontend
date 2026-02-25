// File: env.d.ts

/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_LISTINGS_DATA_MODE?: 'local-json' | 'api' | string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_PROXY_TARGET?: string
  readonly VITE_IN_DEV_UTILITIES_ENABLED?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  readonly VITE_STRIPE_API_BASE_URL?: string
  readonly VITE_STRIPE_PAYMENT_INTENT_PATH?: string
  readonly VITE_STRIPE_PAYMENT_RETURN_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
