// File: src/views/Landing/components/FaqSection/utils/useFaq.ts

// DEPS
import { ref, computed } from 'vue'
import { useHead } from '@unhead/vue'

import { normalizeSearchText } from '@/utils/search'
import type { FaqNode } from '@/views/Landing/types/content'
export function useFaq(initialNodes: FaqNode[] = []) {
  // → L’arbre complet de la FAQ
  const data = ref<FaqNode[]>(initialNodes)

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
    const term = normalizeSearchText(search.value)
    if (term.length < 2) return []
    return flatNodes(data.value).filter((n) => normalizeSearchText(n.question).includes(term))
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
          normalizeSearchText(node.question).includes(term) ||
          normalizeSearchText(node.answer).includes(term)
        ) {
          return node
        }
        return null
      })
      .filter(Boolean) as FaqNode[]
  }

  const filteredData = computed<FaqNode[]>(() =>
    filterTree(data.value, normalizeSearchText(search.value))
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

  // Aucune mesure d'audience : les recherches saisies dans la FAQ restent dans le navigateur.

  return {
    // données pour le template
    filteredData,
    suggestions,
    search,
    selectSuggestion,
  }
}
