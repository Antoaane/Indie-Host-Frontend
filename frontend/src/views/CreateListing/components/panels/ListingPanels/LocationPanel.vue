<!-- File: src/views/CreateListing/components/panels/ListingPanels/LocationPanel.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { MapPin } from 'lucide-vue-next'

import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import {
  formatValidationMessage,
  normalizeTextInput,
  resolveTextMaxLength,
  shouldDisplayTextLimit,
} from '@/utils/inputValidation'

const props = withDefaults(defineProps<{
  core?: Partial<RawCore> | null
  requirePreciseAddress?: boolean
}>(), {
  requirePreciseAddress: false,
})

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const panelContent = editorStatic.panels.listing.location
const locationValidation = editorStatic.validation.listing.location
const textDefaults = editorStatic.validation.defaults.simpleText
const CUSTOM_HOUSING_TYPE_VALUE = '__custom__'
const housingTypeOptions = ['Appartement', "Chambre d'hôtel", 'Chambre de gîte', 'Maison', 'Villa', 'Studio', 'Loft', 'Chalet', 'Cabane', 'Péniche']
const locationLimits = {
  type: resolveTextMaxLength(locationValidation.typeMax, textDefaults),
  preciseAddress: resolveTextMaxLength(locationValidation.preciseAddressMax, textDefaults),
  city: resolveTextMaxLength(locationValidation.cityMax, textDefaults),
  country: resolveTextMaxLength(locationValidation.countryMax, textDefaults),
  region: resolveTextMaxLength(locationValidation.regionMax, textDefaults),
}

const isResolvingAddress = ref(false)
const addressResolveError = ref('')
const hasResolvedAddress = ref(false)
const lastResolvedAddress = ref('')
const isCustomTypeSelected = ref(false)

// --- Autocomplete state ---
const addressSuggestions = ref<AddressSuggestion[]>([])
const showSuggestions = ref(false)
const activeSuggestionIndex = ref(-1)
let suggestionDebounceTimer: ReturnType<typeof setTimeout> | null = null
const SUGGESTION_MIN_CHARS = 3
const SUGGESTION_DEBOUNCE_MS = 350

// Type unifié pour les suggestions (BAN + Photon)
type AddressSuggestion = {
  mainLabel: string
  subLabel: string
  formattedAddress: string
  city: string
  region: string
  country: string
  lat: number
  lng: number
}

// Types BAN (api-adresse.data.gouv.fr)
type BANProperties = {
  label: string
  name: string
  postcode: string
  city: string
  context: string
  housenumber?: string
  street?: string
  type: string
}
type BANFeature = {
  geometry: { coordinates: [number, number] }
  properties: BANProperties
}
type BANResponse = { features: BANFeature[] }

// Types Photon (photon.komoot.io)
type PhotonProperties = {
  name?: string
  housenumber?: string
  street?: string
  city?: string
  town?: string
  village?: string
  postcode?: string
  state?: string
  county?: string
  country?: string
}
type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: PhotonProperties
}
type PhotonResponse = { features: PhotonFeature[] }

// --- Computed ---
const typeValue = computed(() => String(props.core?.type ?? ''))
const preciseAddressRaw = computed(() => String(props.core?.precise_address ?? ''))
const cityValue = computed(() => String(props.core?.city ?? ''))
const countryValue = computed(() => String(props.core?.country ?? ''))
const regionValue = computed(() => String(props.core?.region ?? ''))
const preciseAddress = computed(() => preciseAddressRaw.value.trim())
const selectedHousingType = computed(() => {
  if (isCustomTypeSelected.value) return CUSTOM_HOUSING_TYPE_VALUE
  const currentType = typeValue.value.trim()
  if (!currentType) return ''
  return housingTypeOptions.includes(currentType) ? currentType : CUSTOM_HOUSING_TYPE_VALUE
})
const shouldShowCustomTypeInput = computed(() => selectedHousingType.value === CUSTOM_HOUSING_TYPE_VALUE)

watch(typeValue, (nextType) => {
  const normalizedType = nextType.trim()
  if (!normalizedType) return
  if (housingTypeOptions.includes(normalizedType)) { isCustomTypeSelected.value = false; return }
  isCustomTypeSelected.value = true
}, { immediate: true })

const geocodeQueryMinLength = locationValidation.geocodeQueryMinLength
const mapLatitude = computed(() => {
  const value = Number(props.core?.latitude ?? props.core?.lat)
  return Number.isFinite(value) ? value : null
})
const mapLongitude = computed(() => {
  const value = Number(props.core?.longitude ?? props.core?.lng)
  return Number.isFinite(value) ? value : null
})
const mapZoom = computed(() => {
  const value = Number(props.core?.zoom)
  return Number.isFinite(value) && value > 0 ? value : 13
})
const mapPreviewSrc = computed(() => {
  if (mapLatitude.value === null || mapLongitude.value === null) return ''
  return `https://www.google.com/maps?hl=fr&ll=${mapLatitude.value},${mapLongitude.value}&z=${mapZoom.value}&output=embed`
})
const preciseAddressLengthError = computed(() => {
  if (!props.requirePreciseAddress || !preciseAddress.value) return ''
  if (preciseAddress.value.length < geocodeQueryMinLength) {
    return formatValidationMessage(locationValidation.messages.geocodeMin, { min: geocodeQueryMinLength })
  }
  return ''
})

// --- Helpers ---
function patchCore(patch: Partial<RawCore>) { emit('patch', { core: patch }) }
function inputValue(event: Event) { return (event.target as HTMLInputElement).value }
function selectValue(event: Event) { return (event.target as HTMLSelectElement).value }
function fieldLength(value: string, max: number) { return Math.min(value.length, max) }

const typeLength = computed(() => fieldLength(typeValue.value, locationLimits.type))
const preciseAddressLength = computed(() => fieldLength(preciseAddressRaw.value, locationLimits.preciseAddress))
const cityLength = computed(() => fieldLength(cityValue.value, locationLimits.city))
const countryLength = computed(() => fieldLength(countryValue.value, locationLimits.country))
const regionLength = computed(() => fieldLength(regionValue.value, locationLimits.region))

function fieldCounter(current: number, max: number) {
  return formatValidationMessage(locationValidation.messages.counter, { current, max })
}
function shouldShowFieldCounter(max: number) { return shouldDisplayTextLimit(max, textDefaults) }

function patchTextField<K extends keyof RawCore>(key: K, rawValue: string, maxLength: number) {
  const next = normalizeTextInput(rawValue, maxLength)
  if (next === String(props.core?.[key] ?? '')) return
  patchCore({ [key]: next } as Partial<RawCore>)
}

function onHousingTypeChange(event: Event) {
  const nextValue = selectValue(event)
  if (nextValue === CUSTOM_HOUSING_TYPE_VALUE) {
    isCustomTypeSelected.value = true
    if (housingTypeOptions.includes(typeValue.value.trim())) patchCore({ type: '' })
    return
  }
  isCustomTypeSelected.value = false
  patchTextField('type', nextValue, locationLimits.type)
}

// --- Normalisation BAN → AddressSuggestion ---
function banToSuggestion(f: BANFeature): AddressSuggestion {
  const p = f.properties
  const [lng, lat] = f.geometry.coordinates
  // context = "75, Paris, Île-de-France" — la région est au 3e segment
  const contextParts = p.context.split(', ')
  const region = contextParts[2] ?? contextParts[1] ?? ''
  return {
    mainLabel: p.name,            // inclut le numéro de rue : "12 Rue de la Paix"
    subLabel: `${p.postcode} ${p.city}`,
    formattedAddress: p.label,    // "12 Rue de la Paix 75001 Paris"
    city: p.city,
    region,
    country: 'France',
    lat,
    lng,
  }
}

// --- Normalisation Photon → AddressSuggestion ---
function photonToSuggestion(f: PhotonFeature): AddressSuggestion {
  const p = f.properties
  const [lng, lat] = f.geometry.coordinates
  let main = ''
  if (p.housenumber && p.street) main = `${p.housenumber} ${p.street}`
  else if (p.street) main = p.street
  else if (p.name) main = p.name
  const city = p.city ?? p.town ?? p.village ?? ''
  const sub = [p.postcode, city, p.country].filter(Boolean).join(', ')
  const formatted = [main, p.postcode && city ? `${p.postcode} ${city}` : city, p.country].filter(Boolean).join(', ')
  return {
    mainLabel: main || city,
    subLabel: sub,
    formattedAddress: formatted,
    city,
    region: p.state ?? p.county ?? '',
    country: p.country ?? '',
    lat,
    lng,
  }
}

// --- Autocomplete : BAN prioritaire, Photon en fallback international ---
function clearSuggestions() {
  addressSuggestions.value = []
  showSuggestions.value = false
  activeSuggestionIndex.value = -1
}

async function fetchSuggestions(query: string) {
  if (query.trim().length < SUGGESTION_MIN_CHARS) { clearSuggestions(); return }
  try {
    // 1. Base Adresse Nationale (France — numéros de rue systématiques)
    const banParams = new URLSearchParams({ q: query, limit: '5' })
    const banRes = await fetch(`https://api-adresse.data.gouv.fr/search/?${banParams.toString()}`)
    if (banRes.ok) {
      const banData = (await banRes.json()) as BANResponse
      if (Array.isArray(banData.features) && banData.features.length > 0) {
        addressSuggestions.value = banData.features.map(banToSuggestion)
        showSuggestions.value = true
        activeSuggestionIndex.value = -1
        return
      }
    }
    // 2. Fallback Photon pour les adresses hors France
    const photonParams = new URLSearchParams({ q: query, limit: '5', lang: 'fr' })
    const photonRes = await fetch(`https://photon.komoot.io/api/?${photonParams.toString()}`)
    if (photonRes.ok) {
      const photonData = (await photonRes.json()) as PhotonResponse
      if (Array.isArray(photonData.features) && photonData.features.length > 0) {
        addressSuggestions.value = photonData.features.map(photonToSuggestion)
        showSuggestions.value = true
        activeSuggestionIndex.value = -1
        return
      }
    }
    clearSuggestions()
  } catch {
    clearSuggestions()
  }
}

function debouncedFetchSuggestions(query: string) {
  if (suggestionDebounceTimer) clearTimeout(suggestionDebounceTimer)
  if (query.trim().length < SUGGESTION_MIN_CHARS) { clearSuggestions(); return }
  suggestionDebounceTimer = setTimeout(() => fetchSuggestions(query), SUGGESTION_DEBOUNCE_MS)
}

function selectSuggestion(suggestion: AddressSuggestion) {
  patchCore({
    precise_address: suggestion.formattedAddress,
    city: suggestion.city,
    region: suggestion.region,
    country: suggestion.country,
    latitude: suggestion.lat,
    longitude: suggestion.lng,
    lat: suggestion.lat,
    lng: suggestion.lng,
    zoom: 15,
  })
  hasResolvedAddress.value = !!(suggestion.city && suggestion.region && suggestion.country)
  lastResolvedAddress.value = suggestion.formattedAddress.trim()
  addressResolveError.value = ''
  clearSuggestions()
}

// --- Géocodage de secours (saisie manuelle sans sélection dans le dropdown) ---
async function resolvePreciseAddress(rawAddress?: string) {
  const address = (rawAddress ?? preciseAddress.value).trim()
  if (!props.requirePreciseAddress || address.length < geocodeQueryMinLength) return
  if (isResolvingAddress.value) return
  isResolvingAddress.value = true
  addressResolveError.value = ''
  try {
    // BAN en priorité
    const banParams = new URLSearchParams({ q: address, limit: '1' })
    const banRes = await fetch(`https://api-adresse.data.gouv.fr/search/?${banParams.toString()}`)
    if (banRes.ok) {
      const banData = (await banRes.json()) as BANResponse
      const feature = banData.features?.[0]
      if (feature) {
        const s = banToSuggestion(feature)
        patchCore({ city: s.city, region: s.region, country: s.country, latitude: s.lat, longitude: s.lng, lat: s.lat, lng: s.lng, zoom: 13 })
        hasResolvedAddress.value = !!(s.city && s.region)
        lastResolvedAddress.value = address
        if (!s.city || !s.region) addressResolveError.value = panelContent.feedback.partial
        return
      }
    }
    // Fallback Photon
    const photonParams = new URLSearchParams({ q: address, limit: '1', lang: 'fr' })
    const photonRes = await fetch(`https://photon.komoot.io/api/?${photonParams.toString()}`)
    if (!photonRes.ok) throw new Error()
    const photonData = (await photonRes.json()) as PhotonResponse
    const feature = photonData.features?.[0]
    if (!feature) {
      hasResolvedAddress.value = false
      addressResolveError.value = panelContent.feedback.notFound
      return
    }
    const s = photonToSuggestion(feature)
    patchCore({ city: s.city, region: s.region, country: s.country, latitude: s.lat, longitude: s.lng, lat: s.lat, lng: s.lng, zoom: 13 })
    hasResolvedAddress.value = !!(s.city && s.region && s.country)
    lastResolvedAddress.value = address
    if (!s.city || !s.region || !s.country) addressResolveError.value = panelContent.feedback.partial
  } catch {
    hasResolvedAddress.value = false
    addressResolveError.value = panelContent.feedback.resolveError
  } finally {
    isResolvingAddress.value = false
  }
}

async function maybeResolvePreciseAddress(rawAddress?: string) {
  if (!props.requirePreciseAddress) return
  const next = (rawAddress ?? preciseAddress.value).trim()
  if (!next || next === lastResolvedAddress.value) return
  await resolvePreciseAddress(next)
}

// --- Handlers ---
function onPreciseAddressInput(event: Event) {
  const value = normalizeTextInput(inputValue(event), locationLimits.preciseAddress)
  patchTextField('precise_address', value, locationLimits.preciseAddress)
  addressResolveError.value = ''
  if (value.trim() !== lastResolvedAddress.value) hasResolvedAddress.value = false
  debouncedFetchSuggestions(value)
}

function onAddressBlur(event: FocusEvent) {
  setTimeout(() => {
    clearSuggestions()
    void maybeResolvePreciseAddress((event.target as HTMLInputElement).value)
  }, 180)
}

function onAddressKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    if (!showSuggestions.value) return
    event.preventDefault()
    activeSuggestionIndex.value = Math.min(activeSuggestionIndex.value + 1, addressSuggestions.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    if (!showSuggestions.value) return
    event.preventDefault()
    activeSuggestionIndex.value = Math.max(activeSuggestionIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (showSuggestions.value && activeSuggestionIndex.value >= 0) {
      selectSuggestion(addressSuggestions.value[activeSuggestionIndex.value])
    } else {
      clearSuggestions()
      void resolvePreciseAddress((event.target as HTMLInputElement).value)
    }
  } else if (event.key === 'Escape') {
    clearSuggestions()
  }
}

onBeforeUnmount(() => {
  if (suggestionDebounceTimer) clearTimeout(suggestionDebounceTimer)
})
</script>

<template>
  <section class="create-location-panel">
    <div class="header">
      <h2>{{ panelContent.title }}</h2>
      <h3>{{ panelContent.subtitle }}</h3>
    </div>

    <div class="body">
      <!-- Type de logement -->
      <div class="field">
        <div class="input">
          <select :value="selectedHousingType" @change="onHousingTypeChange">
            <option value="">{{ panelContent.placeholders.type }}</option>
            <option v-for="option in housingTypeOptions" :key="option" :value="option">{{ option }}</option>
            <option :value="CUSTOM_HOUSING_TYPE_VALUE">Autre</option>
          </select>
        </div>
      </div>

      <div v-if="shouldShowCustomTypeInput" class="field">
        <div class="input">
          <input
            :value="typeValue"
            type="text"
            :placeholder="panelContent.placeholders.customType"
            :maxlength="locationLimits.type"
            autocomplete="off"
            inputmode="text"
            @input="patchTextField('type', inputValue($event), locationLimits.type)"
          />
        </div>
        <p v-if="shouldShowFieldCounter(locationLimits.type)" class="meta">
          {{ fieldCounter(typeLength, locationLimits.type) }}
        </p>
      </div>

      <!-- Adresse précise avec autocomplete -->
      <div v-if="props.requirePreciseAddress" class="field">
        <div class="address-autocomplete">
          <div class="input">
            <input
              :value="preciseAddressRaw"
              type="text"
              :placeholder="panelContent.placeholders.preciseAddress"
              :maxlength="locationLimits.preciseAddress"
              autocomplete="off"
              inputmode="text"
              :aria-invalid="Boolean(preciseAddressLengthError || addressResolveError)"
              :aria-expanded="showSuggestions"
              aria-autocomplete="list"
              role="combobox"
              @input="onPreciseAddressInput"
              @blur="onAddressBlur"
              @keydown="onAddressKeydown"
            />
          </div>

          <ul
            v-if="showSuggestions && addressSuggestions.length > 0"
            class="address-suggestions"
            role="listbox"
          >
            <li
              v-for="(suggestion, index) in addressSuggestions"
              :key="index"
              class="suggestion-item"
              :class="{ 'is-active': activeSuggestionIndex === index }"
              role="option"
              :aria-selected="activeSuggestionIndex === index"
              @mousedown.prevent="selectSuggestion(suggestion)"
            >
              <MapPin :size="13" class="suggestion-icon" />
              <div class="suggestion-content">
                <span class="suggestion-main">{{ suggestion.mainLabel }}</span>
                <span v-if="suggestion.subLabel" class="suggestion-sub">{{ suggestion.subLabel }}</span>
              </div>
            </li>
          </ul>
        </div>

        <p v-if="isResolvingAddress" class="feedback is-loading">{{ panelContent.states.resolving }}</p>
        <p v-else-if="preciseAddressLengthError && !addressResolveError" class="feedback is-error">{{ preciseAddressLengthError }}</p>
        <p v-else-if="addressResolveError" class="feedback is-error">{{ addressResolveError }}</p>
        <p v-else-if="hasResolvedAddress" class="feedback is-success">{{ panelContent.feedback.resolved }}</p>

        <p v-if="shouldShowFieldCounter(locationLimits.preciseAddress)" class="meta">
          {{ fieldCounter(preciseAddressLength, locationLimits.preciseAddress) }}
        </p>
      </div>

      <!-- Ville / Pays -->
      <div class="row">
        <div class="field">
          <div class="input">
            <input
              :value="cityValue"
              type="text"
              :placeholder="panelContent.placeholders.city"
              :maxlength="locationLimits.city"
              autocomplete="address-level2"
              inputmode="text"
              @input="patchTextField('city', inputValue($event), locationLimits.city)"
            />
          </div>
          <p v-if="shouldShowFieldCounter(locationLimits.city)" class="meta">
            {{ fieldCounter(cityLength, locationLimits.city) }}
          </p>
        </div>
        <div class="field">
          <div class="input">
            <input
              :value="countryValue"
              type="text"
              :placeholder="panelContent.placeholders.country"
              :maxlength="locationLimits.country"
              autocomplete="country-name"
              inputmode="text"
              @input="patchTextField('country', inputValue($event), locationLimits.country)"
            />
          </div>
          <p v-if="shouldShowFieldCounter(locationLimits.country)" class="meta">
            {{ fieldCounter(countryLength, locationLimits.country) }}
          </p>
        </div>
      </div>

      <!-- Région -->
      <div class="field">
        <div class="input">
          <input
            :value="regionValue"
            type="text"
            :placeholder="panelContent.placeholders.region"
            :maxlength="locationLimits.region"
            autocomplete="address-level1"
            inputmode="text"
            @input="patchTextField('region', inputValue($event), locationLimits.region)"
          />
        </div>
        <p v-if="shouldShowFieldCounter(locationLimits.region)" class="meta">
          {{ fieldCounter(regionLength, locationLimits.region) }}
        </p>
      </div>

      <!-- Aperçu carte -->
      <div v-if="mapPreviewSrc" class="map-preview">
        <iframe
          class="frame"
          :src="mapPreviewSrc"
          title="Aperçu de localisation sur Google Maps"
          allowfullscreen
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/inputs' as inputs;
@use '@/views/CreateListing/components/panels/panel.scss' as *;

.create-location-panel {
  @extend %panel;

  > .header { @extend %panel-header; }

  > .body {
    @extend %panel-body;

    > .field {
      display: flex;
      flex-direction: column;
      gap: calc(var(--layout-gap-xs) / 2);

      > .input { @include inputs.field($theme: base); }

      > .meta {
        margin: 0;
        @include little-text($thin: true);
        color: rgba($secondary-text, 0.58);
      }

      > .feedback {
        margin: 0;
        @include little-text($thin: false);
        &.is-error { color: $bad; }
        &.is-success { color: $good; }
        &.is-loading { color: rgba($secondary-text, 0.55); }
      }

      > .address-autocomplete {
        position: relative;

        > .input { @include inputs.field($theme: base); }

        > .address-suggestions {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 200;
          list-style: none;
          margin: 0;
          padding: 0.3rem 0;
          background: $accent;
          border: 1px solid rgba($secondary, 0.1);
          border-radius: borders.$rounded-md;
          box-shadow: 0 6px 20px rgba($secondary, 0.1), 0 1px 4px rgba($secondary, 0.06);
          max-height: 260px;
          overflow-y: auto;

          > .suggestion-item {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            padding: 0.6rem 0.75rem;
            cursor: pointer;
            transition: background 120ms ease;

            &:hover, &.is-active { background: rgba($secondary, 0.05); }

            > .suggestion-icon {
              flex-shrink: 0;
              margin-top: 3px;
              color: rgba($secondary-text, 0.3);
            }

            > .suggestion-content {
              display: flex;
              flex-direction: column;
              gap: 0.1rem;
              min-width: 0;

              > .suggestion-main {
                @include little-text($thin: false);
                color: $secondary-text;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }

              > .suggestion-sub {
                @include little-text($thin: true);
                color: rgba($secondary-text, 0.5);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
            }
          }
        }
      }
    }

    > .row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--layout-gap-xs);

      > .field {
        display: flex;
        flex-direction: column;
        gap: calc(var(--layout-gap-xs) / 2);

        > .input { @include inputs.field($theme: base); }

        > .meta {
          margin: 0;
          @include little-text($thin: true);
          color: rgba($secondary-text, 0.58);
        }
      }
    }

    > .map-preview {
      border: 1px solid rgba($secondary, 0.12);
      border-radius: borders.$rounded-md;
      overflow: hidden;

      > .frame {
        width: 100%;
        max-width: 100%;
        display: block;
        height: 220px;
        border: 0;
        pointer-events: auto;
        touch-action: pan-x pan-y;
        overscroll-behavior: contain;
      }
    }
  }
}
</style>
