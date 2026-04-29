import { computed, ref, watch } from 'vue'
import { useUser } from '@clerk/vue'

import { fetchMyUser } from '@/domain/api/users'
import { hasClerkAdminRole } from '@/utils/clerkRole'

function waitMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function useAdminAccess() {
  const { user } = useUser()
  const apiAdminAccess = ref<boolean | null>(null)

  const isAdminUser = computed(() => Boolean(apiAdminAccess.value) || hasClerkAdminRole(user.value))

  async function loadAdminAccessFromApi() {
    if (!user.value?.id) {
      apiAdminAccess.value = null
      return
    }

    const maxAttempts = 3
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const me = await fetchMyUser()
        apiAdminAccess.value = Boolean(me.isAdmin)
        return
      } catch (error) {
        if (attempt >= maxAttempts - 1) {
          console.warn('[useAdminAccess] failed to resolve admin access from API, fallback to Clerk metadata', error)
          apiAdminAccess.value = null
          return
        }
        await waitMs(250)
      }
    }
  }

  watch(
    () => user.value?.id ?? null,
    () => {
      void loadAdminAccessFromApi()
    },
    { immediate: true },
  )

  return {
    apiAdminAccess,
    isAdminUser,
  }
}
