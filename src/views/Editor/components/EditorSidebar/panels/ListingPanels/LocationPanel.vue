<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/LocationPanel.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

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

const isResolvingAddress = ref(false)
const addressResolveError = ref('')
const hasResolvedAddress = ref(false)
const lastResolvedAddress = ref('')

const preciseAddress = computed(() => String(props.core?.precise_address ?? '').trim())

const geocodeQueryMinLength = 5

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

function pickAddressValue(address: NominatimAddress | undefined, keys: Array<keyof NominatimAddress>): string {
  if (!address) return ''
  for (const key of keys) {
    const value = address[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function onPreciseAddressInput(event: Event) {
  const value = inputValue(event)
  patchCore({ precise_address: value })
  addressResolveError.value = ''

  if (value.trim() !== lastResolvedAddress.value) {
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
      <div class="input">
        <input
          :value="props.core?.type ?? ''"
          type="text"
          :placeholder="panelContent.placeholders.type"
          @input="patchCore({ type: inputValue($event) })"
        />
      </div>

      <div
        v-if="props.requirePreciseAddress"
        class="input"
      >
        <input
          :value="props.core?.precise_address ?? ''"
          type="text"
          :placeholder="panelContent.placeholders.preciseAddress"
          @input="onPreciseAddressInput"
          @blur="maybeResolvePreciseAddress(inputValue($event))"
          @keydown.enter.prevent="resolvePreciseAddress(inputValue($event))"
        />
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
        <div class="input">
          <input
            :value="props.core?.city ?? ''"
            type="text"
            :placeholder="panelContent.placeholders.city"
            @input="patchCore({ city: inputValue($event) })"
          />
        </div>
        <div class="input">
          <input
            :value="props.core?.country ?? ''"
            type="text"
            :placeholder="panelContent.placeholders.country"
            @input="patchCore({ country: inputValue($event) })"
          />
        </div>
      </div>
      <div class="input">
        <input
          :value="props.core?.region ?? ''"
          type="text"
          :placeholder="panelContent.placeholders.region"
          @input="patchCore({ region: inputValue($event) })"
        />
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

    > .input {
      @include inputs.field($theme: base);
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

      > .input {
        @include inputs.field($theme: base);
      }
    }
  }
}
</style>
