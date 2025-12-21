<!-- File: src/views/Blog/components/BlogHeroSection/BlogHeroSection.vue -->

File: src/views/Blog/components/BlogHeroSection/BlogHeroSection.vue

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getLatestPublishedArticle, PayloadApiError } from '@/services/payloadApi'
import type { PayloadArticle, PayloadMedia } from '@/types/payload'

// Interface pour l'article mis en avant (adapté à Payload)
interface FeaturedArticle {
  id: string
  title: string
  slug: string
  excerpt?: string
  publishedDate?: string
  image?: {
    url: string
    alt: string
    width?: number
    height?: number
  }
}

// État du composant
const article = ref<FeaturedArticle | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

// Formater la date
const formattedDate = computed(() => {
  if (!article.value?.publishedDate) return ''

  const date = new Date(article.value.publishedDate)
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

// Gestion de l'effet thermique sur le bouton
const mousePosition = ref({ x: 50, y: 50 })

const handleMouseMove = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * 100
  const y = ((e.clientY - rect.top) / rect.height) * 100
  mousePosition.value = { x, y }
}

/**
 * Transforme un article Payload en FeaturedArticle pour l'affichage
 */
function transformPayloadArticle(payloadArticle: PayloadArticle): FeaturedArticle {
  // Extraire l'image si elle existe et est populée (objet, pas juste un ID)
  let imageData: FeaturedArticle['image'] | undefined

  if (
    payloadArticle.featuredImage &&
    typeof payloadArticle.featuredImage === 'object'
  ) {
    const media = payloadArticle.featuredImage as PayloadMedia
    // Construire l'URL complète si l'URL est relative
    let imageUrl = media.url
    if (!imageUrl.startsWith('http')) {
      // En développement, utilise le proxy Vite
      // En production, utilise l'URL complète du CMS
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
    excerpt: payloadArticle.excerpt,
    publishedDate: payloadArticle.publishedDate,
    image: imageData,
  }
}

/**
 * Charge le dernier article publié depuis l'API Payload
 */
async function loadLatestArticle() {
  isLoading.value = true
  error.value = null

  try {
    const latestArticle = await getLatestPublishedArticle()

    if (!latestArticle) {
      error.value = 'Aucun article publié disponible pour le moment.'
      article.value = null
    } else {
      article.value = transformPayloadArticle(latestArticle)
    }
  } catch (err) {
    if (err instanceof PayloadApiError) {
      error.value = `Erreur lors du chargement de l'article : ${err.message}`
    } else {
      error.value = 'Une erreur inattendue s\'est produite lors du chargement de l\'article.'
    }
    console.error('Erreur lors du chargement de l\'article:', err)
    article.value = null
  } finally {
    isLoading.value = false
  }
}

// Charger l'article au montage du composant
onMounted(() => {
  loadLatestArticle()
})
</script>

<template>
  <div class="blog-hero">
    <!-- État de chargement - Skeleton loader -->
    <div
      v-if="isLoading"
      class="blog-hero__skeleton"
      aria-label="Chargement de l'article en cours"
    >
      <div class="blog-hero__inner">
        <div class="blog-hero__content">
          <div class="blog-hero__image-wrap">
            <div class="skeleton skeleton--image"></div>
          </div>
          <div class="blog-hero__text-wrap">
            <div class="skeleton skeleton--title"></div>
            <div class="skeleton skeleton--excerpt"></div>
            <div class="skeleton skeleton--excerpt"></div>
            <div class="skeleton skeleton--button"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- État d'erreur -->
    <div
      v-else-if="error"
      class="blog-hero__error"
      role="alert"
    >
      <div class="blog-hero__inner">
        <div class="blog-hero__error-content">
          <h2 class="blog-hero__error-title">Impossible de charger l'article</h2>
          <p class="blog-hero__error-message">{{ error }}</p>
          <button
            class="blog-hero__retry-button btn btn--gradient"
            @click="loadLatestArticle"
          >
            <span class="btn__text">Réessayer</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Article chargé avec succès -->
    <article
      v-else-if="article"
      class="blog-hero__article"
      :data-post-id="article.id"
    >
      <div class="blog-hero__inner">
        <div class="blog-hero__content">
          <!-- Image (affichée uniquement si présente) -->
          <div
            v-if="article.image"
            class="blog-hero__image-wrap"
          >
            <div class="blog-hero__image-container">
              <router-link
                :to="`/blog/${article.slug}`"
                class="blog-hero__image-link"
                tabindex="-1"
              >
                <img
                  :src="article.image.url"
                  :alt="article.image.alt"
                  :width="article.image.width"
                  :height="article.image.height"
                  class="blog-hero__image"
                  loading="eager"
                />
              </router-link>
            </div>
          </div>

          <!-- Texte -->
          <div class="blog-hero__text-wrap">
            <!-- Titre -->
            <h2 class="blog-hero__title">
              <router-link
                :to="`/blog/${article.slug}`"
                class="blog-hero__title-link"
              >
                {{ article.title }}
              </router-link>
            </h2>

            <!-- Date de publication -->
            <div
              v-if="formattedDate"
              class="blog-hero__date"
            >
              <time :datetime="article.publishedDate">{{ formattedDate }}</time>
            </div>

            <!-- Extrait -->
            <div
              v-if="article.excerpt"
              class="blog-hero__excerpt"
            >
              <p>{{ article.excerpt }}</p>
            </div>

            <!-- Bouton CTA -->
            <router-link
              :to="`/blog/${article.slug}`"
              class="blog-hero__cta btn btn--gradient"
              @mousemove="handleMouseMove"
            >
              <span class="btn__text">En savoir plus</span>
            </router-link>
          </div>
        </div>
      </div>
    </article>
  </div>
</template>

<style lang="scss" src="./BlogHeroSection.scss"></style>
