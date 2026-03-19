<!-- File: src/views/SignInView.vue -->

<!-- src/views/SignInView.vue -->
<script setup lang="ts">
import { SignIn } from '@clerk/vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

function readQueryValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === 'string' && first.trim()) return first.trim()
  }
  return null
}

const redirectUrl = computed(() => {
  return readQueryValue(route.query.redirect_url) ?? '/pricing/callback'
})

const signUpUrl = computed(() => {
  const redirect = encodeURIComponent(redirectUrl.value)
  return `/sign-up?redirect_url=${redirect}`
})
</script>

<template>
  <div class="sign-in-view">
    <SignIn
      path="/sign-in"
      routing="path"
      :force-redirect-url="redirectUrl"
      :sign-up-url="signUpUrl"
    />
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
