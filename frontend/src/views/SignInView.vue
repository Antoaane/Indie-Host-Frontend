<!-- File: src/views/SignInView.vue -->

<!-- src/views/SignInView.vue -->
<script setup lang="ts">
import { SignIn, useAuth } from '@clerk/vue'
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

// Connexion depuis la landing (ou une page légale) : le tableau de bord, pas un retour à la
// page marketing. Chemin interne uniquement (pas de redirection ouverte).
const redirectUrl = computed(() => resolvePostAuthRedirect(readQueryValue(route.query.redirect_url)))

// Déjà connecté : Clerk n'affiche rien ici, la page restait vide. On renvoie vers la destination.
watchEffect(() => {
  if (!isLoaded.value || !isSignedIn.value) return
  void router.replace(redirectUrl.value)
})

const signUpUrl = computed(() => {
  const redirect = encodeURIComponent(redirectUrl.value)
  return `/sign-up?redirect_url=${redirect}`
})
</script>

<template>
  <div class="auth-view sign-in-view">
    <SignIn
      path="/sign-in"
      routing="path"
      :force-redirect-url="redirectUrl"
      :sign-up-url="signUpUrl"
    />
  </div>
</template>
