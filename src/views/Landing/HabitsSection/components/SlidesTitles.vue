<!-- File: src/views/Landing/HabitsSection/components/SlidesTitles.vue -->

<script setup lang="ts">
import { ref, watch, computed } from 'vue'

// Communiquer l’index actif via provide/inject ou props/events, selon besoin
const activeIndex = ref(0)

// Titres à afficher
const slideTitles = [
  `Visualisez et téléchargez vos factures et vos performances <strong>en temps réel</strong>`,
  `Gérez vos réservations dans un <strong>espace intuitif</strong>`,
  `Vos voyageurs réservent <strong>simplement</strong> et en <strong>toute sécurité</strong>`,
  `Centralisez vos messages <strong>sans effort</strong>`,
]
</script>

<template>
  <div class="content">
    <h2> Gardez les mêmes <span class="gradient-text">habitudes</span> </h2>

    <div class="slides-titles">
      <h3
        v-for="(txt, idx) in slideTitles"
        :key="idx"
        v-html="txt"
        :class="['title', { active: idx === activeIndex }]"
        aria-live="polite"
      />
    </div>
  </div>
</template>
