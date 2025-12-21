<!-- File: src/views/Blog/components/BlogFullSection/BlogFullSection.vue -->

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getPublishedArticles, PayloadApiError } from '@/services/payloadApi'
import type { PayloadArticle, PayloadMedia, PayloadCategory } from '@/types/payload'

// Catégories prédéfinies
const CATEGORIES = [
  { slug: 'product', label: 'Produit' },
  { slug: 'industry-insights', label: 'Société' },
  { slug: 'terroir', label: 'Terroir & Culture' },
  { slug: 'community', label: 'Communauté' },
  { slug: 'sustainability', label: 'Éco-Hébergement' },
  { slug: 'academy', label: 'Conseils d\'experts' },
] as const

// Interface pour les articles affichés
interface ArticleCard {
  id: string
  title: string
  slug: string
  publishedDate?: string
  categories: string[] // slugs des catégories
  image?: {
    url: string
    alt: string
    width?: number
    height?: number
  }
}

// État du composant
const articles = ref<ArticleCard[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const selectedCategories = ref<Set<string>>(new Set())

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
 * Extrait les slugs des catégories d'un article
 */
function extractCategorySlugs(categories?: (PayloadCategory | string)[]): string[] {
  if (!categories || categories.length === 0) {
    return []
  }

  return categories
    .map(cat => {
      if (typeof cat === 'string') return null
      return (cat as PayloadCategory).slug
    })
    .filter((slug): slug is string => slug !== null && slug !== undefined)
}

/**
 * Transforme un article Payload en ArticleCard
 */
function transformPayloadArticle(payloadArticle: PayloadArticle): ArticleCard {
  let imageData: ArticleCard['image'] | undefined

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
    categories: extractCategorySlugs(payloadArticle.category),
    image: imageData,
  }
}

/**
 * Toggle une catégorie dans les filtres
 */
function toggleCategory(categorySlug: string) {
  if (selectedCategories.value.has(categorySlug)) {
    selectedCategories.value.delete(categorySlug)
  } else {
    selectedCategories.value.add(categorySlug)
  }
  // Force la réactivité
  selectedCategories.value = new Set(selectedCategories.value)
}

/**
 * Vérifie si une catégorie est sélectionnée
 */
function isCategorySelected(categorySlug: string): boolean {
  return selectedCategories.value.has(categorySlug)
}

/**
 * Articles filtrés selon les catégories sélectionnées
 */
const filteredArticles = computed(() => {
  // Si aucun filtre actif, afficher tous les articles
  if (selectedCategories.value.size === 0) {
    return articles.value
  }

  // Filtrer les articles qui ont au moins une catégorie sélectionnée
  return articles.value.filter(article => {
    return article.categories.some(catSlug =>
      selectedCategories.value.has(catSlug)
    )
  })
})

/**
 * Charge tous les articles publiés
 */
async function loadAllArticles() {
  isLoading.value = true
  error.value = null

  try {
    // Récupérer tous les articles publiés (pagination à gérer si nécessaire)
    const response = await getPublishedArticles(1, 100)

    if (!response.docs || response.docs.length === 0) {
      articles.value = []
    } else {
      articles.value = response.docs.map(transformPayloadArticle)
    }
  } catch (err) {
    if (err instanceof PayloadApiError) {
      error.value = `Erreur lors du chargement des articles : ${err.message}`
    } else {
      error.value = 'Une erreur inattendue s\'est produite lors du chargement des articles.'
    }
    console.error('❌ [BlogFullSection] Erreur:', err)
    articles.value = []
  } finally {
    isLoading.value = false
  }
}

// Charger les articles au montage
onMounted(() => {
  loadAllArticles()
})
</script>

<template>
  <section class="blog-full">
    <!-- En-tête de section -->
    <div class="blog-full__header">
      <h3 class="blog-full__title">Actualités par sujet</h3>
    </div>

    <!-- Filtres par catégorie -->
    <div class="blog-full__filters">
      <button
        v-for="category in CATEGORIES"
        :key="category.slug"
        :class="['blog-full__filter-btn', { 'blog-full__filter-btn--active': isCategorySelected(category.slug) }]"
        @click="toggleCategory(category.slug)"
      >
        {{ category.label }}
      </button>
    </div>

    <!-- État de chargement -->
    <div
      v-if="isLoading"
      class="blog-full__loading"
    >
      <p>Chargement des articles...</p>
    </div>

    <!-- État d'erreur -->
    <div
      v-else-if="error"
      class="blog-full__error"
    >
      <p>{{ error }}</p>
    </div>

    <!-- Grille d'articles -->
    <div
      v-else-if="filteredArticles.length > 0"
      class="blog-full__grid"
    >
      <article
        v-for="article in filteredArticles"
        :key="article.id"
        class="blog-full__card"
      >
        <router-link
          :to="`/blog/${article.slug}`"
          class="blog-full__card-link"
        >
          <!-- Image -->
          <div
            v-if="article.image"
            class="blog-full__card-image-wrap"
          >
            <img
              :src="article.image.url"
              :alt="article.image.alt"
              :width="article.image.width"
              :height="article.image.height"
              class="blog-full__card-image"
              loading="lazy"
            />
          </div>

          <!-- Contenu -->
          <div class="blog-full__card-content">
            <h4 class="blog-full__card-title">{{ article.title }}</h4>

            <div
              v-if="article.publishedDate"
              class="blog-full__card-date"
            >
              <time :datetime="article.publishedDate">
                {{ formatDate(article.publishedDate) }}
              </time>
            </div>
          </div>
        </router-link>
      </article>
    </div>

    <!-- Aucun article -->
    <div
      v-else
      class="blog-full__empty"
    >
      <p>Aucun article trouvé pour les filtres sélectionnés.</p>
    </div>
  </section>
</template>

<style lang="scss" src="./BlogFullSection.scss"></style>
