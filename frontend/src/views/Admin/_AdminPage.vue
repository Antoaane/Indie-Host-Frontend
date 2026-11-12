<!-- File: src/views/Admin/_AdminPage.vue -->

<!-- Administration d'IndieHost, réservée aux comptes administrateurs (dev@indiehost.fr) :
     Aperçu (abonnés, chiffres, points d'attention), Comptes (droits, abonnements, invitations),
     Paiements (réussis et refusés) et Services (santé en direct, carte du code floorplan).
     L'onglet ouvert est gardé dans l'adresse (`?onglet=…` : `?vue=` est pris par Vite en développement).
     Ordinateur : toute la largeur, une colonne de navigation à gauche et la section à droite, qui
     défile seule. Téléphone : onglets en pastilles en haut, la page défile. -->

<script setup lang="ts">
import { computed, nextTick, ref, watch, type Component } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { Activity, CreditCard, LayoutDashboard, LogOut, Users } from 'lucide-vue-next'

import type { AdminOverview, AdminPayments, AdminTab } from '@/domain/api/admin'
import { vp } from '@/utils/viewport'
import { SERVICE_STATUS, formatCount } from '@/views/Admin/adminFormat'
import { useAdminDataSource } from '@/views/Admin/adminDataSource'
import { isAdminWideLayout } from '@/views/Admin/adminLayout'
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

const TABS: Array<{ id: AdminTab; slug: string; label: string; icon: Component; description: string }> = [
  { id: 'overview', slug: 'apercu', label: 'Aperçu', icon: LayoutDashboard, description: 'Abonnés, revenus et points qui demandent une action.' },
  { id: 'users', slug: 'utilisateurs', label: 'Comptes', icon: Users, description: 'Droits, abonnements et invitations des hôtes.' },
  { id: 'payments', slug: 'paiements', label: 'Paiements', icon: CreditCard, description: 'Abonnements et réservations des 90 derniers jours, réussis ou refusés.' },
  { id: 'services', slug: 'services', label: 'Services', icon: Activity, description: 'Santé de chaque service, mesurée en continu, et carte du code.' },
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

const activeMeta = computed(() => TABS.find((tab) => tab.id === activeTab.value) ?? TABS[0]!)

// Changement d'onglet : la section s'ouvre en haut, sinon elle gardait la position de défilement de
// la précédente (titre et premières cartes cachés). Ordinateur : la zone de la section défile seule.
// Téléphone : c'est la page ; un lien vers une fiche de compte la montre lui-même (AdminUsers.vue).
const panelEl = ref<HTMLElement | null>(null)
watch(activeTab, (tab) => {
  if (typeof window === 'undefined') return
  void nextTick(() => {
    if (isAdminWideLayout()) {
      panelEl.value?.scrollTo({ top: 0 })
      return
    }
    if (tab === 'users' && route.query.userId) return
    if (window.scrollY > 0) window.scrollTo({ top: 0 })
  })
})

function handleTabKeydown(event: KeyboardEvent, index: number) {
  // Colonne verticale sur ordinateur, pastilles en ligne sur téléphone : les deux sens de flèches marchent.
  const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
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

// --- Santé des services (relue en continu : son état s'affiche dans la navigation) -------
const isHealthActive = computed(() => isAllowed.value)
const healthState = useSystemHealth(source, isHealthActive)

// Indicateurs de la navigation : points qui demandent une action, comptes, état des services.
type TabHint = { text: string; tone: 'good' | 'warn' | 'bad' | 'muted'; label: string; dot?: boolean }
const tabHints = computed<Partial<Record<AdminTab, TabHint>>>(() => {
  const hints: Partial<Record<AdminTab, TabHint>> = {}
  const attention = overview.value?.attention.length ?? 0
  if (attention) {
    hints.overview = { text: formatCount(attention), tone: 'warn', label: `${attention} point${attention > 1 ? 's' : ''} à traiter` }
  }
  const accounts = overview.value?.accounts.total
  if (typeof accounts === 'number') {
    hints.users = { text: formatCount(accounts), tone: 'muted', label: `${accounts} compte${accounts > 1 ? 's' : ''}` }
  }
  const health = healthState.health.value
  if (health && health.services.some((service) => service.status !== 'unknown')) {
    const status = health.overall.status
    const tone = status === 'down' ? 'bad' : status === 'degraded' ? 'warn' : 'good'
    const label = health.overall.down
      ? `${health.overall.down} en panne`
      : health.overall.degraded
        ? `${health.overall.degraded} à surveiller`
        : SERVICE_STATUS.up.label
    hints.services = { text: '', tone, label: `Services : ${label.toLowerCase()}`, dot: true }
  }
  return hints
})

// Chiffres : chargés dès l'ouverture de la page (ils nourrissent aussi la navigation), relus après
// une minute sur l'aperçu. Paiements : à la première ouverture de leur onglet.
const STALE_MS = 60_000
watch([activeTab, isAllowed], ([tab, allowed]) => {
  if (!allowed) return
  const now = Date.now()
  if ((tab === 'overview' || !overviewLoadedAt) && now - overviewLoadedAt > STALE_MS) void loadOverview()
  if (tab === 'payments' && now - paymentsLoadedAt > STALE_MS) void loadPayments()
}, { immediate: true })
</script>

<template>
  <section
    id="admin-page"
    class="admin-page"
  >
    <aside
      class="rail"
      aria-label="Administration"
    >
      <div class="brand">
        <h1>Administration</h1>
        <p>IndieHost</p>
      </div>

      <nav
        v-if="access === 'allowed'"
        class="sections"
        aria-label="Sections de l’administration"
      >
        <div
          class="track"
          role="tablist"
          :aria-orientation="vp.lg.value ? 'vertical' : 'horizontal'"
        >
          <div
            v-for="(tab, index) in TABS"
            :key="tab.id"
            class="tab"
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
              <component
                :is="tab.icon"
                class="icon"
                :size="18"
                aria-hidden="true"
              />
              <span class="label">{{ tab.label }}</span>
              <span
                v-if="tabHints[tab.id]"
                class="hint"
                :class="[`is-${tabHints[tab.id]?.tone}`, { 'is-dot': tabHints[tab.id]?.dot }]"
                :title="tabHints[tab.id]?.label"
              >
                <span aria-hidden="true">{{ tabHints[tab.id]?.text }}</span>
                <span class="sr-only">{{ tabHints[tab.id]?.label }}</span>
              </span>
            </button>
          </div>
        </div>
      </nav>

      <div
        v-if="accountEmail"
        class="account"
      >
        <p>
          <span class="label">Connecté avec</span>
          <span
            class="email"
            :title="accountEmail"
          >{{ accountEmail }}</span>
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
    </aside>

    <div class="main">
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
        <header class="section-head">
          <h2>{{ activeMeta.label }}</h2>
          <p>{{ activeMeta.description }}</p>
        </header>

        <div
          :id="`admin-panel-${activeTab}`"
          ref="panelEl"
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
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Admin/admin-page.scss';
</style>
