<!-- File: src/App.vue -->

<script setup lang="ts">
import { RouterView } from 'vue-router'
import Header from '@/components/layouts/Header.vue'
import Footer from '@/components/layouts/Footer.vue'
</script>

<template>
  <Header />

  <!-- main -->
  <UApp>
    <RouterView />
  </UApp>

  <Footer />
</template>
