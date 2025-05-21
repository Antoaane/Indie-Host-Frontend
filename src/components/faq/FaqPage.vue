<!-- File: src/components/faq/FaqPage.vue -->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHead } from '@unhead/vue'
import FaqItem from '@/components/faq/FaqItem.vue'

export interface FaqNode {
  id: string
  title?: string
  question?: string
  answer?: string
  children?: FaqNode[]
}

const props = defineProps<{ data: FaqNode[] }>()

/* -------------------------
   Search & GA tracking
------------------------- */
const search = ref('')

function trackSearch() {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    ;(window as any).gtag('event', 'faq_search', {
      search_term: search.value,
    })
  }
}

const suggestions = computed(() => (search.value.length < 2 ? [] : flatNodes(props.data).filter((n) => n.question && n.question.toLowerCase().includes(search.value.toLowerCase()))))

function selectSuggestion(node: FaqNode) {
  search.value = node.question ?? ''
}

/* -------------------------
   Filtering helpers
------------------------- */
function flatNodes(nodes: FaqNode[]): FaqNode[] {
  return nodes.flatMap((n) => (n.children ? [n, ...flatNodes(n.children)] : n))
}

function filterTree(nodes: FaqNode[], term: string): FaqNode[] {
  if (!term) return nodes
  return nodes
    .map((node) => {
      if (node.children) {
        const kids = filterTree(node.children, term)
        return kids.length ? { ...node, children: kids } : null
      }
      if (node.question?.toLowerCase().includes(term) || node.answer?.toLowerCase().includes(term)) {
        return node
      }
      return null
    })
    .filter(Boolean) as FaqNode[]
}

const filteredData = computed(() => filterTree(props.data, search.value.trim().toLowerCase()))

/* -------------------------
   JSON-LD generation
------------------------- */
const jsonLd = computed(() => {
  const questions = flatNodes(props.data).filter((n) => n.question)
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  }
})

useHead({ script: [{ type: 'application/ld+json', innerHTML: jsonLd }] })
</script>

<template>
  <section
    id="faq-section"
    itemscope
    itemtype="https://schema.org/FAQPage"
  >
    <div class="container__xl">
      <h2>Questions fréquentes sur IndieHost</h2>

      <input
        v-model="search"
        type="search"
        placeholder="Rechercher avec un mot clé"
        aria-label="Recherche FAQ"
        class="faq-search"
        autocomplete="off"
        @input="trackSearch"
      />

      <!-- Auto-complete dropdown -->
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
