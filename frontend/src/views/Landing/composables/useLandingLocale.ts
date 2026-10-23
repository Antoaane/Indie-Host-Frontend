// File: src/views/Landing/composables/useLandingLocale.ts

import { computed, getCurrentScope, onScopeDispose, watchEffect } from 'vue'
import type { LandingContent } from '@/views/Landing/types/content'
import { clerkDocumentLang } from '@/locales/clerk'

import fr from '@/locales/landing/fr.json'
import en from '@/locales/landing/en.json'
import es from '@/locales/landing/es.json'
import de from '@/locales/landing/de.json'
import pt from '@/locales/landing/pt.json'
import zh from '@/locales/landing/zh.json'
import ja from '@/locales/landing/ja.json'

const SUPPORTED_LOCALES = ['fr', 'en', 'es', 'de', 'pt', 'zh', 'ja'] as const
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

const FALLBACK_LOCALE: SupportedLocale = 'en'

const LOCALE_CONTENT: Record<SupportedLocale, LandingContent> = {
  fr: fr as LandingContent,
  en: en as LandingContent,
  es: es as LandingContent,
  de: de as LandingContent,
  pt: pt as LandingContent,
  zh: zh as LandingContent,
  ja: ja as LandingContent,
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
  de: 'de',
  'de-DE': 'de',
  'de-AT': 'de',
  'de-CH': 'de',
  pt: 'pt',
  'pt-BR': 'pt',
  'pt-PT': 'pt',
  zh: 'zh',
  'zh-CN': 'zh',
  'zh-Hans': 'zh',
  'zh-TW': 'zh',
  'zh-Hant': 'zh',
  ja: 'ja',
  'ja-JP': 'ja',
}

function getBrowserLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return FALLBACK_LOCALE
  const lang = navigator.language ?? (navigator as Navigator & { userLanguage?: string }).userLanguage ?? ''
  const code = lang.split('-')[0].toLowerCase()
  return (localeMap[lang] ?? localeMap[code] ?? FALLBACK_LOCALE) as SupportedLocale
}

/** Contenu de la landing dans la langue du navigateur, sans effet de bord (hors composant). */
export function getLandingContent(): LandingContent {
  return LOCALE_CONTENT[getBrowserLocale()]
}

export function useLandingLocale() {
  const locale = computed<SupportedLocale>(() => getBrowserLocale())
  const content = computed<LandingContent>(() => LOCALE_CONTENT[locale.value])

  watchEffect(() => {
    if (typeof document !== 'undefined' && locale.value) {
      document.documentElement.lang = locale.value
    }
  })

  // Le reste de l'application est en français : on rétablit `lang` en quittant la landing.
  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (typeof document !== 'undefined') {
        document.documentElement.lang = clerkDocumentLang
      }
    })
  }

  return { content, locale }
}
