<!-- File: src/views/Landing/components/FaqSection/components/FaqItem/FaqItem.vue -->

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed } from 'vue'
import FaqCollapse from '@/views/Landing/components/FaqSection/components/FaqCollapse/FaqCollapse.vue'

// Type extrait du fichier faqData.ts
export interface FaqNode {
  id: string
  title?: string
  question?: string
  answer?: string
  children?: FaqNode[]
}

const props = defineProps<{
  node: FaqNode
  search?: string
}>()

// On détecte si c’est une catégorie (avec enfants) ou une question (feuille)
const isCategory = computed(() => Array.isArray(props.node.children) && props.node.children.length > 0)

// Fonction pour surligner le terme recherché dans le texte
function highlight(text?: string) {
  if (!text || !props.search) return text ?? ''
  // On échappe les caractères spéciaux pour la regex
  const escapedTerm = props.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedTerm})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}
</script>

<template>
  <li :key="props.node.id">
    <!-- Si c’est une catégorie, on affiche le titre puis on itère sur les enfants -->
    <template v-if="isCategory">
      <FaqCollapse>
        <!-- Résumé : titre de catégorie -->
        <template #summary>
          <h3>{{ props.node.title }}</h3>
        </template>
        <!-- Contenu : liste d’enfants -->
        <template #content>
          <ul>
            <FaqItem
              v-for="child in props.node.children"
              :key="child.id"
              :node="child"
              :search="props.search"
            />
          </ul>
        </template>
      </FaqCollapse>
    </template>

    <!-- Sinon, c’est une question/réponse -->
    <template v-else>
      <FaqCollapse>
        <!-- Résumé : question -->
        <template #summary>
          <h4
            v-html="highlight(props.node.question)"
            itemprop="name"
          />
        </template>
        <!-- Contenu : réponse -->
        <template #content>
          <div
            itemprop="acceptedAnswer"
            itemtype="https://schema.org/Answer"
            itemscope
          >
            <p
              v-html="highlight(props.node.answer)"
              itemprop="text"
            />
          </div>
        </template>
      </FaqCollapse>
    </template>
  </li>
</template>

<style scoped lang="scss">
@use '@/views/Landing/components/FaqSection/components/FaqItem/faq-item.scss';
</style>
