<!-- File: src/views/Blog/components/PostImage/PostImage.vue -->

<script setup lang="ts">
import type { PayloadMedia } from '@/types/payload'

interface Props {
  image?: PayloadMedia | string
  title?: string
}

const props = defineProps<Props>()

/**
 * Récupère l'URL de l'image
 */
function getImageUrl(): string | null {
  if (!props.image) return null
  if (typeof props.image === 'string') return null

  const media = props.image as PayloadMedia
  let imageUrl = media.url

  // Gérer les URLs relatives vs absolues
  if (!imageUrl.startsWith('http')) {
    imageUrl = import.meta.env.DEV
      ? imageUrl
      : `${import.meta.env.VITE_PAYLOAD_API_URL}${imageUrl}`
  }

  return imageUrl
}

/**
 * Récupère le texte alternatif de l'image
 */
function getImageAlt(): string {
  if (!props.image || typeof props.image === 'string') {
    return props.title || 'Image de l\'article'
  }

  const media = props.image as PayloadMedia
  return media.alt || props.title || 'Image de l\'article'
}

/**
 * Récupère les dimensions de l'image
 */
function getImageDimensions(): { width?: number; height?: number } {
  if (!props.image || typeof props.image === 'string') {
    return {}
  }

  const media = props.image as PayloadMedia
  return {
    width: media.width,
    height: media.height,
  }
}
</script>

<template>
  <div
    v-if="getImageUrl()"
    class="post-image"
  >
    <img
      :src="getImageUrl()!"
      :alt="getImageAlt()"
      :width="getImageDimensions().width"
      :height="getImageDimensions().height"
      class="post-image__img"
    />
  </div>
</template>

<style lang="scss" src="./PostImage.scss"></style>
