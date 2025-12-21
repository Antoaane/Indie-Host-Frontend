<!-- File: src/views/Blog/components/PostTeaser/PostTeaser.vue -->

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getRelatedArticles, PayloadApiError } from '@/services/payloadApi'
import type { PayloadArticle, PayloadMedia, PayloadCategory } from '@/types/payload'

interface Props {
  currentSlug: string
  categoryIds: string[]
}

const props = defineProps<Props>()

// Interface pour les articles connexes
interface RelatedArticleCard {
  id: string
  title: string
  slug: string
  publishedDate?: string
  image?: {
    url: string
    alt: string
    width?: number
    height?: number
  }
}

// État du composant
const articles = ref<RelatedArticleCard[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

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
 * Transforme un article Payload en RelatedArticleCard
 */
function transformPayloadArticle(payloadArticle: PayloadArticle): RelatedArticleCard {
  let imageData: RelatedArticleCard['image'] | undefined

  if (
    payloadArticle.featuredImage &&
    typeof payloadArticle.featuredImage === 'object'
  ) {
    const media = payloadArticle.featuredImage as PayloadMedia
    let imageUrl = media.url
    if (!imageUrl.startsWith('http')) {
      imageUrl = import.meta.env.DEV
        ? imageUrl
        : `${import.meta.env.VITE_PAYLOAD_API_URL}${imageUrl}`
    }

    imageData = {
      url: imageUrl,
      alt: media.alt || payloadArticle.title,
      width: media.width,
      height: media.height,
    }
  }

  return {
    id: payloadArticle.id,
    title: payloadArticle.title,
    slug: payloadArticle.slug,
    publishedDate: payloadArticle.publishedDate,
    image: imageData,
  }
}

/**
 * Charge les articles connexes
 */
async function loadRelatedArticles() {
  isLoading.value = true
  error.value = null

  try {
    const response = await getRelatedArticles(props.categoryIds, props.currentSlug, 4)

    if (!response || response.length === 0) {
      articles.value = []
    } else {
      articles.value = response.map(transformPayloadArticle)
    }
  } catch (err) {
    if (err instanceof PayloadApiError) {
      error.value = `Erreur lors du chargement des articles connexes : ${err.message}`
    } else {
      error.value = 'Une erreur inattendue s\'est produite.'
    }
    console.error('❌ [PostTeaser] Erreur:', err)
    articles.value = []
  } finally {
    isLoading.value = false
  }
}

// Charger les articles au montage
onMounted(() => {
  if (props.categoryIds && props.categoryIds.length > 0) {
    loadRelatedArticles()
  } else {
    isLoading.value = false
  }
})
</script>

<template>
  <section
    v-if="!isLoading && articles.length > 0"
    class="post-teaser"
  >
    <h2 class="post-teaser__title">Articles connexes</h2>

    <div class="post-teaser__grid">
      <article
        v-for="article in articles"
        :key="article.id"
        class="post-teaser__card"
      >
        <router-link
          :to="`/blog/${article.slug}`"
          class="post-teaser__card-link"
        >
          <!-- Image -->
          <div
            v-if="article.image"
            class="post-teaser__card-image-wrap"
          >
            <img
              :src="article.image.url"
              :alt="article.image.alt"
              :width="article.image.width"
              :height="article.image.height"
              class="post-teaser__card-image"
              loading="lazy"
            />
          </div>

          <!-- Contenu -->
          <div class="post-teaser__card-content">
            <h3 class="post-teaser__card-title">{{ article.title }}</h3>

            <div
              v-if="article.publishedDate"
              class="post-teaser__card-date"
            >
              <time :datetime="article.publishedDate">
                {{ formatDate(article.publishedDate) }}
              </time>
            </div>
          </div>
        </router-link>
      </article>
    </div>
  </section>
</template>

<style lang="scss" src="./PostTeaser.scss"></style>
