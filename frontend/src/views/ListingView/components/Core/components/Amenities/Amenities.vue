<!-- File: src/views/ListingView/components/Core/components/Amenities/Amenities.vue -->

<script setup lang="ts">
// DEPS
import { computed, ref } from 'vue'
import AbsoluteOverlay from '@/components/overlays/AbsoluteOverlay.vue'

// TYPES
import type { AmenitiesModel } from '@/views/ListingView/types/listing'
import { resolveAmenityIconComponent, resolveLucideComponent } from '@/utils/amenitiesIcons'

interface StaticContent {
  title: string
  ctaLabel: string
  overlayTitle?: string
}

interface AmenityWithIndex {
  id: string
  name: string
  description?: string
  category: string
  relevance: number
  pinned: boolean
  index: number
}

// CONTENT
const props = defineProps<{
  data: AmenitiesModel
  staticContent: StaticContent
  previewCount?: number
}>()

const isOverlayOpen = ref(false)

const amenities = computed(() => props.data ?? [])

const previewLimit = computed(() => props.previewCount ?? 8)

const previewAmenities = computed(() => {
  const ranked = amenities.value.map((amenity, index) => ({
    ...amenity,
    index,
  })) as AmenityWithIndex[]

  return ranked
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned)
      if (a.relevance !== b.relevance) return b.relevance - a.relevance
      return a.index - b.index
    })
    .slice(0, previewLimit.value)
})

const categorizedAmenities = computed(() => {
  const categories: Record<string, AmenityWithIndex[]> = {}
  const order: string[] = []

  amenities.value.forEach((amenity, index) => {
    const entry = { ...amenity, index } as AmenityWithIndex
    if (!categories[amenity.category]) {
      order.push(amenity.category)
      categories[amenity.category] = []
    }
    categories[amenity.category].push(entry)
  })

  return order.map((category) => ({ name: category, items: categories[category] }))
})

function openOverlay() {
  isOverlayOpen.value = true
}

function closeOverlay() {
  isOverlayOpen.value = false
}
</script>

<template>
  <section class="listing-amenities">
    <div class="header">
      <h2 v-html="staticContent.title"></h2>
    </div>

    <ul
      v-if="previewAmenities.length"
      class="preview"
    >
      <li
        v-for="amenity in previewAmenities"
        :key="amenity.id"
        class="item"
      >
        <component
          v-if="resolveAmenityIconComponent(amenity.id)"
          :is="resolveAmenityIconComponent(amenity.id)"
          class="icon"
          aria-hidden="true"
        />
        <span
          class="name"
          v-html="amenity.name"
        ></span>
      </li>
    </ul>

    <div class="cta">
      <button
        type="button"
        @click="openOverlay"
        v-html="staticContent.ctaLabel"
      ></button>
    </div>

    <AbsoluteOverlay
      class="amenities-overlay"
      :open="isOverlayOpen"
      aria-label="Tous les équipements"
      @close="closeOverlay"
    >
      <div class="panel">
        <div class="header">
          <div class="title">
            <h2 v-html="staticContent.overlayTitle || staticContent.title"></h2>
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

        <div class="body">
          <div
            v-for="category in categorizedAmenities"
            :key="category.name"
            class="category"
          >
            <h3 v-html="category.name"></h3>
            <ul>
              <li
                v-for="amenity in category.items"
                :key="`${category.name}-${amenity.id}`"
                class="item"
              >
                <component
                  v-if="resolveAmenityIconComponent(amenity.id)"
                  :is="resolveAmenityIconComponent(amenity.id)"
                  class="icon"
                  aria-hidden="true"
                />
                <div class="texts">
                  <p
                    class="name"
                    v-html="amenity.name"
                  />
                  <p
                    v-if="amenity.description"
                    class="description"
                    v-html="amenity.description"
                  />
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </AbsoluteOverlay>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Core/components/Amenities/amenities.scss';
</style>
