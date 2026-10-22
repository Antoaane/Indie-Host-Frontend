<!-- File: src/views/SignUpView.vue -->

<script setup lang="ts">
import { SignUp, useAuth } from '@clerk/vue'
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const { isLoaded, isSignedIn } = useAuth()

function readQueryValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === 'string' && first.trim()) return first.trim()
  }
  return null
}

const redirectUrl = computed(() => {
  return readQueryValue(route.query.redirect_url) ?? '/dashboard/editor'
})

// Déjà connecté : Clerk n'affiche rien ici, la page restait vide. On renvoie vers
// la destination, uniquement si c'est un chemin interne (pas de redirection ouverte).
watchEffect(() => {
  if (!isLoaded.value || !isSignedIn.value) return
  const target = redirectUrl.value
  void router.replace(target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard/editor')
})

const signInUrl = computed(() => {
  const redirect = encodeURIComponent(redirectUrl.value)
  return `/sign-in?redirect_url=${redirect}`
})
</script>

<template>
  <div class="auth-view sign-up-view">
    <SignUp
      path="/sign-up"
      routing="path"
      :force-redirect-url="redirectUrl"
      :sign-in-url="signInUrl"
    />
  </div>
</template>
