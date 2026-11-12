<!-- File: src/views/Admin/AdminRoute.vue -->

<!-- `/dashboard/admin` : connexion Clerk exigée par le routeur, puis droits d'administration vérifiés
     par l'API (`isAdmin` de `/users/me`, accordé à SUPER_ADMIN_EMAILS — dev@indiehost.fr — ou au
     rôle admin de Clerk). L'API refuse de son côté toute route `/admin/*` sans ces droits. -->

<script setup lang="ts">
import { computed, onBeforeUnmount, provide, ref, watch } from 'vue'
import { useAuth, useUser } from '@clerk/vue'

import { useAdminAccess } from '@/composables/useAdminAccess'
import AdminPage from '@/views/Admin/_AdminPage.vue'
import { ADMIN_DATA_SOURCE, apiAdminDataSource } from '@/views/Admin/adminDataSource'

provide(ADMIN_DATA_SOURCE, apiAdminDataSource)

const ACCESS_CHECK_TIMEOUT_MS = 8000
const ADMIN_PATH = '/dashboard/admin'

const { user } = useUser()
const { signOut } = useAuth()
const { isAdminUser, apiAdminAccess } = useAdminAccess()

// L'API n'a pas répondu à temps : on le dit plutôt que d'attendre sans fin.
const accessTimedOut = ref(false)
const accessTimer = setTimeout(() => {
  accessTimedOut.value = true
}, ACCESS_CHECK_TIMEOUT_MS)
onBeforeUnmount(() => clearTimeout(accessTimer))
watch(isAdminUser, (allowed) => {
  if (allowed) clearTimeout(accessTimer)
})

const access = computed<'checking' | 'allowed' | 'denied'>(() => {
  if (isAdminUser.value) return 'allowed'
  if (apiAdminAccess.value === false || accessTimedOut.value) return 'denied'
  return 'checking'
})

const accountEmail = computed(() => user.value?.primaryEmailAddress?.emailAddress ?? null)
const currentClerkUserId = computed(() => user.value?.id ?? null)

const isSwitchingAccount = ref(false)

async function switchAccount() {
  if (isSwitchingAccount.value) return
  isSwitchingAccount.value = true
  try {
    await signOut.value({ redirectUrl: `/sign-in?redirect_url=${encodeURIComponent(ADMIN_PATH)}` })
  } finally {
    isSwitchingAccount.value = false
  }
}
</script>

<template>
  <AdminPage
    :access="access"
    :account-email="accountEmail"
    :current-clerk-user-id="currentClerkUserId"
    :is-switching-account="isSwitchingAccount"
    @switch-account="switchAccount"
  />
</template>
