<!-- File: src/views/SignUpView.vue -->

<script setup lang="ts">
import { SignUp } from '@clerk/vue'
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

const signInUrl = computed(() => {
  const redirect = encodeURIComponent(redirectUrl.value)
  return `/sign-in?redirect_url=${redirect}`
})
</script>

<template>
  <div class="sign-up-view">
    <SignUp
      path="/sign-up"
      routing="path"
      :force-redirect-url="redirectUrl"
      :sign-in-url="signInUrl"
    />
  </div>
</template>

<style lang="scss">
.sign-up-view {
  min-height: calc(100vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
