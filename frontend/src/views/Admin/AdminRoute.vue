<!-- File: src/views/Admin/AdminRoute.vue -->

<template>
  <main class="admin-route">
    <AdminPanel />
  </main>
</template>

<script setup lang="ts">
import AdminPanel from '@/views/Admin/_Admin.vue'
</script>

<style lang="scss">
.admin-route {
  min-height: calc(100vh - 5rem);
  padding-inline: var(--layout-gap);
}
</style>
