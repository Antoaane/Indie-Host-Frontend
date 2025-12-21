<!-- File: src/views/Blog/components/BlogPinnedSection/BlogPinnedSection.vue -->

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getPinnedArticles, PayloadApiError } from '@/services/payloadApi'
import type { PayloadArticle, PayloadMedia } from '@/types/payload'

// Interface pour les articles affichés dans les cartes
interface PinnedArticleCard {
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
const articles = ref<PinnedArticleCard[]>([])
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
 * Transforme un article Payload en PinnedArticleCard pour l'affichage
 */
function transformPayloadArticle(payloadArticle: PayloadArticle): PinnedArticleCard {
  // Extraire l'image si elle existe et est populée (objet, pas juste un ID)
  let imageData: PinnedArticleCard['image'] | undefined

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
    publishedDate: payloadArticle.publishedDate,
    image: imageData,
  }
}

/**
 * Charge les articles épinglés depuis l'API Payload
 */
async function loadPinnedArticles() {
  isLoading.value = true
  error.value = null

  console.log('🔍 [BlogPinnedSection] Début du chargement des articles épinglés...')

  try {
    const pinnedArticles = await getPinnedArticles()

    console.log('📦 [BlogPinnedSection] Articles reçus:', pinnedArticles)
    console.log('📊 [BlogPinnedSection] Nombre d\'articles:', pinnedArticles?.length || 0)

    if (!pinnedArticles || pinnedArticles.length === 0) {
      console.warn('⚠️ [BlogPinnedSection] Aucun article épinglé trouvé')
      articles.value = []
    } else {
      articles.value = pinnedArticles.map(transformPayloadArticle)
      console.log('✅ [BlogPinnedSection] Articles transformés:', articles.value)
    }
  } catch (err) {
    if (err instanceof PayloadApiError) {
      error.value = `Erreur lors du chargement des articles : ${err.message}`
      console.error('❌ [BlogPinnedSection] PayloadApiError:', err)
    } else {
      error.value = 'Une erreur inattendue s\'est produite lors du chargement des articles.'
      console.error('❌ [BlogPinnedSection] Erreur inconnue:', err)
    }
    articles.value = []
  } finally {
    isLoading.value = false
    console.log('🏁 [BlogPinnedSection] Chargement terminé. isLoading:', isLoading.value, 'articles:', articles.value.length)
  }
}

// Charger les articles au montage du composant
onMounted(() => {
  loadPinnedArticles()
})
</script>

<template>
  <!-- État de chargement -->
  <div
    v-if="isLoading"
    class="blog-pinned blog-pinned--loading"
  >
    <div class="blog-pinned__divider"></div>
    <div class="blog-pinned__header">
      <h3 class="blog-pinned__title">Actualités</h3>
    </div>
    <p style="text-align: center; color: #666;">Chargement des articles épinglés...</p>
  </div>

  <!-- État d'erreur (pour debug) -->
  <div
    v-else-if="error"
    class="blog-pinned blog-pinned--error"
    style="padding: 2rem; text-align: center;"
  >
    <p style="color: #d32f2f;">{{ error }}</p>
  </div>

  <!-- Section affichée uniquement si des articles sont disponibles -->
  <section
    v-else-if="articles.length > 0"
    class="blog-pinned"
  >
    <!-- Barre de délimitation -->
    <div class="blog-pinned__divider"></div>

    <!-- Titre de section -->
    <div class="blog-pinned__header">
      <h3 class="blog-pinned__title">Actualités</h3>
    </div>

    <!-- Grille de cartes d'articles -->
    <div class="blog-pinned__grid">
      <article
        v-for="article in articles"
        :key="article.id"
        class="blog-pinned__card"
      >
        <router-link
          :to="`/blog/${article.slug}`"
          class="blog-pinned__card-link"
        >
          <!-- Image de l'article -->
          <div
            v-if="article.image"
            class="blog-pinned__card-image-wrap"
          >
            <img
              :src="article.image.url"
              :alt="article.image.alt"
              :width="article.image.width"
              :height="article.image.height"
              class="blog-pinned__card-image"
              loading="lazy"
            />
          </div>

          <!-- Contenu texte -->
          <div class="blog-pinned__card-content">
            <!-- Titre -->
            <h4 class="blog-pinned__card-title">{{ article.title }}</h4>

            <!-- Date -->
            <div
              v-if="article.publishedDate"
              class="blog-pinned__card-date"
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

  <!-- Aucun article épinglé (pour debug) -->
  <div
    v-else
    class="blog-pinned blog-pinned--empty"
    style="padding: 2rem; text-align: center;"
  >
    <p style="color: #666;">Aucun article épinglé disponible pour le moment.</p>
  </div>
</template>

<style lang="scss" src="./BlogPinnedSection.scss"></style>
