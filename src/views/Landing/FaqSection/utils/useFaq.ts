// File: src/views/Landing/FaqSection/utils/useFaq.ts

import { ref, computed, watch } from 'vue'
import type { FaqNode } from '@/views/Landing/FaqSection/utils/faqData.ts'
import { faqData } from '@/views/Landing/FaqSection/utils/faqData.ts'
import { useHead } from '@unhead/vue'

export function useFaq() {
  // → L’arbre complet de la FAQ
  const data = ref<FaqNode[]>(faqData)

  // → Search text (réactif)
  const search = ref<string>('')

  // 1. Flat list de tous les noeuds (pour générer JSON-LD et suggestions)
  function flatNodes(nodes: FaqNode[]): FaqNode[] {
    return nodes.flatMap((n) =>
      n.children ? [n, ...flatNodes(n.children)] : [n]
    )
  }

  // 2. Suggestions (en fonction du search)
  const suggestions = computed<FaqNode[]>(() => {
    const term = search.value.trim().toLowerCase()
    if (term.length < 2) return []
    return flatNodes(data.value)
      .filter((n) => n.question && n.question.toLowerCase().includes(term))
  })

  function selectSuggestion(node: FaqNode) {
    search.value = node.question ?? ''
  }

  // 3. Filtrer l’arbre pour la vue principale
  function filterTree(nodes: FaqNode[], term: string): FaqNode[] {
    if (!term) return nodes
    return nodes
      .map((node) => {
        if (node.children) {
          const kids = filterTree(node.children, term)
          return kids.length ? { ...node, children: kids } : null
        }
        // Si c’est une feuille (question/answer), on check le contenu
        if (
          node.question?.toLowerCase().includes(term) ||
          node.answer?.toLowerCase().includes(term)
        ) {
          return node
        }
        return null
      })
      .filter(Boolean) as FaqNode[]
  }

  const filteredData = computed<FaqNode[]>(() =>
    filterTree(data.value, search.value.trim().toLowerCase())
  )

  // 4. Générer le JSON-LD pour le SEO
  const jsonLd = computed(() => {
    const questions = flatNodes(data.value).filter((n) => n.question)
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

  // Injecter le JSON-LD dans le head
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify(jsonLd.value),
      },
    ],
  })

  // 5. (Optionnel) tracker search sur Google Analytics
  function trackSearch() {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ; (window as any).gtag('event', 'faq_search', {
        search_term: search.value,
      })
    }
  }

  // Si besoin, tu peux watcher `search` pour déclencher automatiquement le GA
  watch(search, () => {
    if (search.value.length >= 2) {
      trackSearch()
    }
  })

  return {
    // données pour le template
    filteredData,
    suggestions,
    search,
    selectSuggestion,
  }
}
