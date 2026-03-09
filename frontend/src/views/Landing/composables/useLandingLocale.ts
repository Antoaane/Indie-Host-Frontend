// File: src/views/Landing/composables/useLandingLocale.ts

import { computed, watchEffect } from 'vue'
import type { LandingContent } from '@/views/Landing/types/content'

import fr from '@/locales/landing/fr.json'
import en from '@/locales/landing/en.json'
import es from '@/locales/landing/es.json'

const SUPPORTED_LOCALES = ['fr', 'en', 'es'] as const
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

const FALLBACK_LOCALE: SupportedLocale = 'en'

const LOCALE_CONTENT: Record<SupportedLocale, LandingContent> = {
  fr: fr as LandingContent,
  en: en as LandingContent,
  es: es as LandingContent,
}

const localeMap: Record<string, SupportedLocale> = {
  fr: 'fr',
  'fr-FR': 'fr',
  'fr-CA': 'fr',
  en: 'en',
  'en-US': 'en',
  'en-GB': 'en',
  es: 'es',
  'es-ES': 'es',
  'es-MX': 'es',
  'es-AR': 'es',
}

function getBrowserLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return FALLBACK_LOCALE
  const lang = navigator.language ?? (navigator as Navigator & { userLanguage?: string }).userLanguage ?? ''
  const code = lang.split('-')[0].toLowerCase()
  return (localeMap[lang] ?? localeMap[code] ?? FALLBACK_LOCALE) as SupportedLocale
}

export function useLandingLocale() {
  const locale = computed<SupportedLocale>(() => getBrowserLocale())
  const content = computed<LandingContent>(() => LOCALE_CONTENT[locale.value])

  watchEffect(() => {
    if (typeof document !== 'undefined' && locale.value) {
      document.documentElement.lang = locale.value
    }
  })

  return { content, locale }
}
