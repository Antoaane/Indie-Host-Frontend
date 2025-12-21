<!-- File: src/views/Blog/components/PostHeader/PostHeader.vue -->

<script setup lang="ts">
import type { PayloadArticle, PayloadAuthor, PayloadCategory } from '@/types/payload'

interface Props {
  title: string
  author?: PayloadAuthor | string
  publishedDate?: string
  categories?: (PayloadCategory | string)[]
}

const props = defineProps<Props>()

/**
 * Formate une date au format français lisible
 */
function formatDate(dateString?: string): string {
  if (!dateString) return ''

  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Extrait le nom de l'auteur
 */
function getAuthorName(author?: PayloadAuthor | string): string {
  if (!author) return 'Auteur inconnu'
  if (typeof author === 'string') return 'Auteur inconnu'
  return author.name || 'Auteur inconnu'
}

/**
 * Extrait les catégories valides
 */
function getValidCategories(categories?: (PayloadCategory | string)[]): PayloadCategory[] {
  if (!categories || categories.length === 0) return []

  return categories
    .filter((cat): cat is PayloadCategory => typeof cat !== 'string')
}
</script>

<template>
  <header class="post-header">
    <h1 class="post-header__title">{{ title }}</h1>

    <div class="post-header__meta">
      <span class="post-header__author">Par {{ getAuthorName(author) }}</span>

      <span
        v-if="publishedDate"
        class="post-header__date"
      >
        <time :datetime="publishedDate">{{ formatDate(publishedDate) }}</time>
      </span>

      <div
        v-if="getValidCategories(categories).length > 0"
        class="post-header__categories"
      >
        <span
          v-for="category in getValidCategories(categories)"
          :key="category.id"
          class="post-header__category"
        >
          {{ category.name }}
        </span>
      </div>
    </div>
  </header>
</template>

<style lang="scss" src="./PostHeader.scss"></style>
