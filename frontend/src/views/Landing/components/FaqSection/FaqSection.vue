<!-- File: src/views/Landing/components/FaqSection/FaqSection.vue -->

<script setup lang="ts">
// COMPONENTS
import FaqItem from '@/views/Landing/components/FaqSection/components/FaqItem/FaqItem.vue'
import { useFaq } from '@/views/Landing/components/FaqSection/utils/useFaq'
// CONTENT
import type { FaqContent } from '@/views/Landing/types/content'

const props = defineProps<{
  content: FaqContent
}>()

const { filteredData, suggestions, search, selectSuggestion } = useFaq(props.content.nodes)
</script>

<template>
  <section id="faq-section">
    <div class="wrapper__xl">
      <h2 v-html="props.content.title" />

      <!-- Input de recherche -->
      <div class="faq-search">
        <input
          v-model="search"
          type="search"
          enterkeyhint="search"
          :placeholder="props.content.searchPlaceholder"
          :aria-label="props.content.searchLabel"
          autocomplete="off"
        />
      </div>

      <!-- Dropdown de suggestions -->
      <ul
        v-if="suggestions.length"
        class="autocomplete"
      >
        <li
          v-for="s in suggestions"
          :key="s.id"
          @click="selectSuggestion(s)"
        >
          {{ s.question }}
        </li>
      </ul>

      <!-- Liste filtrée des catégories + questions -->
      <ul class="faq-list">
        <FaqItem
          v-for="node in filteredData"
          :key="node.id"
          :node="node"
          :search="search"
        />
      </ul>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/FaqSection/faq-section.scss';
</style>
