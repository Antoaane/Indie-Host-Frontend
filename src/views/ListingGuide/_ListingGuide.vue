<!-- File: src/views/ListingGuide/_ListingGuide.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ShapesBgCroped from '@/components/svgs/images/ShapesBgCroped.vue'
import type { RawArrival, RawCore, RawHost } from '@/domain/listings/types'
import { vp } from '@/utils/viewport'
import { loadArrival, loadCore, loadHost } from '@/views/Listing/utils/fetchListingRaw'

type PracticalKey = keyof RawArrival['practical']
type PracticalTextKey = 'savings' | 'access' | 'services'
type PracticalFieldsEntry = {
  key: PracticalKey
  title: string
  subtitle: string
  emoji: string
  type: 'fields'
  fields: Array<{ label: string; value: string }>
}
type PracticalHtmlEntry = {
  key: PracticalKey
  title: string
  subtitle: string
  emoji: string
  type: 'html'
  html: string
}
type PracticalSectionEntry = PracticalFieldsEntry | PracticalHtmlEntry

const PRACTICAL_TITLE = 'Informations pratiques'
const PRACTICAL_DESCRIPTION = 'Des informations claires et rapides pour un séjour sans stress.'
const PRACTICAL_ORDER: PracticalKey[] = [
  'savings',
  'access',
  'services',
  'rules',
  'shops',
]

const PRACTICAL_FIELDS: Record<PracticalTextKey, Array<{ key: string; label: string }>> = {
  savings: [
    { key: 'message', label: 'Avantage principal' },
  ],
  access: [
    { key: 'address', label: 'Adresse' },
    { key: 'checkIn', label: 'Check-in' },
    { key: 'checkOut', label: 'Check-out' },
    { key: 'parking', label: 'Parking' },
  ],
  services: [
    { key: 'wifi', label: 'Wi-Fi' },
    { key: 'contacts', label: 'Numéros utiles' },
    { key: 'assistance', label: 'Assistance hôte' },
  ],
}

const PRACTICAL_META: Record<PracticalKey, { title: string; subtitle: string; emoji: string; type: 'fields' | 'html' }> = {
  savings: {
    title: 'Économisez sur vos voyages',
    subtitle: 'Bonnes pratiques pour réserver en direct.',
    emoji: '💡',
    type: 'fields',
  },
  access: {
    title: 'Adresse & accès',
    subtitle: 'Tout ce qu’il faut pour arriver sereinement.',
    emoji: '📍',
    type: 'fields',
  },
  services: {
    title: 'Connexion & services',
    subtitle: 'Infos Wi-Fi, contacts utiles et assistance.',
    emoji: '📶',
    type: 'fields',
  },
  rules: {
    title: 'Règles du séjour',
    subtitle: 'Rappels essentiels pour un séjour harmonieux.',
    emoji: '📝',
    type: 'html',
  },
  shops: {
    title: 'Commerces & marchés',
    subtitle: 'Où se ravitailler et découvrir les producteurs.',
    emoji: '🛍️',
    type: 'html',
  },
}

const route = useRoute()
const listingKey = computed(() => {
  const id = route.params.id
  if (typeof id === 'string' && id.trim()) return id.trim()
  if (Array.isArray(id) && id[0]?.trim()) return id[0].trim()
  return 'default-listing'
})

const rawArrival = ref<RawArrival | null>(null)
const rawCore = ref<RawCore | null>(null)
const rawHost = ref<RawHost | null>(null)
const isLoading = ref(false)

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function hasRichTextContent(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .length > 0
}

function buildDefaultArrival(core?: Partial<RawCore> | null, host?: Partial<RawHost> | null): RawArrival {
  const preciseAddress = cleanText(core?.precise_address)
  const city = cleanText(core?.city)
  const region = cleanText(core?.region)
  const country = cleanText(core?.country)
  const hostName = cleanText(host?.name)
  const locationLabel = [
    city,
    region,
    country,
  ].filter(Boolean).join(', ')
  const marketLabel = city ? `Marché de ${city}` : 'Marché local'

  return {
    intro: {
      title: hostName ? `Bienvenue chez ${hostName}` : 'Bienvenue',
      subtitle: city
        ? `Pour profiter des lieux au maximum, voici votre guide d’arrivée à ${city}.`
        : 'Pour profiter des lieux au maximum, voici votre guide d’arrivée.',
      tagline: 'Propulsé par IndieHost',
    },
    practical: {
      savings: {
        message: city
          ? `Réservez en direct pour profiter pleinement de votre séjour à ${city}.`
          : 'Réservez en direct pour éviter les commissions.',
      },
      access: {
        address: preciseAddress || (locationLabel
          ? `${locationLabel} (adresse complète envoyée 24h avant l’arrivée).`
          : 'Adresse complète envoyée 24h avant l’arrivée.'),
        checkIn: 'À partir de 16h — arrivée autonome possible.',
        checkOut: 'Avant 11h — merci de laisser les clés au point indiqué.',
        parking: 'Gratuit sur place (1 à 2 véhicules).',
      },
      services: {
        wifi: 'Nom du réseau et mot de passe disponibles sur place.',
        contacts: 'Urgences 112 · Médecin 15 · Police 17.',
        assistance: hostName
          ? `${hostName} reste disponible de 9h à 21h par message.`
          : 'Assistance hôte disponible de 9h à 21h par message.',
      },
      rules: `
        <ul>
          <li><strong>Respect de la nature</strong> — merci de ne rien laisser sur place et de trier vos déchets.</li>
          <li><strong>Silence</strong> — après 22h, merci de préserver la quiétude des lieux.</li>
          <li><strong>Départ</strong> — laissez le logement dans l’état trouvé et fermez bien.</li>
        </ul>
      `,
      shops: `
        <ul>
          <li><strong>Épicerie</strong> — à 10 minutes en voiture (produits frais et locaux).</li>
          <li><strong>${marketLabel}</strong> — horaires à vérifier selon la saison.</li>
        </ul>
      `,
    },
    guide: {
      title: '',
      content: '',
    },
  }
}

function mergeArrival(base: RawArrival, override?: Partial<RawArrival> | null): RawArrival {
  if (!override) return base

  const mergeDeep = (target: any, source: any): any => {
    if (source === null || source === undefined) return source
    if (Array.isArray(source)) return source
    if (typeof source !== 'object') return source

    const baseValue = target && typeof target === 'object' && !Array.isArray(target) ? target : {}
    const merged: Record<string, any> = { ...baseValue }

    Object.entries(source as Record<string, any>).forEach(
      ([
        key,
        value,
      ]) => {
        if (Array.isArray(value) || value === null || typeof value !== 'object') {
          merged[key] = value
        } else {
          merged[key] = mergeDeep(baseValue[key], value)
        }
      },
    )

    return merged
  }

  return mergeDeep(base, override) as RawArrival
}

const arrivalContent = computed(() => {
  const merged = mergeArrival(buildDefaultArrival(rawCore.value, rawHost.value), rawArrival.value)
  const forcedAddress = cleanText(rawCore.value?.precise_address)
  if (!forcedAddress) return merged

  return {
    ...merged,
    practical: {
      ...(merged.practical ?? {}),
      access: {
        ...(merged.practical?.access ?? {}),
        address: forcedAddress,
      },
    },
  }
})
const practicalSections = computed<PracticalSectionEntry[]>(() => {
  return PRACTICAL_ORDER.map((key) => {
    const meta = PRACTICAL_META[key]
    if (meta.type === 'fields') {
      const fields = PRACTICAL_FIELDS[key as PracticalTextKey] ?? []
      const values = (arrivalContent.value.practical?.[key] ?? {}) as Record<string, string>

      return {
        key,
        title: meta.title,
        subtitle: meta.subtitle,
        emoji: meta.emoji,
        type: 'fields',
        fields: fields.map((field) => ({
          label: field.label,
          value: values[field.key] ?? '',
        })),
      }
    }

    return {
      key,
      title: meta.title,
      subtitle: meta.subtitle,
      emoji: meta.emoji,
      type: 'html',
      html: (arrivalContent.value.practical?.[key] ?? '') as string,
    }
  })
})
const hasGuideContent = computed(() => hasRichTextContent(arrivalContent.value.guide?.content ?? ''))
const hasGuideSection = computed(() => Boolean(cleanText(arrivalContent.value.guide?.title ?? '') || hasGuideContent.value))
const guideSectionTitle = computed(() => cleanText(arrivalContent.value.guide?.title ?? '') || 'Guide touristique')

const isDesktop = computed(() => vp.xl.value)

watch(
  listingKey,
  async () => {
    isLoading.value = true
    try {
      const [
        arrival,
        core,
        host,
      ] = await Promise.all([
        loadArrival(listingKey.value),
        loadCore(listingKey.value),
        loadHost(listingKey.value),
      ])
      rawArrival.value = arrival
      rawCore.value = core
      rawHost.value = host
    } finally {
      isLoading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <main
    id="listing-guide"
    class="listing-guide"
  >
    <template v-if="isDesktop">
      <div class="guide-desktop">
        <h1>Guide d’arrivée mobile</h1>
        <p>Cette page est optimisée pour une consultation mobile.</p>
      </div>
    </template>

    <template v-else>
      <section class="guide-hero">
        <ShapesBgCroped
          class="shapes-bg"
          title="Décoration du fond"
          desc="Formes géométriques décoratives"
        />
        <div class="hero-content">
          <p class="hero-eyebrow">{{ arrivalContent.intro.title }}</p>
          <h1 class="hero-title">{{ arrivalContent.intro.subtitle }}</h1>
          <p class="hero-tagline">{{ arrivalContent.intro.tagline }}</p>
        </div>
      </section>

      <section class="guide-body">
        <div class="section-header">
          <h2>{{ PRACTICAL_TITLE }}</h2>
          <p>{{ PRACTICAL_DESCRIPTION }}</p>
        </div>

        <div class="section-grid">
          <article
            v-for="entry in practicalSections"
            :key="entry.key"
            class="guide-panel"
          >
            <div class="panel-header">
              <span
                v-if="entry.emoji"
                class="panel-emoji"
                >{{ entry.emoji }}</span
              >
              <div>
                <h3>{{ entry.title }}</h3>
                <p v-if="entry.subtitle">{{ entry.subtitle }}</p>
              </div>
            </div>
            <template v-if="entry.type === 'fields'">
              <ul class="panel-items">
                <li
                  v-for="field in entry.fields"
                  :key="field.label"
                >
                  <span class="item-label">{{ field.label }}</span>
                  <span
                    v-if="field.value"
                    class="item-value"
                    >{{ field.value }}</span
                  >
                  <span
                    v-else
                    class="item-value is-empty"
                    >Informations à venir.</span
                  >
                </li>
              </ul>
            </template>
            <template v-else>
              <div
                v-if="entry.html"
                class="panel-html"
                v-html="entry.html"
              />
              <p
                v-else
                class="panel-text is-empty"
                >Informations à venir.</p
              >
            </template>
          </article>
        </div>

        <template v-if="hasGuideSection">
          <div class="section-header is-local">
            <h2>{{ guideSectionTitle }}</h2>
            <p>L’inspiration de votre hôte pour découvrir les environs.</p>
          </div>

          <article class="guide-panel guide-panel--editorial">
            <div
              v-if="hasGuideContent"
              class="panel-editorial"
              v-html="arrivalContent.guide.content"
            />
            <p
              v-else
              class="panel-text is-empty"
              >Informations à venir.</p
            >
          </article>
        </template>
      </section>

      <div
        v-if="isLoading"
        class="guide-loading"
      >
        Chargement…
      </div>
    </template>
  </main>
</template>

<style lang="scss">
@use '@/views/ListingGuide/listing-guide.scss';
</style>
