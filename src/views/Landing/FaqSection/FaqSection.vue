<!-- File: src/views/Landing/FaqSection/FaqSection.vue -->

<script setup lang="ts">
// COMPONENTS
import FaqItem from '@/views/Landing/FaqSection/components/FaqItem/FaqItem.vue'
import { useFaq } from '@/views/Landing/FaqSection/utils/useFaq'
// CONTENT
import type { ItemSection, ContentBlock } from '@/content/types'
import rawContent from '@/content/fr/Landing/faq-section.json'

const section = rawContent as unknown as ItemSection
const items = section.items as Record<string, ContentBlock>

const { filteredData, suggestions, search, selectSuggestion } = useFaq()
</script>

<template>
  <section
    :id="section.id"
    itemscope
    itemtype="https://schema.org/FAQPage"
  >
    <div class="container__xl">
      <h2>
        {{ items['title-1'].content }}
      </h2>

      <!-- Input de recherche -->
      <input
        v-model="search"
        type="search"
        :placeholder="items['input-1'].meta?.placeholder"
        :aria-label="items['input-1'].meta?.ariaLabel"
        class="faq-search"
        autocomplete="off"
      />

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
@use '@/views/Landing/FaqSection/faq-section.scss';
</style>
