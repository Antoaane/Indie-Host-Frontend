<!-- File: src/views/SignInView.vue -->

<!-- src/views/SignInView.vue -->
<script setup lang="ts">
import { SignIn } from '@clerk/vue'
</script>

<template>
  <div class="sign-in-page">
    <SignIn path="/sign-in" routing="path" />
  </div>
</template>

<style scoped>
.sign-in-page {
  min-height: calc(100vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

