<!-- File: src/views/CreateListing/components/panels/ListingPanels/AmenitiesPanel.vue -->

<script setup lang="ts">
// DEPS
import { computed, ref, watch } from 'vue'

// UTILS
import { resolveAmenityIconComponent, resolveLucideComponent } from '@/utils/amenitiesIcons'
import { sanitizeKnownAmenities } from '@/utils/amenitiesCatalog'
import { mockAmenitiesCatalog, type AmenityCatalogItem } from '@/views/Editor/mocks/amenitiesCatalog'
import { getAmenityPerkDefaults } from '@/domain/listings/perks'
import { formatValidationMessage, normalizeTextInput, resolveTextMaxLength, shouldDisplayTextLimit } from '@/utils/inputValidation'
import { normalizeSearchText, tokenizeSearchText } from '@/utils/search'

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
  selectedGroup?: boolean
}

const FALLBACK_CATEGORY = 'Autres'

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const amenities = computed<AmenityDraft[]>(() => sanitizeKnownAmenities((props.core?.amenities as AmenityDraft[] | undefined) ?? []))
const catalog = computed<AmenityCatalogItem[]>(() => mockAmenitiesCatalog.amenities ?? [])
const catalogSearch = ref('')
const showSelectedOnly = ref(false)
const panelContent = editorStatic.panels.listing.amenities
const panelContentRecord = panelContent as Record<string, unknown>
const overlayContent = (panelContent.overlay ?? {}) as Record<string, unknown>
const amenitiesValidation = editorStatic.validation.listing.amenities
const textDefaults = editorStatic.validation.defaults.simpleText
const searchLimit = resolveTextMaxLength(amenitiesValidation.searchMax, textDefaults)
const showSearchCounter = shouldDisplayTextLimit(searchLimit, textDefaults)
const checkIcon = resolveLucideComponent('check')
const showSelectedOnlyLabel = String(overlayContent.showSelectedOnly ?? 'Afficher la sélection')
const showAllAmenitiesLabel = String(overlayContent.showAll ?? 'Afficher tous les équipements')
const selectedAmenitiesLabel = String(overlayContent.selectedCategory ?? overlayContent.pinnedCategory ?? 'Équipements sélectionnés')

function setAmenities(next: AmenityDraft[]) {
  emit('patch', { core: { amenities: next } })
}

function toggleSelectedFilter() {
  showSelectedOnly.value = !showSelectedOnly.value
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

  const name = normalizeSearchText((amenity as any)?.name)
  if (!name) return null

  const match = catalog.value.find((item) => normalizeSearchText(item.name) === name)
  return normalizeAmenityId(match?.id)
}

function resolveAmenityIcon(input: string | AmenityDraft | AmenityCatalogItem | null) {
  if (!input) return null
  const amenityId = typeof input === 'string' ? input : normalizeAmenityId((input as any)?.id)
  return resolveAmenityIconComponent(input as any) ?? resolveLucideComponent(amenityId)
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

const catalogById = computed(() => {
  const map = new Map<string, AmenityCatalogItem>()
  for (const item of catalog.value) {
    const normalizedId = normalizeAmenityId(item.id)
    if (!normalizedId) continue
    map.set(normalizedId, item)
  }
  return map
})

function compareCatalogAmenities(a: CatalogAmenityItem, b: CatalogAmenityItem): number {
  if (a.relevance !== b.relevance) return (b.relevance ?? 0) - (a.relevance ?? 0)
  return String(a.name ?? '').localeCompare(String(b.name ?? ''))
}

const selectedCatalogItems = computed<CatalogAmenityItem[]>(() => {
  const seen = new Set<string>()
  const items: CatalogAmenityItem[] = []

  amenities.value.forEach((amenity) => {
    const normalizedId = resolveAmenityId(amenity)
    if (!normalizedId || seen.has(normalizedId)) return
    seen.add(normalizedId)

    const catalogItem = catalogById.value.get(normalizedId)
    const name = String((amenity as any)?.name ?? catalogItem?.name ?? normalizedId).trim() || normalizedId
    const description = String((amenity as any)?.description ?? catalogItem?.description ?? '').trim() || undefined
    const category = String((amenity as any)?.category ?? catalogItem?.category ?? FALLBACK_CATEGORY).trim() || FALLBACK_CATEGORY

    items.push({
      ...(catalogItem ?? {
        id: normalizedId,
        name,
        description,
        category,
        relevance: Number((amenity as any)?.relevance ?? 0) || 0,
      }),
      id: normalizedId,
      name,
      description,
      category,
      relevance: Number((amenity as any)?.relevance ?? catalogItem?.relevance ?? 0) || 0,
      icon: resolveAmenityIcon({
        id: normalizedId,
        name,
        description,
        category,
      } as AmenityCatalogItem),
      selected: true,
    })
  })

  return items.sort(compareCatalogAmenities)
})

const catalogSearchTokens = computed(() => tokenizeSearchText(catalogSearch.value))
const catalogSearchLength = computed(() => Math.min(catalogSearch.value.length, searchLimit))
const searchCounter = computed(() =>
  formatValidationMessage(amenitiesValidation.messages.counter, {
    current: catalogSearchLength.value,
    max: searchLimit,
  }),
)

function matchesCatalogSearch(item: AmenityCatalogItem, tokens: string[]): boolean {
  if (!tokens.length) return true
  const haystack = normalizeSearchText(`${item.name ?? ''} ${item.description ?? ''}`)
  return tokens.some((token) => haystack.includes(token))
}

const catalogGroups = computed<CatalogAmenityGroup[]>(() => {
  const tokens = catalogSearchTokens.value
  const selectedItems = selectedCatalogItems.value.filter((item) => matchesCatalogSearch(item, tokens))

  if (showSelectedOnly.value) {
    return selectedItems.length
      ? [
          {
            category: selectedAmenitiesLabel,
            items: selectedItems,
            selectedGroup: true,
          },
        ]
      : []
  }

  const groups = new Map<string, CatalogAmenityItem[]>()
  for (const item of catalog.value) {
    const normalizedId = normalizeAmenityId(item.id)
    if (!normalizedId) continue
    if (selectedAmenityIdSet.value.has(normalizedId)) continue
    if (!matchesCatalogSearch(item, tokens)) continue

    const key = String(item.category ?? '').trim() || FALLBACK_CATEGORY
    const items = groups.get(key) ?? []
    items.push({
      ...item,
      id: normalizedId,
      icon: resolveAmenityIcon(item),
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

  return selectedItems.length
    ? [
        {
          category: selectedAmenitiesLabel,
          items: selectedItems,
          selectedGroup: true,
        },
        ...ordered,
      ]
    : ordered
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

watch(
  () => selectedAmenityIdSet.value.size,
  (size) => {
    if (size <= 0) {
      showSelectedOnly.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <section class="create-amenities-panel">
    <div class="header">
      <h2>{{ panelContent.title }}</h2>
      <h3>{{ panelContent.subtitle }}</h3>
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
        <button
          v-if="selectedAmenityIdSet.size"
          type="button"
          class="selection-toggle"
          :class="{ 'is-active': showSelectedOnly }"
          :aria-pressed="showSelectedOnly"
          @click="toggleSelectedFilter"
        >
          <span class="label">{{ showSelectedOnly ? showAllAmenitiesLabel : showSelectedOnlyLabel }}</span>
          <span class="count">{{ selectedAmenityIdSet.size }}</span>
        </button>
      </div>
      <div
        v-if="catalogGroups.length"
        class="catalog"
      >
        <div
          v-for="group in catalogGroups"
          :key="group.selectedGroup ? '__selected__' : group.category"
          class="category"
          :class="{ 'is-selected-group': group.selectedGroup }"
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
                  class="state"
                  :class="{ 'is-hidden': !item.selected }"
                  :aria-hidden="!item.selected"
                >
                  <component
                    v-if="checkIcon"
                    :is="checkIcon"
                    class="check"
                    aria-hidden="true"
                  />
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

      <p
        v-if="showSearchCounter"
        class="meta"
      >
        {{ searchCounter }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/CreateListing/components/panels/ListingPanels/amenities-panel.scss';
</style>
