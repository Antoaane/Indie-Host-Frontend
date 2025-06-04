<!-- File: src/views/Landing/FaqSection/FaqSection.vue -->

<script setup lang="ts">
import FaqPage from '@/views/Landing/FaqSection/components/FaqPage.vue'
import { faqData } from '@/views/Landing/FaqSection/utils/faqData'
</script>

<template>
  <FaqPage :data="faqData" />
</template>
