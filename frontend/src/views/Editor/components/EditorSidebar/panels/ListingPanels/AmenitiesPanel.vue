<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/AmenitiesPanel.vue -->

<script setup lang="ts">
// DEPS
import { computed, ref, watch } from 'vue'

// UTILS
import { resolveAmenityIconComponent, resolveLucideComponent } from '@/utils/amenitiesIcons'
import { mockAmenitiesCatalog, type AmenityCatalogItem } from '@/views/Editor/mocks/amenitiesCatalog'
import { getAmenityPerkDefaults } from '@/domain/listings/perks'
import { formatValidationMessage, normalizeTextInput, resolveTextMaxLength, shouldDisplayTextLimit } from '@/utils/inputValidation'

// TYPES
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

type AmenityDraft = NonNullable<RawCore['amenities']>[number]
type CatalogAmenityItem = AmenityCatalogItem & {
  id: string
  icon: any | null
  selected: boolean
}
type CatalogAmenityGroup = {
  category: string
  items: CatalogAmenityItem[]
}

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const amenities = computed<AmenityDraft[]>(() => (props.core?.amenities as AmenityDraft[] | undefined) ?? [])
const catalog = computed<AmenityCatalogItem[]>(() => mockAmenitiesCatalog.amenities ?? [])
const catalogSearch = ref('')
const panelContent = editorStatic.panels.listing.amenities
const amenitiesValidation = editorStatic.validation.listing.amenities
const textDefaults = editorStatic.validation.defaults.simpleText
const searchLimit = resolveTextMaxLength(amenitiesValidation.searchMax, textDefaults)
const showSearchCounter = shouldDisplayTextLimit(searchLimit, textDefaults)
const checkIcon = resolveLucideComponent('check')

function setAmenities(next: AmenityDraft[]) {
  emit('patch', { core: { amenities: next } })
}

function toFiniteNumber(value: unknown): number | undefined {
  const next = Number(value)
  return Number.isFinite(next) ? next : undefined
}

function normalizeAmenityId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function resolveAmenityId(amenity: AmenityDraft): string | null {
  const raw = normalizeAmenityId((amenity as any)?.id) ?? normalizeAmenityId((amenity as any)?.icon)
  if (raw) return raw

  const name = normalizeAmenityId((amenity as any)?.name)?.toLowerCase()
  if (!name) return null

  const match = catalog.value.find((item) => item.name.trim().toLowerCase() === name)
  return normalizeAmenityId(match?.id)
}

function resolveAmenityIcon(amenityId: string | null) {
  if (!amenityId) return null
  return resolveAmenityIconComponent(amenityId) ?? resolveLucideComponent(amenityId)
}

function removeAmenityById(amenityId: string) {
  setAmenities(amenities.value.filter((amenity) => resolveAmenityId(amenity) !== amenityId))
}

function resolveAmenityPerkPatch(item: AmenityCatalogItem, amenityId: string) {
  const defaults = getAmenityPerkDefaults(amenityId)
  const perkEligible = typeof item.perkEligible === 'boolean' ? item.perkEligible : defaults?.perkEligible
  const perkScore = toFiniteNumber(item.perkScore) ?? toFiniteNumber(defaults?.perkScore)
  const perkPriority = toFiniteNumber(item.perkPriority) ?? toFiniteNumber(defaults?.perkPriority) ?? 0

  return {
    ...(typeof perkEligible === 'boolean' ? { perkEligible } : {}),
    ...(typeof perkScore === 'number'
      ? {
          perkScore,
          perkPriority,
        }
      : {}),
  }
}

function addAmenityFromCatalog(item: AmenityCatalogItem) {
  const normalizedId = normalizeAmenityId(item.id)
  if (!normalizedId) return
  if (isAmenitySelected(normalizedId)) return

  const perkPatch = resolveAmenityPerkPatch(item, normalizedId)

  setAmenities([
    ...amenities.value,
    {
      id: normalizedId,
      name: item.name,
      description: item.description,
      category: item.category,
      relevance: item.relevance,
      pinned: false,
      ...perkPatch,
    } as AmenityDraft,
  ])
}

function toggleAmenityFromCatalog(item: AmenityCatalogItem) {
  const normalizedId = normalizeAmenityId(item.id)
  if (!normalizedId) return

  if (isAmenitySelected(normalizedId)) {
    removeAmenityById(normalizedId)
    return
  }

  addAmenityFromCatalog({
    ...item,
    id: normalizedId,
  })
}

const selectedAmenityIdSet = computed(() => {
  const set = new Set<string>()
  amenities.value.forEach((amenity) => {
    const id = resolveAmenityId(amenity)
    if (id) set.add(id)
  })
  return set
})

function isAmenitySelected(amenityId: string): boolean {
  const normalized = normalizeAmenityId(amenityId)
  if (!normalized) return false
  return selectedAmenityIdSet.value.has(normalized)
}

function tokenizeSearch(value: string): string[] {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

const catalogSearchTokens = computed(() => tokenizeSearch(catalogSearch.value))
const catalogSearchLength = computed(() => Math.min(catalogSearch.value.length, searchLimit))
const searchCounter = computed(() =>
  formatValidationMessage(amenitiesValidation.messages.counter, {
    current: catalogSearchLength.value,
    max: searchLimit,
  }),
)

function matchesCatalogSearch(item: AmenityCatalogItem, tokens: string[]): boolean {
  if (!tokens.length) return true
  const haystack = `${item.name ?? ''} ${item.description ?? ''}`.toLowerCase()
  return tokens.some((token) => haystack.includes(token))
}

const catalogGroups = computed<CatalogAmenityGroup[]>(() => {
  const tokens = catalogSearchTokens.value

  const groups = new Map<string, CatalogAmenityItem[]>()
  for (const item of catalog.value) {
    const normalizedId = normalizeAmenityId(item.id)
    if (!normalizedId) continue
    if (!matchesCatalogSearch(item, tokens)) continue

    const key = String(item.category ?? '').trim() || 'Autres'
    const items = groups.get(key) ?? []
    items.push({
      ...item,
      id: normalizedId,
      icon: resolveAmenityIcon(normalizedId),
      selected: selectedAmenityIdSet.value.has(normalizedId),
    })
    groups.set(key, items)
  }

  const ordered = Array.from(groups.entries())
    .map(
      ([
        category,
        items,
      ]) => {
        items.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0) || String(a.name).localeCompare(String(b.name)))
        return { category, items }
      },
    )
    .sort((a, b) => a.category.localeCompare(b.category))

  return ordered
})

watch(
  () => catalogSearch.value,
  (value) => {
    const next = normalizeTextInput(value, searchLimit)
    if (next !== value) {
      catalogSearch.value = next
    }
  },
)
</script>

<template>
  <section class="editor-amenities-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <div class="search">
        <div class="search-input">
          <input
            v-model="catalogSearch"
            type="search"
            :placeholder="panelContent.overlay.searchPlaceholder"
            :maxlength="searchLimit"
            inputmode="search"
            autocomplete="off"
          />
        </div>
        <p
          v-if="showSearchCounter"
          class="meta"
        >
          {{ searchCounter }}
        </p>
      </div>
      <div
        v-if="catalogGroups.length"
        class="catalog"
      >
        <div
          v-for="group in catalogGroups"
          :key="group.category"
          class="category"
        >
          <h4>{{ group.category }}</h4>
          <ul>
            <li
              v-for="item in group.items"
              :key="item.id"
              class="item"
              :class="{ 'is-selected': item.selected }"
            >
              <button
                type="button"
                class="amenity-card"
                :aria-pressed="item.selected"
                @click="toggleAmenityFromCatalog(item)"
              >
                <component
                  v-if="item.icon"
                  :is="item.icon"
                  class="icon"
                  aria-hidden="true"
                />
                <div class="texts">
                  <p class="name">
                    {{ item.name }}
                  </p>
                  <p
                    v-if="item.description"
                    class="description"
                  >
                    {{ item.description }}
                  </p>
                </div>
                <span
                  v-if="item.selected"
                  class="state"
                >
                  <component
                    v-if="checkIcon"
                    :is="checkIcon"
                    class="check"
                    aria-hidden="true"
                  />
                  <span>{{ panelContent.overlay.added }}</span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>

      <p
        v-else
        class="empty"
      >
        {{ panelContent.overlay.empty }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/amenities-panel.scss';
</style>
