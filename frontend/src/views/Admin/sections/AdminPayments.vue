<!-- File: src/views/Admin/sections/AdminPayments.vue -->

<!-- Paiements des 90 derniers jours, réussis comme refusés, en deux listes qui ne s'additionnent jamais :
     « Abonnements », ce que reçoit IndieHost sur son compte Stripe (seuls ces paiements font les chiffres
     du haut), et « Réservations des hôtes », payées par les voyageurs sur le compte Stripe de chaque
     hôte. IndieHost n'en touche rien : elles sont montrées pour information (carte refusée, litige), avec
     leurs refus et leurs litiges, sans total encaissé. Un refus porte son motif ; un paiement reçu par
     IndieHost s'ouvre dans son tableau de bord Stripe. -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUpRight, Info, RefreshCw } from '@lucide/vue'

import type { AdminPaymentList, AdminPaymentRow, AdminPayments } from '@/domain/api/admin'
import { PAYMENT_STATUS, formatCount, formatDateTime, formatMoney, pluralize } from '@/views/Admin/adminFormat'

const props = defineProps<{
  payments: AdminPayments | null
  list: AdminPaymentList
  isLoading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'update:list', list: AdminPaymentList): void
  (e: 'open-user', userId: string): void
}>()

type StatusFilter = 'all' | 'succeeded' | 'failed' | 'refunds'

const statusFilter = ref<StatusFilter>('all')

const LISTS: Array<{ id: AdminPaymentList; label: string }> = [
  { id: 'platform', label: 'Abonnements' },
  { id: 'reservations', label: 'Réservations des hôtes' },
]

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'succeeded', label: 'Réussis' },
  { id: 'failed', label: 'Refusés' },
  { id: 'refunds', label: 'Remboursés et litiges' },
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

const isReservations = computed(() => props.list === 'reservations')

// Lignes de la liste ouverte, avant le filtre d'état.
const listRows = computed<AdminPaymentRow[]>(() => {
  const payments = props.payments
  if (!payments) return []
  return isReservations.value ? payments.reservations.rows : payments.platform?.rows ?? []
})

const rows = computed(() => listRows.value.filter((row) => matchesStatus(row, statusFilter.value)))

function countFor(filter: StatusFilter): number {
  return listRows.value.filter((row) => matchesStatus(row, filter)).length
}

// Chiffres du haut. Abonnements : ce qu'IndieHost a reçu. Réservations : leurs refus et leurs litiges,
// jamais de montant total (cet argent est aux hôtes).
const tiles = computed(() => {
  const payments = props.payments
  if (!payments) return []
  if (isReservations.value) {
    const { failedCount, disputedCount } = payments.reservations
    return [
      { label: 'Refusés sur 30 jours', value: formatCount(failedCount), hint: failedCount ? 'le voyageur n’a pas réservé' : 'aucun refus', tone: failedCount ? 'is-bad' : '' },
      { label: 'Litiges en cours', value: formatCount(disputedCount), hint: disputedCount ? 'l’hôte répond dans son tableau de bord Stripe' : 'aucun litige', tone: disputedCount ? 'is-bad' : '' },
    ]
  }
  const totals = payments.platform?.totals
  if (!totals) return []
  return [
    { label: 'Encaissé sur 30 jours', value: formatMoney(totals.succeededMinor, totals.currency), hint: pluralize(totals.succeededCount, 'paiement réussi', 'paiements réussis'), tone: '' },
    { label: 'Refusés sur 30 jours', value: formatCount(totals.failedCount), hint: totals.failedCount ? 'carte refusée ou 3-D Secure non validé' : 'aucun refus', tone: totals.failedCount ? 'is-bad' : '' },
    { label: 'Remboursé sur 30 jours', value: formatMoney(totals.refundedMinor, totals.currency), hint: 'aux hôtes', tone: '' },
    { label: 'Litiges en cours', value: formatCount(totals.disputedCount), hint: totals.disputedCount ? 'à traiter dans Stripe' : 'aucun litige', tone: totals.disputedCount ? 'is-bad' : '' },
  ]
})

// Liste des abonnements sans Stripe : un message à la place des chiffres et des lignes.
const isPlatformUnavailable = computed(() => Boolean(props.payments) && !isReservations.value && !props.payments?.platform)

const emptyText = computed(() => {
  const days = props.payments?.periodDays ?? 90
  if (listRows.value.length) return 'Aucun paiement ne correspond à ce filtre.'
  return isReservations.value
    ? `Aucun paiement de réservation sur les ${days} derniers jours.`
    : `Aucun paiement reçu par IndieHost sur les ${days} derniers jours.`
})
</script>

<template>
  <section
    class="admin-payments"
    aria-label="Paiements"
  >
    <div class="filters">
      <div class="line">
        <div
          class="chips"
          role="group"
          aria-label="Paiements affichés"
        >
          <div
            v-for="entry in LISTS"
            :key="entry.id"
            :class="{ 'is-active': list === entry.id }"
          >
            <button
              type="button"
              :aria-pressed="list === entry.id"
              @click="emit('update:list', entry.id)"
            >
              {{ entry.label }}
            </button>
          </div>
        </div>
        <div class="refresh">
          <button
            type="button"
            :disabled="isLoading"
            aria-label="Relire les paiements"
            title="Relire les paiements"
            @click="emit('refresh')"
          >
            <RefreshCw
              :size="16"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
      <div
        v-if="!isPlatformUnavailable"
        class="chips is-status"
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
        v-if="isReservations"
        class="aside"
      >
        <Info
          :size="16"
          aria-hidden="true"
        />
        <span><strong>Pour information.</strong> Les voyageurs paient sur le compte Stripe de l’hôte : IndieHost n’en touche rien, et ces paiements n’entrent dans aucun de ses chiffres.</span>
      </p>

      <p
        v-if="isPlatformUnavailable"
        class="notice"
      >
        Stripe ne répond pas : les paiements reçus par IndieHost reviendront au prochain chargement.
      </p>

      <dl
        v-if="tiles.length"
        class="tiles"
      >
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
        v-else-if="!isPlatformUnavailable"
        class="empty"
      >
        {{ emptyText }}
      </p>

      <p class="footnote">
        <template v-if="isReservations">
          Réservations des {{ payments.periodDays }} derniers jours. Un voyageur parti avant de payer n’apparaît pas. Le détail de chaque paiement est dans le tableau de bord Stripe de l’hôte, pas dans celui d’IndieHost.
        </template>
        <template v-else>
          Paiements reçus par IndieHost sur les {{ payments.periodDays }} derniers jours, lus chez Stripe. Une page de paiement quittée sans payer n’apparaît pas.
        </template>
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Admin/sections/admin-payments.scss';
</style>
