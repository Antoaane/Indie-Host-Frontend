<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/LocationPanel.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'

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

const typeValue = computed(() => String(props.core?.type ?? ''))
const preciseAddressRaw = computed(() => String(props.core?.precise_address ?? ''))
const cityValue = computed(() => String(props.core?.city ?? ''))
const countryValue = computed(() => String(props.core?.country ?? ''))
const regionValue = computed(() => String(props.core?.region ?? ''))
const preciseAddress = computed(() => normalizeAddress(preciseAddressRaw.value))

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

type NominatimAddress = {
  city?: string
  town?: string
  village?: string
  municipality?: string
  hamlet?: string
  county?: string
  state?: string
  region?: string
  country?: string
}

type NominatimResult = {
  lat?: string
  lon?: string
  address?: NominatimAddress
}

function patchCore(patch: Partial<RawCore>) {
  emit('patch', { core: patch })
}

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function fieldLength(value: string, max: number): number {
  return Math.min(value.length, max)
}

const typeLength = computed(() => fieldLength(typeValue.value, locationLimits.type))
const preciseAddressLength = computed(() => fieldLength(preciseAddressRaw.value, locationLimits.preciseAddress))
const cityLength = computed(() => fieldLength(cityValue.value, locationLimits.city))
const countryLength = computed(() => fieldLength(countryValue.value, locationLimits.country))
const regionLength = computed(() => fieldLength(regionValue.value, locationLimits.region))
const preciseAddressLengthError = computed(() => {
  if (!props.requirePreciseAddress) return ''
  if (!preciseAddress.value) return ''
  if (preciseAddress.value.length < geocodeQueryMinLength) {
    return formatValidationMessage(locationValidation.messages.geocodeMin, { min: geocodeQueryMinLength })
  }
  return ''
})

function fieldCounter(current: number, max: number): string {
  return formatValidationMessage(locationValidation.messages.counter, { current, max })
}

function shouldShowFieldCounter(max: number): boolean {
  return shouldDisplayTextLimit(max, textDefaults)
}

function patchTextField<K extends keyof RawCore>(key: K, rawValue: string, maxLength: number) {
  const next = normalizeTextInput(rawValue, maxLength)
  const current = String(props.core?.[key] ?? '')
  if (next === current) return
  patchCore({ [key]: next } as Partial<RawCore>)
}

function pickAddressValue(address: NominatimAddress | undefined, keys: Array<keyof NominatimAddress>): string {
  if (!address) return ''
  for (const key of keys) {
    const value = address[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function onPreciseAddressInput(event: Event) {
  const value = normalizeTextInput(inputValue(event), locationLimits.preciseAddress)
  patchTextField('precise_address', value, locationLimits.preciseAddress)
  addressResolveError.value = ''

  if (normalizeAddress(value) !== lastResolvedAddress.value) {
    hasResolvedAddress.value = false
  }
}

function normalizeAddress(value: string): string {
  return value.trim()
}

async function resolvePreciseAddress(rawAddress?: string) {
  const address = normalizeAddress(rawAddress ?? preciseAddress.value)
  if (!props.requirePreciseAddress || address.length < geocodeQueryMinLength) return
  if (isResolvingAddress.value) return

  isResolvingAddress.value = true
  addressResolveError.value = ''

  try {
    const params = new URLSearchParams({
      q: address,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '1',
      'accept-language': 'fr',
    })

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(panelContent.feedback.resolveError)
    }

    const payload = (await response.json()) as NominatimResult[]
    const first = Array.isArray(payload) ? payload[0] : null
    if (!first) {
      hasResolvedAddress.value = false
      addressResolveError.value = panelContent.feedback.notFound
      return
    }

    const city = pickAddressValue(first.address, ['city', 'town', 'village', 'municipality', 'hamlet'])
    const region = pickAddressValue(first.address, ['state', 'region', 'county'])
    const country = pickAddressValue(first.address, ['country'])

    const latitude = Number(first.lat)
    const longitude = Number(first.lon)
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)

    patchCore({
      city,
      region,
      country,
      latitude: hasCoordinates ? latitude : undefined,
      longitude: hasCoordinates ? longitude : undefined,
      lat: hasCoordinates ? latitude : undefined,
      lng: hasCoordinates ? longitude : undefined,
      zoom: hasCoordinates ? 13 : undefined,
    })

    if (!city || !region || !country) {
      hasResolvedAddress.value = false
      addressResolveError.value = panelContent.feedback.partial
      return
    }

    hasResolvedAddress.value = true
    lastResolvedAddress.value = address
  } catch (err) {
    console.log('[LocationPanel] resolve precise address failed', err)
    hasResolvedAddress.value = false
    addressResolveError.value = panelContent.feedback.resolveError
  } finally {
    isResolvingAddress.value = false
  }
}

async function maybeResolvePreciseAddress(rawAddress?: string) {
  if (!props.requirePreciseAddress) return
  const nextAddress = normalizeAddress(rawAddress ?? preciseAddress.value)
  if (!nextAddress) return
  if (nextAddress === lastResolvedAddress.value) return
  await resolvePreciseAddress(nextAddress)
}
</script>

<template>
  <section class="editor-location-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="field">
        <div class="input">
          <input
            :value="typeValue"
            type="text"
            :placeholder="panelContent.placeholders.type"
            :maxlength="locationLimits.type"
            autocomplete="off"
            inputmode="text"
            @input="patchTextField('type', inputValue($event), locationLimits.type)"
          />
        </div>
        <p
          v-if="shouldShowFieldCounter(locationLimits.type)"
          class="meta"
        >
          {{ fieldCounter(typeLength, locationLimits.type) }}
        </p>
      </div>

      <div
        v-if="props.requirePreciseAddress"
        class="field"
      >
        <div class="input">
          <input
            :value="preciseAddressRaw"
            type="text"
            :placeholder="panelContent.placeholders.preciseAddress"
            :maxlength="locationLimits.preciseAddress"
            autocomplete="street-address"
            inputmode="text"
            :aria-invalid="Boolean(preciseAddressLengthError || addressResolveError)"
            @input="onPreciseAddressInput"
            @blur="maybeResolvePreciseAddress(inputValue($event))"
            @keydown.enter.prevent="resolvePreciseAddress(inputValue($event))"
          />
        </div>
        <p
          v-if="shouldShowFieldCounter(locationLimits.preciseAddress)"
          class="meta"
        >
          {{ fieldCounter(preciseAddressLength, locationLimits.preciseAddress) }}
        </p>
      </div>

      <div
        v-if="props.requirePreciseAddress"
        class="address-tools"
      >
        <button
          class="resolve-button"
          type="button"
          :disabled="isResolvingAddress || preciseAddress.length < geocodeQueryMinLength"
          @click="resolvePreciseAddress()"
        >
          {{ isResolvingAddress ? panelContent.states.resolving : panelContent.actions.resolveAddress }}
        </button>
        <p class="hint">
          {{ panelContent.hints.preciseAddress }}
        </p>
        <p
          v-if="preciseAddressLengthError && !addressResolveError"
          class="feedback is-error"
        >
          {{ preciseAddressLengthError }}
        </p>
        <p
          v-if="addressResolveError"
          class="feedback is-error"
        >
          {{ addressResolveError }}
        </p>
        <p
          v-else-if="hasResolvedAddress"
          class="feedback is-success"
        >
          {{ panelContent.feedback.resolved }}
        </p>
      </div>

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
          <p
            v-if="shouldShowFieldCounter(locationLimits.city)"
            class="meta"
          >
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
          <p
            v-if="shouldShowFieldCounter(locationLimits.country)"
            class="meta"
          >
            {{ fieldCounter(countryLength, locationLimits.country) }}
          </p>
        </div>
      </div>
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
        <p
          v-if="shouldShowFieldCounter(locationLimits.region)"
          class="meta"
        >
          {{ fieldCounter(regionLength, locationLimits.region) }}
        </p>
      </div>

      <div
        v-if="mapPreviewSrc"
        class="map-preview"
      >
        <iframe
          class="frame"
          :src="mapPreviewSrc"
          title="Aperçu de localisation sur Google Maps"
          allowfullscreen
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
        >
        </iframe>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/location-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-location-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    > .field {
      display: flex;
      flex-direction: column;
      gap: calc(var(--layout-gap-xs) / 2);

      > .input {
        @include inputs.field($theme: base);
      }

      > .meta {
        margin: 0;
        @include little-text($thin: false);
        color: rgba($secondary, 0.7);
      }
    }

    > .address-tools {
      display: flex;
      flex-direction: column;
      gap: calc(var(--layout-gap-xs) / 2);

      > .resolve-button {
        width: fit-content;
        border: 1px solid rgba($secondary, 0.12);
        border-radius: 0.75rem;
        background: $accent-surface-0;
        color: $secondary;
        font-weight: 600;
        font-size: 0.875rem;
        padding: 0.45rem 0.85rem;
        cursor: pointer;
        transition: border-color 160ms ease, background-color 160ms ease, opacity 160ms ease;

        &:hover:enabled {
          border-color: rgba($secondary, 0.3);
          background: rgba($secondary, 0.04);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      > .hint {
        margin: 0;
        @include little-text($thin: false);
        color: rgba($secondary, 0.65);
      }

      > .feedback {
        margin: 0;
        @include little-text($thin: false);

        &.is-error {
          color: #b3261e;
        }

        &.is-success {
          color: #0f8f4f;
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

        > .input {
          @include inputs.field($theme: base);
        }

        > .meta {
          margin: 0;
          @include little-text($thin: false);
          color: rgba($secondary, 0.7);
        }
      }
    }

    > .map-preview {
      border: 1px solid rgba($secondary, 0.12);
      border-radius: 0.75rem;
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
