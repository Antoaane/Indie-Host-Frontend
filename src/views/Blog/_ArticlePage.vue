<!-- File: src/views/Blog/_ArticlePage.vue -->

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getArticleBySlug, PayloadApiError } from '@/services/payloadApi'
import type { PayloadArticle, PayloadCategory } from '@/types/payload'

// COMPONENTS
import PostHeader from './components/PostHeader/PostHeader.vue'
import PostExcerpt from './components/PostExcerpt/PostExcerpt.vue'
import PostImage from './components/PostImage/PostImage.vue'
import PostContent from './components/PostContent/PostContent.vue'
import PostTeaser from './components/PostTeaser/PostTeaser.vue'

const route = useRoute()
const router = useRouter()

// État du composant
const article = ref<PayloadArticle | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

/**
 * Extrait les IDs des catégories
 */
const categoryIds = computed((): string[] => {
  if (!article.value?.category || article.value.category.length === 0) {
    return []
  }

  return article.value.category
    .map(cat => {
      if (typeof cat === 'string') return cat
      return (cat as PayloadCategory).id
    })
    .filter((id): id is string => id !== null && id !== undefined)
})

/**
 * Charge l'article depuis l'API
 */
async function loadArticle(slug: string) {
  isLoading.value = true
  error.value = null
  article.value = null

  try {
    const response = await getArticleBySlug(slug)

    if (!response) {
      error.value = 'Article non trouvé'
      article.value = null
    } else {
      article.value = response
    }
  } catch (err) {
    if (err instanceof PayloadApiError) {
      error.value = `Erreur lors du chargement de l'article : ${err.message}`
    } else {
      error.value = 'Une erreur inattendue s\'est produite.'
    }
    console.error('❌ [ArticlePage] Erreur:', err)
    article.value = null
  } finally {
    isLoading.value = false
  }
}

/**
 * Retour à la page blog
 */
function goBackToBlog() {
  router.push('/blog')
}

// Charger l'article au montage et quand le slug change
onMounted(() => {
  const slug = route.params.slug as string
  if (slug) {
    loadArticle(slug)
  }
})

watch(
  () => route.params.slug,
  (newSlug) => {
    if (newSlug) {
      loadArticle(newSlug as string)
    }
  }
)
</script>

<template>
  <main
    id="article-page"
    class="article-page"
  >
    <div class="container__xl">
      <!-- État de chargement -->
      <div
        v-if="isLoading"
        class="article-page__loading"
      >
        <p>Chargement de l'article...</p>
      </div>

      <!-- État d'erreur -->
      <div
        v-else-if="error"
        class="article-page__error"
      >
        <h1>Erreur</h1>
        <p>{{ error }}</p>
        <button
          class="article-page__back-button"
          @click="goBackToBlog"
        >
          Retour au blog
        </button>
      </div>

      <!-- Article -->
      <article
        v-else-if="article"
        class="article-page__article"
      >
        <!-- Bouton retour -->
        <button
          class="article-page__back-button article-page__back-button--top"
          @click="goBackToBlog"
        >
          ← Retour au blog
        </button>

        <!-- Header -->
        <PostHeader
          :title="article.title"
          :author="article.author"
          :published-date="article.publishedDate"
          :categories="article.category"
        />

        <!-- Excerpt -->
        <PostExcerpt :excerpt="article.excerpt" />

        <!-- Image -->
        <PostImage
          :image="article.featuredImage"
          :title="article.title"
        />

        <!-- Content -->
        <PostContent :content="article.content" />

        <!-- Articles connexes -->
        <PostTeaser
          v-if="categoryIds.length > 0"
          :current-slug="article.slug"
          :category-ids="categoryIds"
        />
      </article>
    </div>
  </main>
</template>

<style lang="scss" src="@/views/Blog/_article-page.scss"></style>
