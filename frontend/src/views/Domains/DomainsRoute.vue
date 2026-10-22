<!-- File: src/views/Domains/DomainsRoute.vue -->

<template>
  <main class="domains-route">
    <DomainPanel />
  </main>
</template>

<script setup lang="ts">
import DomainPanel from '@/views/Domains/DomainPanel.vue'
</script>

<style lang="scss">
.domains-route {
  min-height: calc(100dvh - 5rem);
  padding-inline: 1rem;
}
</style>
