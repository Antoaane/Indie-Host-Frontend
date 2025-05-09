<!-- File: src/App.vue -->

<script setup lang="ts">
import { RouterView } from 'vue-router';
import Header from '@/components/layouts/Header.vue';

</script>

<template>
  <Header />

  <RouterView /> <!-- main -->
</template>
