<!-- File: src/views/CreateListing/components/panels/ListingPanels/AmenitiesPanel.vue -->

<script setup lang="ts">
// DEPS
import { computed, ref, watch } from 'vue'
import { ChevronDown, Plus, Trash2 } from 'lucide-vue-next'

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

const amenities = computed<AmenityDraft[]>(() => {
  const raw = (props.core?.amenities as AmenityDraft[] | undefined) ?? []
  const known = raw.filter((a) => !String((a as any)?.id ?? '').startsWith('custom-'))
  const custom = raw.filter((a) => String((a as any)?.id ?? '').startsWith('custom-'))
  return [...(sanitizeKnownAmenities(known as any) as AmenityDraft[]), ...custom]
})
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
      icon: (() => {
        const stored = (amenity as any)?.icon as string | undefined
        if (stored) return resolveLucideComponent(stored)
        return resolveAmenityIcon({ id: normalizedId, name, description, category } as AmenityCatalogItem)
      })(),
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

// ── Collapsible categories ──────────────────────────────────────────────────
// Default: all collapsed. Set tracks which categories are explicitly expanded.
const expandedCategories = ref(new Set<string>())

function categoryKey(group: CatalogAmenityGroup): string {
  return group.selectedGroup ? '__selected__' : group.category
}

function isCategoryCollapsed(group: CatalogAmenityGroup): boolean {
  // Never collapse while searching — show all matches
  if (catalogSearch.value.trim()) return false
  return !expandedCategories.value.has(categoryKey(group))
}

function toggleCategory(group: CatalogAmenityGroup) {
  const key = categoryKey(group)
  const next = new Set(expandedCategories.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedCategories.value = next
}

// ── Custom amenities ────────────────────────────────────────────────────────
const customAmenityName = ref('')
const CUSTOM_AMENITY_MAX_LENGTH = 60

function addCustomAmenity() {
  const name = customAmenityName.value.trim()
  if (!name) return
  const id = `custom-${Date.now()}`
  setAmenities([
    ...amenities.value,
    { id, name, category: 'Autres', relevance: 0 } as AmenityDraft,
  ])
  customAmenityName.value = ''
  // Expand selected group + open the icon strip for the new item
  const nextExpanded = new Set(expandedCategories.value)
  nextExpanded.add('__selected__')
  expandedCategories.value = nextExpanded
  const nextStrips = new Set(openIconStrips.value)
  nextStrips.add(id)
  openIconStrips.value = nextStrips
}

// ── Custom amenity icon picker ───────────────────────────────────────────────
const CUSTOM_ICON_OPTIONS = [
  'wifi', 'tv', 'coffee', 'utensils-crossed', 'refrigerator', 'microwave',
  'waves', 'dumbbell', 'bike', 'car', 'tree-pine', 'sun',
  'music', 'gamepad-2', 'book-open-text', 'baby', 'shield', 'heart-pulse',
  'shower-head', 'flame', 'wind', 'thermometer-snowflake', 'bed-double', 'shirt',
  'star', 'map-pin', 'key-round', 'lock', 'plug-zap', 'sofa',
] as const

function isCustomItem(item: CatalogAmenityItem): boolean {
  return item.id.startsWith('custom-')
}

function getStoredIcon(item: CatalogAmenityItem): string | null {
  const amenity = amenities.value.find((a) => resolveAmenityId(a) === item.id)
  return (amenity as any)?.icon ?? null
}

function setCustomAmenityIcon(amenityId: string, iconName: string) {
  setAmenities(
    amenities.value.map((a) =>
      resolveAmenityId(a) === amenityId ? ({ ...a, icon: iconName } as AmenityDraft) : a,
    ),
  )
}

function removeCustomAmenity(amenityId: string) {
  setAmenities(amenities.value.filter((a) => resolveAmenityId(a) !== amenityId))
  const next = new Set(openIconStrips.value)
  next.delete(amenityId)
  openIconStrips.value = next
}

// ── Icon strip open/close state ──────────────────────────────────────────────
const openIconStrips = ref(new Set<string>())

function isIconStripOpen(item: CatalogAmenityItem): boolean {
  return openIconStrips.value.has(item.id)
}

function toggleIconStrip(itemId: string) {
  const next = new Set(openIconStrips.value)
  if (next.has(itemId)) next.delete(itemId)
  else next.add(itemId)
  openIconStrips.value = next
}

function handleCardClick(item: CatalogAmenityItem) {
  if (!isCustomItem(item)) {
    toggleAmenityFromCatalog(item)
    return
  }
  if (item.selected) {
    // Toggle strip — don't deselect
    toggleIconStrip(item.id)
  } else {
    toggleAmenityFromCatalog(item)
    // Open strip on first selection
    const next = new Set(openIconStrips.value)
    next.add(item.id)
    openIconStrips.value = next
  }
}
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
            enterkeyhint="search"
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
          :class="{ 'is-selected-group': group.selectedGroup, 'is-collapsed': isCategoryCollapsed(group) }"
        >
          <button
            type="button"
            class="category-header"
            @click="toggleCategory(group)"
          >
            <h4>{{ group.category }}</h4>
            <span class="category-count">{{ group.items.length }}</span>
            <ChevronDown class="chevron" :size="16" aria-hidden="true" />
          </button>

          <Transition name="amenity-collapse">
            <ul v-show="!isCategoryCollapsed(group)">
              <li
                v-for="item in group.items"
                :key="item.id"
                class="item"
                :class="{ 'is-selected': item.selected, 'is-custom': isCustomItem(item) }"
              >
                <button
                  type="button"
                  class="amenity-card"
                  :aria-pressed="item.selected"
                  @click="handleCardClick(item)"
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

                <Transition name="amenity-collapse">
                  <div
                    v-if="isCustomItem(item) && isIconStripOpen(item)"
                    class="icon-strip"
                    @click.stop
                  >
                    <button
                      v-for="iconName in CUSTOM_ICON_OPTIONS"
                      :key="iconName"
                      type="button"
                      class="icon-option"
                      :class="{ 'is-active': getStoredIcon(item) === iconName }"
                      :aria-label="iconName"
                      @click.stop="setCustomAmenityIcon(item.id, iconName)"
                    >
                      <component
                        :is="resolveLucideComponent(iconName)"
                        :size="14"
                        aria-hidden="true"
                      />
                    </button>
                    <span class="icon-strip-separator" aria-hidden="true" />
                    <button
                      type="button"
                      class="icon-strip-remove"
                      aria-label="Supprimer cet équipement"
                      @click.stop="removeCustomAmenity(item.id)"
                    >
                      <Trash2 :size="13" aria-hidden="true" />
                    </button>
                  </div>
                </Transition>
              </li>
            </ul>
          </Transition>
        </div>
      </div>

      <p
        v-else
        class="empty"
      >
        {{ panelContent.overlay.empty }}
      </p>

      <form
        class="custom-amenity-section"
        @submit.prevent="addCustomAmenity"
      >
        <div class="input action">
          <input
            v-model="customAmenityName"
            type="text"
            placeholder="Ajouter un équipement personnalisé..."
            :maxlength="CUSTOM_AMENITY_MAX_LENGTH"
            enterkeyhint="done"
            autocomplete="off"
          />
          <div class="action">
            <button
              type="submit"
              :disabled="!customAmenityName.trim()"
            >
              <Plus
                class="icon"
                :size="14"
                aria-hidden="true"
              />
              <span>Ajouter</span>
            </button>
          </div>
        </div>
      </form>

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
