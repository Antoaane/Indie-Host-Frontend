<!-- File: src/App.vue -->

<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import BootLoader from '@/components/layouts/BootLoader.vue'
import Header from '@/components/layouts/Header.vue'
import Footer from '@/components/layouts/Footer.vue'
import { installColorScheme } from '@/composables/useColorScheme'

// Thème clair ou sombre du tableau de bord : suit le système, ou le choix fait dans « Mon profil ».
installColorScheme(useRoute())
</script>

<template>
  <BootLoader />

  <Header />

  <main>
    <UApp>
      <RouterView />
    </UApp>
  </main>

  <Footer />
</template>
