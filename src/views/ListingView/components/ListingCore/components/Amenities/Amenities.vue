<!-- File: src/views/ListingView/components/ListingCore/components/Amenities/Amenities.vue -->

<script setup lang="ts">
// DEPS
import { computed, ref } from 'vue'
import * as LucideIcons from 'lucide-vue-next'

// TYPES
import type { AmenitiesModel } from '@/views/ListingView/types/listing'

interface StaticContent {
  title: string
  ctaLabel: string
  overlayTitle?: string
}

interface AmenityWithIndex {
  name: string
  description?: string
  icon: string
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

function toPascalCase(name: string): string {
  return name
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
}

function resolveIcon(name: string) {
  const key = toPascalCase(name)
  return (LucideIcons as Record<string, any>)[key] ?? null
}

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
  <section class="amenities-listing__comp">
    <div class="amenities-listing__header">
      <h2>
        {{ staticContent.title }}
      </h2>
    </div>

    <ul
      v-if="previewAmenities.length"
      class="amenities-listing__preview"
    >
      <li
        v-for="amenity in previewAmenities"
        :key="amenity.name + amenity.icon"
      >
        <component
          :is="resolveIcon(amenity.icon)"
          class="amenity-icon"
          aria-hidden="true"
        />
        <span class="amenity-name">{{ amenity.name }}</span>
      </li>
    </ul>

    <div class="amenities-listing__cta">
      <button
        type="button"
        @click="openOverlay"
      >
        {{ staticContent.ctaLabel }}
      </button>
    </div>

    <div
      v-if="isOverlayOpen"
      class="amenities-overlay"
      role="dialog"
      aria-modal="true"
      @click.self="closeOverlay"
    >
      <div class="amenities-overlay__panel">
        <div class="amenities-overlay__header">
          <div class="amenities-overlay__title">
            <h2>{{ staticContent.overlayTitle || staticContent.title }}</h2>
          </div>
          <div class="amenities-overlay__close">
            <button
              type="button"
              @click="closeOverlay"
            >
              <component
                :is="resolveIcon('x')"
                :size="20"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <div class="amenities-overlay__body">
          <div
            v-for="category in categorizedAmenities"
            :key="category.name"
            class="amenities-overlay__category"
          >
            <h3>{{ category.name }}</h3>
            <ul>
              <li
                v-for="amenity in category.items"
                :key="`${category.name}-${amenity.name}`"
              >
                <component
                  :is="resolveIcon(amenity.icon)"
                  class="amenity-icon"
                  aria-hidden="true"
                />
                <div class="amenity-texts">
                  <p class="amenity-name">{{ amenity.name }}</p>
                  <p
                    v-if="amenity.description"
                    class="amenity-description"
                  >
                    {{ amenity.description }}
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingCore/components/Amenities/amenities.scss';
</style>
