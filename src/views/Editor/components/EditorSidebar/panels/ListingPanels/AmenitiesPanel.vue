<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/AmenitiesPanel.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { RawCore } from '@/views/Listing/utils/fetchListingRaw'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { resolveAmenityIconComponent, resolveLucideComponent } from '@/utils/amenitiesIcons'
import { mockAmenitiesCatalog, type AmenityCatalogItem } from '@/views/Editor/mocks/amenitiesCatalog'

type AmenityDraft = NonNullable<RawCore['amenities']>[number]

const props = defineProps<{
  core?: Partial<RawCore> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const amenities = computed<AmenityDraft[]>(() => (props.core?.amenities as AmenityDraft[] | undefined) ?? [])
const isOverlayOpen = ref(false)
const catalog = computed<AmenityCatalogItem[]>(() => mockAmenitiesCatalog.amenities ?? [])

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

function isAmenitySelected(amenityId: string): boolean {
  const normalized = normalizeAmenityId(amenityId)
  if (!normalized) return false
  return amenities.value.some((amenity) => resolveAmenityId(amenity) === normalized)
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
  lockScroll()
}

function closeOverlay() {
  isOverlayOpen.value = false
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

const catalogByCategory = computed(() => {
  const groups = new Map<string, AmenityCatalogItem[]>()
  for (const item of catalog.value) {
    const key = item.category || 'Autres'
    const items = groups.get(key) ?? []
    items.push(item)
    groups.set(key, items)
  }

  const ordered = Array.from(groups.entries())
    .map(([category, items]) => {
      items.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0) || a.name.localeCompare(b.name))
      return { category, items }
    })
    .sort((a, b) => a.category.localeCompare(b.category))

  return ordered
})
</script>

<template>
  <section class="editor-amenities-panel">
    <div class="header">
      <h3>Équipements</h3>
      <p>Ajoutez/retirez des équipements depuis le catalogue (seul “pinned” est modifiable).</p>
    </div>

    <div class="body">
      <div class="amenities">
        <div
          v-for="item in selectedAmenities"
          :key="item.resolvedId || item.amenity.name || String(item.rawIndex)"
          class="row"
        >
          <div class="icon">
            <component
              v-if="item.icon"
              :is="item.icon"
              aria-hidden="true"
            />
          </div>

          <div class="label">
            <p class="name">
              {{ item.amenity.name }}
            </p>
            <p class="meta">
              {{ item.amenity.category }}
            </p>
          </div>

          <div
            class="pin"
            :class="{ 'is-active': Boolean(item.amenity.pinned) }"
          >
            <button
              type="button"
              @click="togglePinnedAt(item.rawIndex)"
            >
              ★
            </button>
          </div>
          <div class="remove">
            <button
              type="button"
              @click="removeAmenityAt(item.rawIndex)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <div class="btn-primary__black__full">
        <button
          type="button"
          @click="openOverlay"
        >
          + Ajouter un équipement
        </button>
      </div>
    </div>

    <Transition name="amenities-overlay">
      <div
        v-if="isOverlayOpen"
        class="overlay"
        role="dialog"
        aria-modal="true"
        @click.self="closeOverlay"
      >
        <div class="panel">
          <div class="header">
            <h3>Catalogue des équipements</h3>
            <div class="close">
              <button
                type="button"
                @click="closeOverlay"
              >
                ✕
              </button>
            </div>
          </div>

          <div class="body">
            <div
              v-for="group in catalogByCategory"
              :key="group.category"
              class="category"
            >
              <h4>{{ group.category }}</h4>
              <ul class="list">
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
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style lang="scss">
@use '@/views/Editor/components/EditorSidebar/panels/ListingPanels/amenities-panel.scss';
</style>
