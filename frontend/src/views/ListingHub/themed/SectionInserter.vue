<!-- File: src/views/ListingHub/themed/SectionInserter.vue -->

<!-- Le « + » entre deux sections, en mode édition : un clic propose les types de section, un second
     clic l'ajoute à cet endroit. Rendu par `ThemedHubPage`, stylé dans `themed-hub-page.scss`. -->

<script setup lang="ts">
import { AlignLeft, Columns2, Images, Plus, Star, X } from 'lucide-vue-next'
import type { Component } from 'vue'

import { ADDABLE_PAGE_SECTIONS, type AddablePageSectionType } from '@/domain/listings/pageThemes'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'add', type: AddablePageSectionType): void
}>()

const icons: Record<AddablePageSectionType, Component> = {
  'text-image': Columns2,
  text: AlignLeft,
  gallery: Images,
  rating: Star,
}
</script>

<template>
  <div
    class="section-inserter"
    :class="{ 'is-open': open }"
  >
    <span
      class="inserter-line"
      aria-hidden="true"
    />

    <button
      v-if="!open"
      type="button"
      class="inserter-add"
      aria-label="Ajouter une section ici"
      title="Ajouter une section ici"
      @click="emit('toggle')"
    >
      <Plus
        :size="22"
        aria-hidden="true"
      />
    </button>

    <div
      v-else
      class="inserter-menu"
      role="group"
      aria-label="Type de section à ajouter"
    >
      <button
        v-for="option in ADDABLE_PAGE_SECTIONS"
        :key="option.type"
        type="button"
        class="inserter-option"
        @click="emit('add', option.type)"
      >
        <component
          :is="icons[option.type]"
          :size="18"
          aria-hidden="true"
        />
        {{ option.label }}
      </button>
      <button
        type="button"
        class="inserter-close"
        aria-label="Ne rien ajouter"
        title="Ne rien ajouter"
        @click="emit('toggle')"
      >
        <X
          :size="18"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>
