<!-- File: src/views/Admin/sections/AdminOverview.vue -->

<!-- Vue d'ensemble : le nombre d'abonnés d'abord, puis les chiffres clés, ce qui demande une action
     et l'état des services en une ligne. Chaque point d'attention mène à l'écran qui le traite. -->

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, CircleCheck, RefreshCw, TriangleAlert } from 'lucide-vue-next'

import type { AdminAttentionItem, AdminOverview, AdminTab, SystemHealth } from '@/domain/api/admin'
import { SERVICE_STATUS, formatCount, formatMoney, pluralize } from '@/views/Admin/adminFormat'

const props = defineProps<{
  overview: AdminOverview | null
  health: SystemHealth | null
  isLoading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  (e: 'navigate', tab: Exclude<AdminTab, 'overview'>, userId?: string | null): void
  (e: 'refresh'): void
}>()

const subscribers = computed(() => props.overview?.subscribers ?? null)

const activeSubscribers = computed(() => {
  const value = subscribers.value
  if (!value) return 0
  return value.paying + value.trialing + value.complimentary + value.pastDue
})

const split = computed(() => {
  const value = subscribers.value
  if (!value) return []
  return [
    { label: 'Payants', value: value.paying, tone: '' },
    { label: 'En essai gratuit', value: value.trialing, tone: '' },
    { label: 'Offerts', value: value.complimentary, tone: '' },
    { label: 'Paiement en retard', value: value.pastDue, tone: value.pastDue ? 'is-bad' : '' },
  ]
})

const tiles = computed(() => {
  const overview = props.overview
  if (!overview) return []
  const { accounts, listings, reservations } = overview
  return [
    {
      label: 'Comptes',
      value: formatCount(accounts.total),
      hint: accounts.newLast30Days ? `+ ${formatCount(accounts.newLast30Days)} sur 30 jours` : 'aucun nouveau sur 30 jours',
    },
    {
      label: 'Hôtes en ligne',
      value: formatCount(accounts.withPublishedListing),
      hint: 'avec au moins un logement en ligne',
    },
    {
      label: 'Logements en ligne',
      value: formatCount(listings.published),
      hint: [
        listings.drafts ? pluralize(listings.drafts, 'brouillon', 'brouillons') : null,
        listings.paused ? `${formatCount(listings.paused)} en pause` : null,
        listings.customDomains ? pluralize(listings.customDomains, 'domaine relié', 'domaines reliés') : null,
      ].filter(Boolean).join(' · ') || 'aucun brouillon',
    },
    {
      label: 'Réservations sur 30 jours',
      value: formatCount(reservations.last30Days),
      hint: `${formatMoney(reservations.collectedLast30DaysMinor, reservations.currency)} encaissés par les hôtes · ${formatCount(reservations.upcoming)} à venir`,
    },
  ]
})

const healthChips = computed(() => (props.health?.services ?? []).map((service) => ({
  id: service.id,
  label: service.label,
  status: SERVICE_STATUS[service.status],
})))

const healthSentence = computed(() => {
  const overall = props.health?.overall
  if (!overall) return 'Lecture de l’état des services…'
  if (overall.down) return pluralize(overall.down, 'service en panne', 'services en panne')
  if (overall.degraded) return `Tout tourne, ${pluralize(overall.degraded, 'point à surveiller', 'points à surveiller')}`
  return 'Tous les services fonctionnent'
})

const healthTone = computed(() => {
  const overall = props.health?.overall
  if (!overall) return 'is-muted'
  if (overall.down) return 'is-bad'
  if (overall.degraded) return 'is-warn'
  return 'is-good'
})

const ATTENTION_ACTION: Record<AdminAttentionItem['target']['tab'], string> = {
  users: 'Voir le compte',
  payments: 'Voir les paiements',
  services: 'Voir le service',
}
</script>

<template>
  <section
    class="admin-overview"
    aria-label="Vue d’ensemble"
  >
    <p
      v-if="isLoading && !overview"
      class="state"
      role="status"
    >
      Calcul des chiffres…
    </p>

    <div
      v-else-if="error && !overview"
      class="state is-error"
      role="alert"
    >
      <p>{{ error }}</p>
      <div class="retry">
        <button
          type="button"
          @click="emit('refresh')"
        >
          <RefreshCw
            :size="16"
            aria-hidden="true"
          />
          Réessayer
        </button>
      </div>
    </div>

    <template v-else-if="overview && subscribers">
      <div class="lead">
        <article class="subscribers">
          <h2>Abonnés</h2>
          <p class="figure">{{ formatCount(activeSubscribers) }}</p>
          <ul class="split">
            <li
              v-for="part in split"
              :key="part.label"
              :class="part.tone"
            >
              <span class="part-value">{{ formatCount(part.value) }}</span>
              <span class="part-label">{{ part.label }}</span>
            </li>
          </ul>
          <p
            v-if="subscribers.source === 'database'"
            class="notice"
          >
            Stripe ne répond pas : chiffres tirés de la base, parfois en retard sur Stripe.
          </p>
        </article>

        <article class="revenue">
          <h2>Revenu mensuel</h2>
          <p class="value">
            {{ subscribers.monthlyRevenueMinor !== null ? formatMoney(subscribers.monthlyRevenueMinor, subscribers.currency) : 'Indisponible' }}
          </p>
          <p class="hint">Abonnements payants en cours, TTC, hors remises.</p>
          <dl class="plans">
            <div>
              <dt>IndieHost</dt>
              <dd>{{ formatCount(subscribers.byPlan.indiehost) }}</dd>
            </div>
            <div>
              <dt>SuperHost</dt>
              <dd>{{ formatCount(subscribers.byPlan.superhost) }}</dd>
            </div>
            <div>
              <dt>Logements supplémentaires</dt>
              <dd>{{ formatCount(subscribers.extraListings) }}</dd>
            </div>
            <div>
              <dt>Résiliés sur 30 jours</dt>
              <dd>{{ formatCount(subscribers.canceledLast30Days) }}</dd>
            </div>
          </dl>
        </article>
      </div>

      <dl class="tiles">
        <div
          v-for="tile in tiles"
          :key="tile.label"
        >
          <dt>{{ tile.label }}</dt>
          <dd class="value">{{ tile.value }}</dd>
          <dd class="hint">{{ tile.hint }}</dd>
        </div>
      </dl>

      <section
        class="attention"
        aria-labelledby="admin-attention-title"
      >
        <h2 id="admin-attention-title">À surveiller</h2>
        <ul
          v-if="overview.attention.length"
          class="rows"
        >
          <li
            v-for="item in overview.attention"
            :key="item.id"
            :class="`is-${item.tone}`"
          >
            <TriangleAlert
              class="icon"
              :size="18"
              aria-hidden="true"
            />
            <div class="text">
              <p class="title">{{ item.title }}</p>
              <p class="detail">{{ item.detail }}</p>
            </div>
            <div class="go">
              <button
                type="button"
                @click="emit('navigate', item.target.tab, item.target.userId ?? null)"
              >
                {{ ATTENTION_ACTION[item.target.tab] }}
                <ArrowRight
                  :size="16"
                  aria-hidden="true"
                />
              </button>
            </div>
          </li>
        </ul>
        <p
          v-else
          class="calm"
        >
          <CircleCheck
            :size="18"
            aria-hidden="true"
          />
          Rien à signaler : aucun impayé, aucun litige, aucun service en panne.
        </p>
      </section>

      <section
        class="health"
        aria-labelledby="admin-health-title"
      >
        <div class="health-head">
          <h2 id="admin-health-title">Services</h2>
          <p :class="healthTone">
            <span
              class="dot"
              aria-hidden="true"
            />
            {{ healthSentence }}
          </p>
          <div class="go">
            <button
              type="button"
              @click="emit('navigate', 'services')"
            >
              Voir le schéma
              <ArrowRight
                :size="16"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
        <ul
          v-if="healthChips.length"
          class="chips"
        >
          <li
            v-for="chip in healthChips"
            :key="chip.id"
            :class="`is-${chip.status.tone}`"
            :title="chip.status.label"
          >
            <span
              class="dot"
              aria-hidden="true"
            />
            {{ chip.label }}
            <span class="sr-only">: {{ chip.status.label }}</span>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>

<style lang="scss">
@use '@/views/Admin/sections/admin-overview.scss';
</style>
