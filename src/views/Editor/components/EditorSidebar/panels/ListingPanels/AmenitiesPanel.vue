<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/AmenitiesPanel.vue -->

<script setup lang="ts">
// DEPS
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'

// UTILS
import { resolveAmenityIconComponent, resolveLucideComponent } from '@/utils/amenitiesIcons'
import { mockAmenitiesCatalog, type AmenityCatalogItem } from '@/views/Editor/mocks/amenitiesCatalog'

// TYPES
import type { RawCore } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'

// ASSETS
import { Pin, PinOff } from 'lucide-vue-next'

type AmenityDraft = NonNullable<RawCore['amenities']>[number]
type OverlayView = 'list' | 'catalog'

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const amenities = computed<AmenityDraft[]>(() => (props.core?.amenities as AmenityDraft[] | undefined) ?? [])
const isOverlayOpen = ref(false)
const overlayView = ref<OverlayView>('list')
const catalog = computed<AmenityCatalogItem[]>(() => mockAmenitiesCatalog.amenities ?? [])
const previewLimit = 6
const catalogSearch = ref('')
const catalogOpenCategories = ref<Record<string, boolean>>({})
const defaultCatalogOpenLimit = 10

function setAmenities(next: AmenityDraft[]) {
  emit('patch', { core: { amenities: next } })
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

function togglePinnedAt(rawIndex: number) {
  const current = amenities.value[rawIndex]
  if (!current) return

  const normalizedId = resolveAmenityId(current)
  const next = amenities.value.map((amenity, idx) => {
    if (idx !== rawIndex) return amenity
    return {
      ...(amenity as any),
      ...(normalizedId ? { id: normalizedId } : {}),
      pinned: !Boolean((amenity as any)?.pinned),
    } as AmenityDraft
  })
  setAmenities(next)
}

function removeAmenityAt(rawIndex: number) {
  setAmenities(amenities.value.filter((_, idx) => idx !== rawIndex))
}

function addAmenityFromCatalog(item: AmenityCatalogItem) {
  if (!item.id) return
  if (isAmenitySelected(item.id)) return

  setAmenities([
    ...amenities.value,
    {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      relevance: item.relevance,
      pinned: false,
    } as AmenityDraft,
  ])
}

function openOverlay() {
  isOverlayOpen.value = true
  overlayView.value = 'list'
  catalogSearch.value = ''
  lockScroll()
}

function closeOverlay() {
  isOverlayOpen.value = false
  overlayView.value = 'list'
  catalogSearch.value = ''
  unlockScroll()
}

function lockScroll() {
  document.documentElement.style.overflow = 'hidden'
}

function unlockScroll() {
  document.documentElement.style.overflow = ''
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOverlayOpen.value) closeOverlay()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  unlockScroll()
})

type AmenityRow = {
  amenity: AmenityDraft
  rawIndex: number
  resolvedId: string | null
  icon: any | null
}

type AmenityWithIndex = AmenityRow & {
  index: number
}

const previewAmenities = computed<AmenityRow[]>(() => {
  const ranked = amenities.value.map((amenity, index) => {
    const resolvedId = resolveAmenityId(amenity)
    return {
      amenity,
      rawIndex: index,
      resolvedId,
      icon: resolveAmenityIcon(resolvedId),
      index,
    } as AmenityWithIndex
  })

  return ranked
    .sort((a, b) => {
      if (Boolean((a.amenity as any)?.pinned) !== Boolean((b.amenity as any)?.pinned)) {
        return Number(Boolean((b.amenity as any)?.pinned)) - Number(Boolean((a.amenity as any)?.pinned))
      }
      if (((a.amenity as any)?.relevance ?? 0) !== ((b.amenity as any)?.relevance ?? 0)) {
        return ((b.amenity as any)?.relevance ?? 0) - ((a.amenity as any)?.relevance ?? 0)
      }
      return a.index - b.index
    })
    .slice(0, previewLimit)
})

const selectedAmenities = computed<AmenityRow[]>(() => {
  const list = amenities.value.map((amenity, rawIndex) => {
    const resolvedId = resolveAmenityId(amenity)
    return {
      amenity,
      rawIndex,
      resolvedId,
      icon: resolveAmenityIcon(resolvedId),
    }
  })

  list.sort((a, b) => {
    if (Boolean((a.amenity as any)?.pinned) !== Boolean((b.amenity as any)?.pinned)) {
      return Number(Boolean((b.amenity as any)?.pinned)) - Number(Boolean((a.amenity as any)?.pinned))
    }
    if (((a.amenity as any)?.relevance ?? 0) !== ((b.amenity as any)?.relevance ?? 0)) {
      return ((b.amenity as any)?.relevance ?? 0) - ((a.amenity as any)?.relevance ?? 0)
    }
    return String((a.amenity as any)?.name ?? '').localeCompare(String((b.amenity as any)?.name ?? ''))
  })

  return list
})

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

const categorizedSelectedAmenities = computed(() => {
  const categories: Record<string, AmenityRow[]> = {}
  const order: string[] = []

  selectedAmenities.value.forEach((entry) => {
    const category = String((entry.amenity as any)?.category ?? '').trim() || 'Autres'
    if (!categories[category]) {
      order.push(category)
      categories[category] = []
    }
    categories[category].push(entry)
  })

  return order.map((category) => ({ name: category, items: categories[category] }))
})

function tokenizeSearch(value: string): string[] {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

const catalogSearchTokens = computed(() => tokenizeSearch(catalogSearch.value))
const isCatalogSearchActive = computed(() => catalogSearchTokens.value.length > 0)

function matchesCatalogSearch(item: AmenityCatalogItem, tokens: string[]): boolean {
  if (!tokens.length) return true
  const haystack = `${item.name ?? ''} ${item.description ?? ''}`.toLowerCase()
  return tokens.some((token) => haystack.includes(token))
}

const catalogGroups = computed(() => {
  const tokens = catalogSearchTokens.value
  const includeAlreadyAdded = tokens.length > 0

  const groups = new Map<string, AmenityCatalogItem[]>()
  for (const item of catalog.value) {
    const id = normalizeAmenityId(item.id)
    if (!id) continue

    if (!includeAlreadyAdded && selectedAmenityIdSet.value.has(id)) continue
    if (!matchesCatalogSearch(item, tokens)) continue

    const key = item.category || 'Autres'
    const items = groups.get(key) ?? []
    items.push(item)
    groups.set(key, items)
  }

  const ordered = Array.from(groups.entries())
    .map(
      ([
        category,
        items,
      ]) => {
        items.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0) || a.name.localeCompare(b.name))
        return { category, items }
      },
    )
    .sort((a, b) => a.category.localeCompare(b.category))

  return ordered
})

function isCatalogCategoryOpen(category: string, size: number): boolean {
  if (isCatalogSearchActive.value) return true
  const current = catalogOpenCategories.value[category]
  if (typeof current === 'boolean') return current
  return size <= defaultCatalogOpenLimit
}

function toggleCatalogCategory(category: string, size: number) {
  catalogOpenCategories.value[category] = !isCatalogCategoryOpen(category, size)
}

watch(
  () => isCatalogSearchActive.value,
  (isActive) => {
    if (!isOverlayOpen.value) return
    if (overlayView.value !== 'catalog') return
    if (!isActive) return
    catalogGroups.value.forEach((group) => {
      catalogOpenCategories.value[group.category] = true
    })
  },
)

watchEffect(() => {
  if (!isOverlayOpen.value) return
  if (overlayView.value !== 'catalog') return

  catalogGroups.value.forEach((group) => {
    if (typeof catalogOpenCategories.value[group.category] === 'boolean') return
    catalogOpenCategories.value[group.category] = group.items.length <= defaultCatalogOpenLimit
  })
})
</script>

<template>
  <section class="editor-amenities-panel">
    <div class="header">
      <h3>Équipements</h3>
      <p>Aperçu des équipements visibles côté voyageurs.</p>
    </div>

    <div class="body">
      <ul
        v-if="previewAmenities.length"
        class="preview"
      >
        <li
          v-for="item in previewAmenities"
          :key="item.resolvedId || item.amenity.name || String(item.rawIndex)"
          class="item"
        >
          <component
            v-if="item.icon"
            :is="item.icon"
            class="icon"
            aria-hidden="true"
          />
          <span class="name">{{ item.amenity.name }}</span>
        </li>
      </ul>

      <p
        v-else
        class="empty"
      >
        Aucun équipement renseigné.
      </p>

      <div class="btn-primary__black__full">
        <button
          type="button"
          @click="openOverlay"
        >
          Gérer les équipements
        </button>
      </div>
    </div>

    <Transition name="editor-amenities-overlay">
      <div
        v-if="isOverlayOpen"
        class="editor-amenities-overlay"
        role="dialog"
        aria-modal="true"
        @click.self="closeOverlay"
      >
        <div class="panel">
          <div class="header">
            <div
              v-if="overlayView === 'catalog'"
              class="back"
            >
              <button
                type="button"
                @click="overlayView = 'list'"
              >
                <component
                  :is="resolveLucideComponent('arrow-left')"
                  :size="20"
                  aria-hidden="true"
                />
              </button>
            </div>
            <div class="title">
              <h2>{{ overlayView === 'catalog' ? 'Ajouter un équipement' : 'Équipements' }}</h2>
            </div>
            <div class="close">
              <button
                type="button"
                @click="closeOverlay"
              >
                <component
                  :is="resolveLucideComponent('x')"
                  :size="20"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <template v-if="overlayView === 'list'">
            <div class="body">
              <div
                v-for="category in categorizedSelectedAmenities"
                :key="category.name"
                class="category"
              >
                <h3>{{ category.name }}</h3>
                <ul>
                  <li
                    v-for="item in category.items"
                    :key="item.resolvedId || item.amenity.name || String(item.rawIndex)"
                    class="item"
                  >
                    <component
                      v-if="item.icon"
                      :is="item.icon"
                      class="icon"
                      aria-hidden="true"
                    />
                    <div class="texts">
                      <p class="name">
                        {{ item.amenity.name }}
                      </p>
                      <p
                        v-if="(item.amenity as any)?.description"
                        class="description"
                      >
                        {{ (item.amenity as any)?.description }}
                      </p>
                    </div>
                    <div class="actions">
                      <div
                        class="pin"
                        :class="{ 'is-active': Boolean((item.amenity as any)?.pinned) }"
                      >
                        <button
                          type="button"
                          @click="togglePinnedAt(item.rawIndex)"
                        >
                          <PinOff
                            v-if="Boolean((item.amenity as any)?.pinned)"
                            :size="18"
                          />
                          <Pin
                            v-else
                            :size="18"
                          />
                        </button>
                      </div>
                      <div class="remove">
                        <button
                          type="button"
                          @click="removeAmenityAt(item.rawIndex)"
                        >
                          <component
                            :is="resolveLucideComponent('x')"
                            :size="18"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            <div class="cta">
              <button
                type="button"
                @click="overlayView = 'catalog'"
              >
                + Ajouter un équipement
              </button>
            </div>
          </template>

          <template v-else>
            <div class="body">
              <div class="search">
                <input
                  v-model="catalogSearch"
                  type="search"
                  placeholder="Rechercher un équipement..."
                />
              </div>

              <template v-if="catalogGroups.length">
                <div
                  v-for="group in catalogGroups"
                  :key="group.category"
                  class="category"
                >
                  <button
                    type="button"
                    class="category-trigger"
                    @click="toggleCatalogCategory(group.category, group.items.length)"
                  >
                    <span class="category-title">{{ group.category }}</span>
                    <span class="category-meta">{{ group.items.length }}</span>
                    <component
                      :is="resolveLucideComponent('chevron-down')"
                      :size="18"
                      class="chevron"
                      :class="{ 'is-open': isCatalogCategoryOpen(group.category, group.items.length) }"
                      aria-hidden="true"
                    />
                  </button>
                  <ul
                    v-show="isCatalogCategoryOpen(group.category, group.items.length)"
                    class="list"
                  >
                    <li
                      v-for="item in group.items"
                      :key="item.id"
                      class="item"
                    >
                      <div class="item-btn">
                        <button
                          type="button"
                          :disabled="isAmenitySelected(item.id)"
                          @click="addAmenityFromCatalog(item)"
                        >
                          <div class="item-content">
                            <span class="item-icon">
                              <component
                                v-if="resolveAmenityIconComponent(item.id)"
                                :is="resolveAmenityIconComponent(item.id)"
                                aria-hidden="true"
                              />
                            </span>
                            <span class="item-texts">
                              <span class="item-title">{{ item.name }}</span>
                              <span
                                v-if="item.description"
                                class="item-desc"
                              >
                                {{ item.description }}
                              </span>
                            </span>
                            <span
                              v-if="isAmenitySelected(item.id)"
                              class="item-state"
                            >
                              Ajouté
                            </span>
                          </div>
                        </button>
                      </div>
                    </li>
                  </ul>
                </div>
              </template>

              <p
                v-else
                class="empty"
              >
                Aucun résultat.
              </p>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/amenities-panel.scss';
</style>
