<!-- File: src/views/Blog/components/BlogHeroSection/BlogHeroSection.vue -->

File: src/views/Blog/components/BlogHeroSection/BlogHeroSection.vue

<script setup lang="ts">
import { ref, computed } from 'vue'

// Interface pour l'article mis en avant
interface FeaturedArticle {
  id: string
  title: string
  slug: string
  excerpt?: string
  publishedAt: string
  image: {
    url: string
    alt: string
    width?: number
    height?: number
  }
  category?: string
  tags?: string[]
}

// Props
interface Props {
  article?: FeaturedArticle
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

// Données de démonstration (à remplacer par les vraies données de l'API)
const defaultArticle: FeaturedArticle = {
  id: '1',
  title: 'Bienvenue sur le blog IndieHost',
  slug: 'bienvenue-indiehost',
  excerpt: 'Découvrez notre plateforme de gestion de locations saisonnières',
  publishedAt: new Date().toISOString(),
  image: {
    url: 'https://placehold.co/1100x725/667eea/ffffff?text=IndieHost+Blog',
    alt: 'Image par défaut du blog IndieHost',
    width: 1100,
    height: 725,
  },
  category: 'Actualités',
  tags: [
    'IndieHost',
    'Blog',
  ],
}

// Utiliser l'article fourni ou l'article par défaut
const currentArticle = computed(() => props.article || defaultArticle)

// Formater la date
const formattedDate = computed(() => {
  const date = new Date(currentArticle.value.publishedAt)
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
</script>

<template>
  <div class="blog-hero">
    <article
      class="blog-hero__article"
      :data-post-id="currentArticle.id"
    >
      <div class="blog-hero__inner">
        <div class="blog-hero__content">
          <!-- Image -->
          <div class="blog-hero__image-wrap">
            <div class="blog-hero__image-container">
              <a
                :href="`/blog/${currentArticle.slug}`"
                class="blog-hero__image-link"
                tabindex="-1"
              >
                <img
                  :src="currentArticle.image.url"
                  :alt="currentArticle.image.alt"
                  :width="currentArticle.image.width"
                  :height="currentArticle.image.height"
                  class="blog-hero__image"
                  loading="eager"
                />
              </a>
            </div>
          </div>

          <!-- Texte -->
          <div class="blog-hero__text-wrap">
            <!-- Titre -->
            <h2 class="blog-hero__title">
              <a
                :href="`/blog/${currentArticle.slug}`"
                class="blog-hero__title-link"
              >
                {{ currentArticle.title }}
              </a>
            </h2>
            <div
              v-if="currentArticle.excerpt"
              class="blog-hero__excerpt"
            >
              <p>{{ currentArticle.excerpt }}</p>
            </div>

            <!-- Bouton CTA -->
            <a
              :href="`/blog/${currentArticle.slug}`"
              class="blog-hero__cta btn btn--gradient"
              @mousemove="handleMouseMove"
            >
              <span class="btn__text">En savoir plus</span>
            </a>
          </div>
        </div>
      </div>
    </article>
  </div>
</template>

<style lang="scss" src="./BlogHeroSection.scss"></style>
