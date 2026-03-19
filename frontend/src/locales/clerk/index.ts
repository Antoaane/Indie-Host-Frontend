// File: src/locales/clerk/index.ts

import type { LocalizationResource } from '@clerk/shared/types'

import { clerkFrBase } from '@/locales/clerk/base/fr'
import localeConfig from '@/locales/clerk/config.json'
import frOverrides from '@/locales/clerk/fr.json'

const SUPPORTED_CLERK_LOCALES = ['fr'] as const

export type ClerkLocale = (typeof SUPPORTED_CLERK_LOCALES)[number]

type ClerkLocaleConfig = {
  defaultLocale?: string
  fallbackLocale?: string
  useBrowserLocale?: boolean
}

const config: ClerkLocaleConfig = localeConfig as ClerkLocaleConfig

const BUILT_IN_LOCALIZATIONS: Record<ClerkLocale, LocalizationResource> = {
  fr: clerkFrBase,
}

const HTML_LANG_BY_LOCALE: Record<ClerkLocale, string> = {
  fr: 'fr',
}

const LOCALE_ALIASES: Record<string, ClerkLocale> = {
  fr: 'fr',
  'fr-fr': 'fr',
  'fr-ca': 'fr',
}

const MANUAL_OVERRIDES_BY_LOCALE: Partial<Record<ClerkLocale, LocalizationResource>> = {
  fr: frOverrides as LocalizationResource,
}

function normalizeLocale(value: unknown): ClerkLocale | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null

  const languageOnly = normalized.split('-')[0]
  return LOCALE_ALIASES[normalized] ?? LOCALE_ALIASES[languageOnly] ?? null
}

function readBrowserLocale(): ClerkLocale | null {
  if (typeof navigator === 'undefined') return null
  const language = navigator.language ?? (navigator as Navigator & { userLanguage?: string }).userLanguage ?? ''
  return normalizeLocale(language)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergePlainObjects(base: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base }

  for (const [key, overrideValue] of Object.entries(overrides)) {
    const baseValue = merged[key]
    if (isRecord(baseValue) && isRecord(overrideValue)) {
      merged[key] = mergePlainObjects(baseValue, overrideValue)
      continue
    }
    merged[key] = overrideValue
  }

  return merged
}

function mergeLocalization(base: LocalizationResource, overrides?: LocalizationResource): LocalizationResource {
  if (!overrides || !isRecord(overrides) || Object.keys(overrides).length === 0) return base
  return mergePlainObjects(base as Record<string, unknown>, overrides as Record<string, unknown>) as LocalizationResource
}

const configuredFallbackLocale = normalizeLocale(config.fallbackLocale) ?? 'fr'
const configuredDefaultLocale = normalizeLocale(config.defaultLocale) ?? configuredFallbackLocale
const useBrowserLocale = config.useBrowserLocale === true

export const clerkLocale: ClerkLocale =
  (useBrowserLocale ? readBrowserLocale() : null) ?? configuredDefaultLocale

export const clerkLocalization: LocalizationResource = mergeLocalization(
  BUILT_IN_LOCALIZATIONS[clerkLocale] ?? BUILT_IN_LOCALIZATIONS[configuredFallbackLocale],
  MANUAL_OVERRIDES_BY_LOCALE[clerkLocale],
)

export const clerkDocumentLang = HTML_LANG_BY_LOCALE[clerkLocale] ?? 'fr'
