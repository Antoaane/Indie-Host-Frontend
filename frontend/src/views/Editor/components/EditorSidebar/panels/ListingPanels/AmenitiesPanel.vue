<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/AmenitiesPanel.vue -->

<script setup lang="ts">
// DEPS
import { computed, ref, watch } from 'vue'
import AbsoluteOverlay from '@/components/overlays/AbsoluteOverlay.vue'

// UTILS
import { resolveAmenityIconComponent, resolveLucideComponent } from '@/utils/amenitiesIcons'
import { mockAmenitiesCatalog, type AmenityCatalogItem } from '@/views/Editor/mocks/amenitiesCatalog'
import { getAmenityPerkDefaults } from '@/domain/listings/perks'
import { formatValidationMessage, normalizeTextInput, resolveTextMaxLength, shouldDisplayTextLimit } from '@/utils/inputValidation'
import { normalizeSearchText, tokenizeSearchText } from '@/utils/search'

// TYPES
import type { RawCore } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'

type AmenityDraft = NonNullable<RawCore['amenities']>[number]
type AmenityPerkSource = {
  perkEligible?: boolean
  perkScore?: number
  perkPriority?: number
}
type OverlayAmenityItem = {
  id: string
  name: string
  description?: string
  category: string
  relevance: number
  selected: boolean
  pinned: boolean
  icon: any | null
  index: number
} & AmenityPerkSource
type OverlayAmenityGroup = {
  category: string
  items: OverlayAmenityItem[]
  pinnedGroup?: boolean
}
type SelectedAmenityItem = {
  id: string
  name: string
  description?: string
  category: string
  relevance: number
  pinned: boolean
  icon: any | null
  index: number
  amenity: AmenityDraft
}

const PREVIEW_LIMIT = 8
const FALLBACK_CATEGORY = 'Autres'

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const amenities = computed<AmenityDraft[]>(() => (props.core?.amenities as AmenityDraft[] | undefined) ?? [])
const catalog = computed<AmenityCatalogItem[]>(() => mockAmenitiesCatalog.amenities ?? [])
const catalogSearch = ref('')
const isOverlayOpen = ref(false)

const panelContent = editorStatic.panels.listing.amenities
const panelContentRecord = panelContent as Record<string, unknown>
const overlayContent = (panelContent.overlay ?? {}) as Record<string, unknown>
const amenitiesValidation = editorStatic.validation.listing.amenities
const textDefaults = editorStatic.validation.defaults.simpleText
const searchLimit = resolveTextMaxLength(amenitiesValidation.searchMax, textDefaults)
const showSearchCounter = shouldDisplayTextLimit(searchLimit, textDefaults)

const manageAmenitiesLabel = String(panelContentRecord.manageCta ?? 'Gérer mes équipements')
const overlayTitle = String(overlayContent.titleList ?? panelContent.title)
const overlayAriaLabel = String(overlayContent.ariaLabel ?? 'Gérer les équipements')
const overlayPinnedCategoryLabel = String(overlayContent.pinnedCategory ?? 'Équipements épinglés')
const pinLabel = String(overlayContent.pin ?? 'Épingler cet équipement')
const unpinLabel = String(overlayContent.unpin ?? 'Retirer cet équipement des épinglés')
const pinBadgeLabel = String(overlayContent.pinBadge ?? 'Épingler')
const pinnedBadgeLabel = String(overlayContent.pinnedBadge ?? 'Désépingler')
const closeOverlayLabel = String(overlayContent.close ?? 'Fermer')

const searchCounter = computed(() =>
  formatValidationMessage(amenitiesValidation.messages.counter, {
    current: Math.min(catalogSearch.value.length, searchLimit),
    max: searchLimit,
  }),
)

const closeIcon = resolveLucideComponent('x')
const pinIcon = resolveLucideComponent('pin')
const checkIcon = resolveLucideComponent('check')
const overlayTitleId = `editor-amenities-overlay-title-${Math.random().toString(36).slice(2, 9)}`

const catalogById = computed(() => {
  const map = new Map<string, AmenityCatalogItem>()
  for (const item of catalog.value) {
    const id = normalizeAmenityId(item.id)
    if (!id) continue
    map.set(id, item)
  }
  return map
})

function setAmenities(next: AmenityDraft[]) {
  emit('patch', { core: { amenities: next } })
}

function openOverlay() {
  isOverlayOpen.value = true
}

function closeOverlay() {
  isOverlayOpen.value = false
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

function normalizeAmenityText(value: unknown): string | null {
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

function resolveAmenityIcon(amenityId: string | null) {
  if (!amenityId) return null
  return resolveAmenityIconComponent(amenityId) ?? resolveLucideComponent(amenityId)
}

function removeAmenityById(amenityId: string) {
  const normalized = normalizeAmenityId(amenityId)
  if (!normalized) return
  setAmenities(amenities.value.filter((amenity) => resolveAmenityId(amenity) !== normalized))
}

function resolveAmenityPerkPatch(item: AmenityPerkSource, amenityId: string) {
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

function addAmenityFromCatalog(item: OverlayAmenityItem) {
  const normalizedId = normalizeAmenityId(item.id)
  if (!normalizedId) return
  if (isAmenitySelected(normalizedId)) return

  const perkPatch = resolveAmenityPerkPatch(item, normalizedId)

  setAmenities([
    ...amenities.value,
    {
      id: normalizedId,
      name: normalizeAmenityText(item.name) ?? normalizedId,
      description: normalizeAmenityText(item.description) ?? undefined,
      category: normalizeAmenityText(item.category) ?? FALLBACK_CATEGORY,
      relevance: toFiniteNumber(item.relevance) ?? 0,
      pinned: false,
      ...perkPatch,
    } as AmenityDraft,
  ])
}

function toggleAmenityFromCatalog(item: OverlayAmenityItem) {
  const normalizedId = normalizeAmenityId(item.id)
  if (!normalizedId) return

  if (isAmenitySelected(normalizedId)) {
    removeAmenityById(normalizedId)
    return
  }

  addAmenityFromCatalog(item)
}

function toggleAmenityPin(amenityId: string) {
  const normalizedId = normalizeAmenityId(amenityId)
  if (!normalizedId) return

  let hasChanged = false
  const next = amenities.value.map((amenity) => {
    if (resolveAmenityId(amenity) !== normalizedId) return amenity
    hasChanged = true
    return {
      ...amenity,
      pinned: !Boolean((amenity as any)?.pinned),
    } as AmenityDraft
  })

  if (hasChanged) {
    setAmenities(next)
  }
}

function comparePreviewAmenities(a: SelectedAmenityItem, b: SelectedAmenityItem): number {
  if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned)
  if (a.relevance !== b.relevance) return b.relevance - a.relevance
  return a.index - b.index
}

function compareCatalogAmenities(a: OverlayAmenityItem, b: OverlayAmenityItem): number {
  if (a.relevance !== b.relevance) return b.relevance - a.relevance
  const byName = String(a.name ?? '').localeCompare(String(b.name ?? ''))
  if (byName) return byName
  return a.index - b.index
}

const selectedAmenities = computed<SelectedAmenityItem[]>(() => {
  const selected: SelectedAmenityItem[] = []
  const seen = new Set<string>()

  amenities.value.forEach((amenity, index) => {
    const id = resolveAmenityId(amenity)
    if (!id || seen.has(id)) return
    seen.add(id)

    const catalogItem = catalogById.value.get(id)
    const name = normalizeAmenityText((amenity as any)?.name) ?? normalizeAmenityText(catalogItem?.name) ?? id
    const description =
      normalizeAmenityText((amenity as any)?.description) ?? normalizeAmenityText(catalogItem?.description) ?? undefined
    const category = normalizeAmenityText((amenity as any)?.category) ?? normalizeAmenityText(catalogItem?.category) ?? FALLBACK_CATEGORY

    selected.push({
      id,
      name,
      description,
      category,
      relevance: toFiniteNumber((amenity as any)?.relevance) ?? 0,
      pinned: Boolean((amenity as any)?.pinned),
      icon: resolveAmenityIcon(id),
      index,
      amenity,
    })
  })

  return selected
})

const selectedAmenityIdSet = computed(() => new Set(selectedAmenities.value.map((item) => item.id)))
const selectedAmenityById = computed(() => {
  const map = new Map<string, SelectedAmenityItem>()
  selectedAmenities.value.forEach((item) => {
    map.set(item.id, item)
  })
  return map
})

function isAmenitySelected(amenityId: string): boolean {
  const normalized = normalizeAmenityId(amenityId)
  if (!normalized) return false
  return selectedAmenityIdSet.value.has(normalized)
}

const previewAmenities = computed(() => {
  return [
    ...selectedAmenities.value,
  ]
    .sort(comparePreviewAmenities)
    .slice(0, PREVIEW_LIMIT)
})

const catalogSearchTokens = computed(() => tokenizeSearchText(catalogSearch.value))

function matchesCatalogSearch(item: { name?: string; description?: string }, tokens: string[]): boolean {
  if (!tokens.length) return true
  const haystack = normalizeSearchText(`${item.name ?? ''} ${item.description ?? ''}`)
  return tokens.some((token) => haystack.includes(token))
}

const catalogGroups = computed<OverlayAmenityGroup[]>(() => {
  const tokens = catalogSearchTokens.value
  const itemsById = new Map<string, OverlayAmenityItem>()

  catalog.value.forEach((item, catalogIndex) => {
    const normalizedId = normalizeAmenityId(item.id)
    if (!normalizedId) return

    const selected = selectedAmenityById.value.get(normalizedId)
    const resolved: OverlayAmenityItem = {
      id: normalizedId,
      name: selected?.name ?? item.name,
      description: selected?.description ?? item.description,
      category: selected?.category ?? (normalizeAmenityText(item.category) ?? FALLBACK_CATEGORY),
      relevance: selected?.relevance ?? toFiniteNumber(item.relevance) ?? 0,
      perkEligible: item.perkEligible,
      perkScore: item.perkScore,
      perkPriority: item.perkPriority,
      selected: Boolean(selected),
      pinned: Boolean(selected?.pinned),
      icon: resolveAmenityIcon(normalizedId),
      index: selected?.index ?? catalogIndex,
    }

    if (!matchesCatalogSearch(resolved, tokens)) return
    itemsById.set(normalizedId, resolved)
  })

  selectedAmenities.value.forEach((selectedItem) => {
    if (itemsById.has(selectedItem.id)) return

    const resolved: OverlayAmenityItem = {
      id: selectedItem.id,
      name: selectedItem.name,
      description: selectedItem.description,
      category: selectedItem.category,
      relevance: selectedItem.relevance,
      perkEligible: typeof (selectedItem.amenity as any)?.perkEligible === 'boolean'
        ? (selectedItem.amenity as any).perkEligible
        : undefined,
      perkScore: toFiniteNumber((selectedItem.amenity as any)?.perkScore),
      perkPriority: toFiniteNumber((selectedItem.amenity as any)?.perkPriority),
      selected: true,
      pinned: selectedItem.pinned,
      icon: selectedItem.icon,
      index: selectedItem.index,
    }

    if (!matchesCatalogSearch(resolved, tokens)) return
    itemsById.set(selectedItem.id, resolved)
  })

  const pinnedItems = Array.from(itemsById.values())
    .filter((item) => item.selected && item.pinned)
    .sort(compareCatalogAmenities)

  const groups = new Map<string, OverlayAmenityItem[]>()
  for (const item of itemsById.values()) {
    const key = normalizeAmenityText(item.category) ?? FALLBACK_CATEGORY
    const bucket = groups.get(key) ?? []
    bucket.push(item)
    groups.set(key, bucket)
  }

  const ordered = Array.from(groups.entries())
    .map(
      ([
        category,
        items,
      ]) => ({
        category,
        items: items.sort(compareCatalogAmenities),
      }),
    )
    .sort((a, b) => a.category.localeCompare(b.category))

  if (!pinnedItems.length) return ordered

  return [
    {
      category: overlayPinnedCategoryLabel,
      items: pinnedItems,
      pinnedGroup: true,
    },
    ...ordered,
  ]
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
      <ul
        v-if="previewAmenities.length"
        class="preview"
      >
        <li
          v-for="item in previewAmenities"
          :key="item.id"
          class="item"
          :class="{ 'is-pinned': item.pinned }"
        >
          <component
            v-if="item.icon"
            :is="item.icon"
            class="icon"
            aria-hidden="true"
          />
          <p class="name">{{ item.name }}</p>
          <component
            v-if="item.pinned && pinIcon"
            :is="pinIcon"
            class="pin"
            aria-hidden="true"
          />
        </li>
      </ul>

      <p
        v-else
        class="empty"
      >
        {{ panelContent.empty }}
      </p>

      <div class="manage">
        <button
          type="button"
          @click="openOverlay"
        >
          {{ manageAmenitiesLabel }}
        </button>
      </div>
    </div>

    <AbsoluteOverlay
      class="editor-amenities-overlay"
      :open="isOverlayOpen"
      mode="centered"
      :aria-label="overlayAriaLabel"
      :aria-labelledby="overlayTitleId"
      @close="closeOverlay"
    >
      <div class="overlay-panel">
        <div class="overlay-header">
          <h4 :id="overlayTitleId">{{ overlayTitle }}</h4>
          <div class="overlay-close">
            <button
              type="button"
              :aria-label="closeOverlayLabel"
              :title="closeOverlayLabel"
              @click="closeOverlay"
            >
              <component
                v-if="closeIcon"
                :is="closeIcon"
                :size="18"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <div class="overlay-body">
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
              :key="group.pinnedGroup ? '__pinned__' : group.category"
              class="category"
              :class="{ 'is-pinned-group': group.pinnedGroup }"
            >
              <h5>{{ group.category }}</h5>

              <ul>
                <li
                  v-for="item in group.items"
                  :key="item.id"
                  class="item"
                  :class="{
                    'is-selected': item.selected,
                    'is-pinned': item.pinned,
                  }"
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
                    </span>
                  </button>

                  <button
                    v-if="item.selected"
                    type="button"
                    class="pin-toggle"
                    :class="{ 'is-active': item.pinned }"
                    :aria-label="item.pinned ? unpinLabel : pinLabel"
                    :title="item.pinned ? unpinLabel : pinLabel"
                    :aria-pressed="item.pinned"
                    @click.stop.prevent="toggleAmenityPin(item.id)"
                  >
                    <component
                      v-if="pinIcon"
                      :is="pinIcon"
                      class="pin-icon"
                      aria-hidden="true"
                    />
                    <span class="pin-text">
                      {{ item.pinned ? pinnedBadgeLabel : pinBadgeLabel }}
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
      </div>
    </AbsoluteOverlay>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/amenities-panel.scss';
</style>
