<!-- File: src/App.vue -->

<script setup lang="ts">
import { RouterView } from 'vue-router'
import BootLoader from '@/components/layouts/BootLoader.vue'
import Header from '@/components/layouts/Header.vue'
import Footer from '@/components/layouts/Footer.vue'
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
