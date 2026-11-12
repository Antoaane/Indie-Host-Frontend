<!-- File: src/views/SignUpView.vue -->

<script setup lang="ts">
import { SignUp, useAuth } from '@clerk/vue'
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { resolvePostAuthRedirect } from '@/utils/authEntry'

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

// Inscription depuis la landing (ou une page légale) : le tableau de bord, pas un retour à la
// page marketing. Chemin interne uniquement (pas de redirection ouverte).
const redirectUrl = computed(() => resolvePostAuthRedirect(readQueryValue(route.query.redirect_url)))

// Déjà connecté : Clerk n'affiche rien ici, la page restait vide. On renvoie vers la destination.
watchEffect(() => {
  if (!isLoaded.value || !isSignedIn.value) return
  void router.replace(redirectUrl.value)
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
