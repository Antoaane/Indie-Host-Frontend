<!-- File: src/views/Landing/CustomizationSection/CustomizationSection.vue -->

<script setup lang="ts">
// ASSETS
import CustomDomain from '@/components/svgs/images/CustomDomain.vue'
// CONTENT
import type { ItemSection } from '@/content/types'
import rawContent from '@/content/fr/Landing/customization-section.json'

const section = rawContent as ItemSection
</script>

<template>
  <section :id="section.id">
    <div class="container">
      <div class="content">
        <div>
          <h2 v-html="section.items['title-1'].content" />
          <CustomDomain
            class="custom-domain"
            title="Domaine personnalisé"
            desc="Personnalisez votre domaine avec votre nom de marque"
          />
          <p v-html="section.items['text-1'].content" />
        </div>
      </div>
      <div class="illustration">
        <img
          class="customization-image"
          src="/assets/media/images/customization-image.png"
          alt="Customization"
        />
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/CustomizationSection/customization-section.scss';
</style>
