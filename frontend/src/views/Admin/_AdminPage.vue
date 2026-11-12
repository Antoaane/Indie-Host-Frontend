<!-- File: src/views/Admin/_AdminPage.vue -->

<!-- Administration d'IndieHost, réservée aux comptes administrateurs (dev@indiehost.fr) :
     Aperçu (abonnés, chiffres, points d'attention), Utilisateurs (comptes, droits, abonnements),
     Paiements (réussis et refusés) et Services (santé en direct, carte du code floorplan).
     L'onglet ouvert est gardé dans l'adresse (`?onglet=…` : `?vue=` est pris par Vite en développement). -->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { LogOut } from 'lucide-vue-next'

import type { AdminOverview, AdminPayments, AdminTab } from '@/domain/api/admin'
import { useAdminDataSource } from '@/views/Admin/adminDataSource'
import { useSystemHealth } from '@/views/Admin/composables/useSystemHealth'
import AdminOverviewSection from '@/views/Admin/sections/AdminOverview.vue'
import AdminPaymentsSection from '@/views/Admin/sections/AdminPayments.vue'
import AdminServicesSection from '@/views/Admin/sections/AdminServices.vue'
import AdminUsersSection from '@/views/Admin/sections/AdminUsers.vue'

const props = defineProps<{
  access: 'checking' | 'allowed' | 'denied'
  accountEmail: string | null
  currentClerkUserId: string | null
  isSwitchingAccount?: boolean
}>()

const emit = defineEmits<{
  (e: 'switch-account'): void
}>()

const route = useRoute()
const router = useRouter()
const source = useAdminDataSource()

const TABS: Array<{ id: AdminTab; slug: string; label: string }> = [
  { id: 'overview', slug: 'apercu', label: 'Aperçu' },
  { id: 'users', slug: 'utilisateurs', label: 'Utilisateurs' },
  { id: 'payments', slug: 'paiements', label: 'Paiements' },
  { id: 'services', slug: 'services', label: 'Services' },
]

const activeTab = computed<AdminTab>(() => {
  const raw = typeof route.query.onglet === 'string' ? route.query.onglet : null
  const match = TABS.find((tab) => tab.slug === raw)
  if (match) return match.id
  // Ancien lien vers la fiche d'un client.
  if (route.query.userId) return 'users'
  return 'overview'
})

const isAllowed = computed(() => props.access === 'allowed')

function goTo(tab: AdminTab, userId?: string | null) {
  const slug = TABS.find((entry) => entry.id === tab)?.slug ?? 'apercu'
  const query: LocationQueryRaw = { ...route.query, onglet: slug }
  if (tab === 'users' && userId) query.userId = userId
  else if (tab !== 'users') delete query.userId
  void router.replace({ query })
}

function handleTabKeydown(event: KeyboardEvent, index: number) {
  const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!delta) return
  event.preventDefault()
  const next = TABS[(index + delta + TABS.length) % TABS.length]
  if (!next) return
  goTo(next.id)
  void nextTick(() => document.getElementById(`admin-tab-${next.id}`)?.focus())
}

// --- Aperçu ------------------------------------------------------------------------------
const overview = ref<AdminOverview | null>(null)
const overviewError = ref<string | null>(null)
const isLoadingOverview = ref(false)
let overviewLoadedAt = 0

async function loadOverview(options?: { refresh?: boolean }) {
  if (isLoadingOverview.value) return
  isLoadingOverview.value = true
  overviewError.value = null
  try {
    overview.value = await source.loadOverview(options)
    overviewLoadedAt = Date.now()
  } catch (error) {
    overviewError.value = error instanceof Error ? error.message : 'Impossible de charger les chiffres.'
  } finally {
    isLoadingOverview.value = false
  }
}

// --- Paiements ---------------------------------------------------------------------------
const payments = ref<AdminPayments | null>(null)
const paymentsError = ref<string | null>(null)
const isLoadingPayments = ref(false)
let paymentsLoadedAt = 0

async function loadPayments(options?: { refresh?: boolean }) {
  if (isLoadingPayments.value) return
  isLoadingPayments.value = true
  paymentsError.value = null
  try {
    payments.value = await source.loadPayments(options)
    paymentsLoadedAt = Date.now()
  } catch (error) {
    paymentsError.value = error instanceof Error ? error.message : 'Impossible de charger les paiements.'
  } finally {
    isLoadingPayments.value = false
  }
}

// --- Santé des services (relue en continu sur l'aperçu et l'onglet Services) -------------
const isHealthActive = computed(() => isAllowed.value && (activeTab.value === 'overview' || activeTab.value === 'services'))
const healthState = useSystemHealth(source, isHealthActive)

// Chiffres et paiements : chargés à la première ouverture de l'onglet, relus après une minute.
const STALE_MS = 60_000
watch([activeTab, isAllowed], ([tab, allowed]) => {
  if (!allowed) return
  const now = Date.now()
  if (tab === 'overview' && now - overviewLoadedAt > STALE_MS) void loadOverview()
  if (tab === 'payments' && now - paymentsLoadedAt > STALE_MS) void loadPayments()
}, { immediate: true })
</script>

<template>
  <section
    id="admin-page"
    class="admin-page"
  >
    <header class="head">
      <div class="title">
        <h1>Administration</h1>
        <p>Abonnés, comptes, paiements et santé des services d’IndieHost.</p>
      </div>
      <div
        v-if="accountEmail"
        class="account"
      >
        <p>
          <span class="label">Connecté avec</span>
          <span class="email">{{ accountEmail }}</span>
        </p>
        <div class="switch">
          <button
            type="button"
            :disabled="isSwitchingAccount"
            @click="emit('switch-account')"
          >
            <LogOut
              :size="16"
              aria-hidden="true"
            />
            {{ isSwitchingAccount ? 'Déconnexion…' : 'Changer de compte' }}
          </button>
        </div>
      </div>
    </header>

    <p
      v-if="access === 'checking'"
      class="gate"
      role="status"
    >
      Vérification de vos droits…
    </p>

    <div
      v-else-if="access === 'denied'"
      class="gate is-denied"
      role="alert"
    >
      <h2>Cette page est réservée à l’administration d’IndieHost</h2>
      <p>
        <template v-if="accountEmail">Le compte {{ accountEmail }} n’a pas les droits d’administration.</template>
        Connectez-vous avec le compte administrateur pour continuer.
      </p>
      <div class="switch">
        <button
          type="button"
          :disabled="isSwitchingAccount"
          @click="emit('switch-account')"
        >
          <LogOut
            :size="16"
            aria-hidden="true"
          />
          Se connecter avec un autre compte
        </button>
      </div>
    </div>

    <template v-else>
      <nav
        class="tabs"
        aria-label="Sections de l’administration"
      >
        <div
          class="track"
          role="tablist"
        >
          <div
            v-for="(tab, index) in TABS"
            :key="tab.id"
            :class="{ 'is-active': tab.id === activeTab }"
          >
            <button
              :id="`admin-tab-${tab.id}`"
              type="button"
              role="tab"
              :aria-selected="tab.id === activeTab"
              :aria-controls="`admin-panel-${tab.id}`"
              :tabindex="tab.id === activeTab ? 0 : -1"
              @click="goTo(tab.id)"
              @keydown="handleTabKeydown($event, index)"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>
      </nav>

      <div
        :id="`admin-panel-${activeTab}`"
        class="panel"
        role="tabpanel"
        :aria-labelledby="`admin-tab-${activeTab}`"
      >
        <KeepAlive>
          <AdminOverviewSection
            v-if="activeTab === 'overview'"
            :overview="overview"
            :health="healthState.health.value"
            :is-loading="isLoadingOverview"
            :error="overviewError"
            @navigate="goTo"
            @refresh="loadOverview({ refresh: true })"
          />
          <AdminUsersSection
            v-else-if="activeTab === 'users'"
            :current-clerk-user-id="currentClerkUserId"
          />
          <AdminPaymentsSection
            v-else-if="activeTab === 'payments'"
            :payments="payments"
            :is-loading="isLoadingPayments"
            :error="paymentsError"
            @refresh="loadPayments({ refresh: true })"
            @open-user="(userId) => goTo('users', userId)"
          />
          <AdminServicesSection
            v-else
            :health="healthState.health.value"
            :is-loading="healthState.isLoading.value"
            :is-refreshing="healthState.isRefreshing.value"
            :error="healthState.error.value"
            :refresh-notice="healthState.refreshNotice.value"
            @refresh="healthState.refreshNow()"
            @retry="healthState.load()"
          />
        </KeepAlive>
      </div>
    </template>
  </section>
</template>

<style lang="scss">
@use '@/views/Admin/admin-page.scss';
</style>
