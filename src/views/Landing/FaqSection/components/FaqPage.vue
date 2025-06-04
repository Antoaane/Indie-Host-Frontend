<!-- File: src/views/Landing/FaqSection/components/FaqPage.vue -->

<script setup lang="ts">
import type { FaqNode } from '@/views/Landing/FaqSection/components/FaqItem.vue'
import FaqItem from '@/views/Landing/FaqSection/components/FaqItem.vue'
import { useFaq } from '@/views/Landing/FaqSection/utils/useFaq'

// Récupère le tree complet depuis le parent (faqData.ts ou FaqSection.vue)
const props = defineProps<{ data: FaqNode[] }>()

/** On injecte le composable qui gère  :
 *  - search
 *  - suggestions
 *  - filteredData
 *  - JSON-LD (via useHead)
 *  - trackSearch automatique
 */
const { filteredData, suggestions, search, selectSuggestion } = useFaq()

// Si tu veux vraiment passer `props.data` à `useFaq` pour gérer dynamiquement,
// tu peux remplacer `data = ref(faqData)` dans useFaq, par `data = ref(props.data)`.
</script>

<template>
  <section
    id="faq-section"
    itemscope
    itemtype="https://schema.org/FAQPage"
  >
    <div class="container__xl">
      <h2>Questions fréquentes sur IndieHost</h2>

      <!-- Input de recherche -->
      <input
        v-model="search"
        type="search"
        placeholder="Rechercher avec un mot clé"
        aria-label="Recherche FAQ"
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
@use '@/assets/styles/variables/globals' as *;
@use '@/assets/styles/variables/borders' as borders;
@use '@/assets/styles/components/buttons' as buttons;
@use '@/assets/styles/components/inputs' as inputs;

#faq-section {
  h2 {
    text-align: center;
    @include h2-title($accent, false);
    @include gutters(margin, bottom, 3);
  }

  .faq-search {
    display: block;
    width: 100%;

    @include inputs.text($accent);
  }

  .autocomplete {
    max-height: 15rem;
    padding: 1rem 0 0 0;
    margin: 0;

    overflow-y: auto;

    border-radius: 0 0 borders.$rounded-md borders.$rounded-md;
    background-color: rgba($accent, 0.1);

    transform: translateY(-0.5rem);
    @include gutters(padding, bottom, 0.25);

    li {
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      @include little-text($accent);
    }
  }

  .faq-list {
    list-style: none;
    padding: 0;

    > li {
      border-top: 1px solid $accent;

      &:first-child {
        border-top: none !important;
      }
    }
  }
}
</style>
