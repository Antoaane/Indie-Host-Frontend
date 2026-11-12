<!-- File: src/views/Admin/sections/AdminPayments.vue -->

<!-- Paiements des 90 derniers jours, réussis comme refusés : abonnements des hôtes à IndieHost
     (compte Stripe d'IndieHost) et réservations des voyageurs (compte Stripe de chaque hôte).
     Un refus porte son motif ; un paiement d'abonnement s'ouvre dans le tableau de bord Stripe. -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUpRight, RefreshCw } from 'lucide-vue-next'

import type { AdminPaymentRow, AdminPayments } from '@/domain/api/admin'
import { PAYMENT_STATUS, formatCount, formatDateTime, formatMoney, pluralize } from '@/views/Admin/adminFormat'

const props = defineProps<{
  payments: AdminPayments | null
  isLoading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'open-user', userId: string): void
}>()

type StatusFilter = 'all' | 'succeeded' | 'failed' | 'refunds'
type SourceFilter = 'all' | 'subscription' | 'reservation'

const statusFilter = ref<StatusFilter>('all')
const sourceFilter = ref<SourceFilter>('all')

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'succeeded', label: 'Réussis' },
  { id: 'failed', label: 'Refusés' },
  { id: 'refunds', label: 'Remboursés et litiges' },
]

const SOURCE_FILTERS: Array<{ id: SourceFilter; label: string }> = [
  { id: 'all', label: 'Tout' },
  { id: 'subscription', label: 'Abonnements' },
  { id: 'reservation', label: 'Réservations' },
]

function matchesStatus(row: AdminPaymentRow, filter: StatusFilter): boolean {
  switch (filter) {
    case 'succeeded':
      return row.status === 'succeeded'
    case 'failed':
      return row.status === 'failed'
    case 'refunds':
      return row.status === 'refunded' || row.status === 'partially_refunded' || row.status === 'disputed'
    default:
      return true
  }
}

function matchesSource(row: AdminPaymentRow, filter: SourceFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'subscription') return row.source === 'subscription' || row.source === 'other'
  return row.source === 'reservation'
}

const rows = computed(() => (props.payments?.rows ?? []).filter((row) => matchesStatus(row, statusFilter.value) && matchesSource(row, sourceFilter.value)))

function countFor(filter: StatusFilter): number {
  return (props.payments?.rows ?? []).filter((row) => matchesStatus(row, filter) && matchesSource(row, sourceFilter.value)).length
}

const tiles = computed(() => {
  const totals = props.payments?.totals
  if (!totals) return []
  return [
    { label: 'Encaissé sur 30 jours', value: formatMoney(totals.succeededMinor, totals.currency), hint: pluralize(totals.succeededCount, 'paiement réussi', 'paiements réussis'), tone: '' },
    { label: 'Refusés sur 30 jours', value: formatCount(totals.failedCount), hint: totals.failedCount ? 'carte refusée ou 3-D Secure non validé' : 'aucun refus', tone: totals.failedCount ? 'is-bad' : '' },
    { label: 'Remboursé sur 30 jours', value: formatMoney(totals.refundedMinor, totals.currency), hint: 'aux voyageurs ou aux hôtes', tone: '' },
    { label: 'Litiges en cours', value: formatCount(totals.disputedCount), hint: totals.disputedCount ? 'à traiter par l’hôte dans Stripe' : 'aucun litige', tone: totals.disputedCount ? 'is-bad' : '' },
  ]
})

const emptyText = computed(() => {
  if (!props.payments?.rows.length) return `Aucun paiement sur les ${props.payments?.periodDays ?? 90} derniers jours.`
  return 'Aucun paiement ne correspond à ces filtres.'
})
</script>

<template>
  <section
    class="admin-payments"
    aria-label="Paiements"
  >
    <div class="filters">
      <div
        class="chips"
        role="group"
        aria-label="État du paiement"
      >
        <div
          v-for="filter in STATUS_FILTERS"
          :key="filter.id"
          :class="{ 'is-active': statusFilter === filter.id }"
        >
          <button
            type="button"
            :aria-pressed="statusFilter === filter.id"
            @click="statusFilter = filter.id"
          >
            {{ filter.label }}
            <span
              v-if="payments"
              class="count"
            >{{ countFor(filter.id) }}</span>
          </button>
        </div>
      </div>
      <div
        class="chips"
        role="group"
        aria-label="Origine du paiement"
      >
        <div
          v-for="filter in SOURCE_FILTERS"
          :key="filter.id"
          :class="{ 'is-active': sourceFilter === filter.id }"
        >
          <button
            type="button"
            :aria-pressed="sourceFilter === filter.id"
            @click="sourceFilter = filter.id"
          >
            {{ filter.label }}
          </button>
        </div>
      </div>
      <div class="refresh">
        <button
          type="button"
          :disabled="isLoading"
          aria-label="Relire les paiements chez Stripe"
          title="Relire les paiements chez Stripe"
          @click="emit('refresh')"
        >
          <RefreshCw
            :size="16"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <p
      v-if="isLoading && !payments"
      class="state"
      role="status"
    >
      Chargement des paiements…
    </p>

    <div
      v-else-if="error && !payments"
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

    <div
      v-else-if="payments"
      class="content"
      :class="{ 'is-refreshing': isLoading }"
    >
      <p
        v-if="!payments.stripeAvailable"
        class="notice"
      >
        Stripe ne répond pas : seuls les paiements des réservations sont affichés, les abonnements reviendront au prochain chargement.
      </p>

      <dl class="tiles">
        <div
          v-for="tile in tiles"
          :key="tile.label"
          :class="tile.tone"
        >
          <dt>{{ tile.label }}</dt>
          <dd class="value">{{ tile.value }}</dd>
          <dd class="hint">{{ tile.hint }}</dd>
        </div>
      </dl>

      <ul
        v-if="rows.length"
        class="rows"
      >
        <li
          v-for="row in rows"
          :key="row.id"
          :class="`is-${PAYMENT_STATUS[row.status].tone}`"
        >
          <div class="main">
            <p class="label">{{ row.title }}</p>
            <p
              v-if="row.detail || (row.payer && row.source !== 'reservation')"
              class="meta"
            >
              <span v-if="row.detail">{{ row.detail }}</span>
              <span v-if="row.payer && row.source !== 'reservation'">{{ row.payer }}</span>
            </p>
            <p
              v-if="row.account"
              class="account"
            >
              <template v-if="row.source === 'reservation'">Hôte : </template>
              <template v-else>Compte : </template>
              <button
                v-if="row.account.userId"
                type="button"
                class="link"
                @click="emit('open-user', row.account.userId)"
              >
                {{ row.account.label }}
              </button>
              <span v-else>{{ row.account.label }}</span>
            </p>
          </div>
          <p class="amount">
            {{ formatMoney(row.amountMinor, row.currency) }}
            <small v-if="row.refundedMinor > 0">dont {{ formatMoney(row.refundedMinor, row.currency) }} remboursés</small>
          </p>
          <div class="status">
            <span
              class="badge"
              :class="`is-${PAYMENT_STATUS[row.status].tone}`"
            >{{ PAYMENT_STATUS[row.status].label }}</span>
            <p
              v-if="row.failureReason"
              class="reason"
            >
              {{ row.failureReason }}
            </p>
            <p class="when">{{ formatDateTime(row.createdAtISO) }}</p>
            <a
              v-if="row.stripeUrl"
              class="stripe"
              :href="row.stripeUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              Voir dans Stripe
              <ArrowUpRight
                :size="14"
                aria-hidden="true"
              />
            </a>
          </div>
        </li>
      </ul>
      <p
        v-else
        class="empty"
      >
        {{ emptyText }}
      </p>

      <p class="footnote">
        Paiements des {{ payments.periodDays }} derniers jours. Un voyageur parti avant de payer n’apparaît pas. Les réservations sont payées sur le compte Stripe de l’hôte : leur détail est dans son tableau de bord Stripe, pas dans celui d’IndieHost.
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Admin/sections/admin-payments.scss';
</style>
