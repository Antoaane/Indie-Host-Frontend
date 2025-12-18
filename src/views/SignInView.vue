<!-- File: src/views/SignInView.vue -->

<!-- src/views/SignInView.vue -->
<script setup lang="ts">
import { SignIn } from '@clerk/vue'
</script>

<template>
  <div class="sign-in-view">
    <SignIn path="/sign-in" routing="path" />
  </div>
</template>

<style lang="scss">
/* File: src/views/sign-in-view.scss */

.sign-in-view {
  min-height: calc(100vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
