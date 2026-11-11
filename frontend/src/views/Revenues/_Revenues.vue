<!-- File: src/views/Revenues/_Revenues.vue -->

<!-- « Mes revenus » : où en est le compte d'encaissement de l'hôte, ce qu'il a encaissé, ce qui
     arrive sur son compte bancaire. Les chiffres viennent de son compte Stripe ; la gestion fine
     (factures, litiges, coordonnées bancaires) reste dans son tableau de bord Stripe. -->

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, RefreshCw } from 'lucide-vue-next'

import type { StripeConnectOverview } from '@/domain/api/stripeSubscriptions'

const props = defineProps<{
  overview: StripeConnectOverview | null
  isLoading: boolean
  error: string | null
  isOpeningDashboard?: boolean
}>()

const emit = defineEmits<{
  (e: 'open-dashboard'): void
  (e: 'retry'): void
}>()

type AccountTone = 'is-ready' | 'is-waiting' | 'is-todo'

// Ce que l'hôte doit comprendre d'un coup d'œil, et la seule action utile s'il y en a une.
const accountState = computed<{ tone: AccountTone; title: string; text: string; action: string | null }>(() => {
  const account = props.overview?.account
  const status = account?.status ?? 'none'

  if (!account?.id) {
    return {
      tone: 'is-todo',
      title: 'Vos paiements ne sont pas encore activés',
      text: 'Créez votre compte d’encaissement Stripe pour recevoir le paiement de vos réservations directement sur votre compte bancaire.',
      action: 'Activer mes paiements',
    }
  }

  if (status === 'completed' && account.chargesEnabled) {
    return {
      tone: 'is-ready',
      title: 'Paiements activés',
      text: account.payoutsEnabled
        ? 'Vos voyageurs paient en ligne et Stripe vire les sommes sur votre compte bancaire, sans intervention de votre part.'
        : 'Vos voyageurs peuvent payer en ligne. Stripe finalise encore l’ouverture des virements vers votre banque.',
      action: null,
    }
  }

  if (status === 'verifying') {
    return {
      tone: 'is-waiting',
      title: 'Stripe vérifie vos informations',
      text: 'Vous n’avez rien à faire. Les paiements s’ouvriront dès la fin de la vérification, en général sous quelques jours.',
      action: null,
    }
  }

  return {
    tone: 'is-todo',
    title: 'Stripe attend encore des informations',
    text: 'Votre inscription n’est pas terminée : tant qu’elle ne l’est pas, vos voyageurs ne peuvent pas payer en ligne.',
    action: 'Terminer l’activation',
  }
})

const hasAccount = computed(() => Boolean(props.overview?.account.id))
const currentYear = new Date().getFullYear()

function formatAmount(amountMinor: number, currency: string) {
  const amount = amountMinor / 100
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(iso?: string | null) {
  if (!iso) return ''
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatCount(count: number) {
  if (!count) return 'Aucun paiement'
  return `${count} ${count > 1 ? 'paiements' : 'paiement'}`
}

const tiles = computed(() => {
  const overview = props.overview
  if (!overview) return []
  const { sales, balance } = overview
  const unknown = 'Indisponible'

  return [
    {
      label: 'Disponible',
      value: balance ? formatAmount(balance.availableMinor, balance.currency) : unknown,
      hint: 'Prêt à être viré sur votre compte bancaire.',
    },
    {
      label: 'En attente',
      value: balance ? formatAmount(balance.pendingMinor, balance.currency) : unknown,
      hint: 'Encaissé, en cours de mise à disposition par Stripe.',
    },
    {
      label: 'Encaissé sur 30 jours',
      value: formatAmount(sales.last30Days.amountMinor, sales.currency),
      hint: formatCount(sales.last30Days.count),
    },
    {
      label: `Encaissé en ${currentYear}`,
      value: formatAmount(sales.thisYear.amountMinor, sales.currency),
      hint: formatCount(sales.thisYear.count),
    },
  ]
})

type PaymentRow = StripeConnectOverview['payments'][number]

function paymentState(payment: PaymentRow): { label: string; tone: 'is-good' | 'is-warn' | 'is-bad' } {
  if (payment.disputeStatus && !['won', 'warning_closed'].includes(payment.disputeStatus)) return { label: 'Litige en cours', tone: 'is-bad' }
  if (payment.refundedAmountMinor >= payment.amountMinor && payment.amountMinor > 0) return { label: 'Remboursé', tone: 'is-warn' }
  if (payment.refundedAmountMinor > 0) return { label: 'Remboursé en partie', tone: 'is-warn' }
  if (payment.status === 'succeeded') return { label: 'Encaissé', tone: 'is-good' }
  if (payment.status === 'requires_capture') return { label: 'Autorisé', tone: 'is-warn' }
  return { label: 'En cours', tone: 'is-warn' }
}

function paymentMeta(payment: PaymentRow) {
  const parts = [payment.listingTitle]
  if (payment.reservation) parts.push(`du ${formatDate(payment.reservation.startDate)} au ${formatDate(payment.reservation.endDate)}`)
  return parts.join(' · ')
}

const PAYOUT_LABELS: Record<string, { label: string; tone: 'is-good' | 'is-warn' | 'is-bad' }> = {
  paid: { label: 'Versé', tone: 'is-good' },
  pending: { label: 'En préparation', tone: 'is-warn' },
  in_transit: { label: 'En route vers votre banque', tone: 'is-warn' },
  failed: { label: 'Échec du virement', tone: 'is-bad' },
  canceled: { label: 'Annulé', tone: 'is-bad' },
}

function payoutState(status: string) {
  return PAYOUT_LABELS[status] ?? { label: status, tone: 'is-warn' as const }
}
</script>

<template>
  <section
    id="revenues-page"
    class="revenues"
  >
    <header class="head">
      <div class="title">
        <h1>Mes revenus</h1>
        <p>Le paiement de vos réservations arrive directement sur votre compte Stripe, puis sur votre compte bancaire.</p>
      </div>
      <div
        v-if="hasAccount"
        class="open"
      >
        <button
          type="button"
          :disabled="isOpeningDashboard"
          @click="emit('open-dashboard')"
        >
          Ouvrir mon tableau de bord Stripe
          <ArrowUpRight
            :size="16"
            aria-hidden="true"
          />
        </button>
      </div>
    </header>

    <p
      v-if="isLoading && !overview"
      class="state"
      role="status"
    >
      Chargement de vos revenus…
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
          @click="emit('retry')"
        >
          <RefreshCw
            :size="16"
            aria-hidden="true"
          />
          Réessayer
        </button>
      </div>
    </div>

    <template v-else-if="overview">
      <div
        class="account"
        :class="accountState.tone"
      >
        <span
          class="dot"
          aria-hidden="true"
        />
        <div class="text">
          <h2>{{ accountState.title }}</h2>
          <p>{{ accountState.text }}</p>
        </div>
        <div
          v-if="accountState.action"
          class="activate"
        >
          <RouterLink :to="{ name: 'pricing-callback' }">{{ accountState.action }}</RouterLink>
        </div>
      </div>

      <template v-if="hasAccount">
        <p
          v-if="!overview.stripeAvailable"
          class="notice"
        >
          Stripe ne répond pas pour le moment : votre solde et vos virements s’afficheront au prochain chargement.
        </p>

        <dl class="tiles">
          <div
            v-for="tile in tiles"
            :key="tile.label"
          >
            <dt>{{ tile.label }}</dt>
            <dd>{{ tile.value }}</dd>
            <dd class="hint">{{ tile.hint }}</dd>
          </div>
        </dl>

        <section class="block">
          <h2>Derniers paiements</h2>
          <ul
            v-if="overview.payments.length"
            class="rows"
          >
            <li
              v-for="payment in overview.payments"
              :key="payment.id"
            >
              <div class="main">
                <p class="label">{{ payment.reservation?.guestName || 'Réservation' }}</p>
                <p class="meta">{{ paymentMeta(payment) }}</p>
              </div>
              <p class="amount">{{ formatAmount(payment.amountMinor, payment.currency) }}</p>
              <p
                class="status"
                :class="paymentState(payment).tone"
              >
                {{ paymentState(payment).label }} · {{ formatDate(payment.createdAt) }}
              </p>
            </li>
          </ul>
          <p
            v-else
            class="empty"
          >
            Aucun paiement pour le moment. Ils apparaîtront ici dès votre première réservation payée en ligne.
          </p>
        </section>

        <section
          v-if="overview.stripeAvailable"
          class="block"
        >
          <h2>Virements vers votre banque</h2>
          <ul
            v-if="overview.payouts.length"
            class="rows"
          >
            <li
              v-for="payout in overview.payouts"
              :key="payout.id"
            >
              <div class="main">
                <p class="label">Virement</p>
                <p class="meta">{{ payout.arrivalDate ? `Arrivée prévue le ${formatDate(payout.arrivalDate)}` : 'Date d’arrivée à venir' }}</p>
              </div>
              <p class="amount">{{ formatAmount(payout.amountMinor, payout.currency) }}</p>
              <p
                class="status"
                :class="payoutState(payout.status).tone"
              >
                {{ payoutState(payout.status).label }}
              </p>
            </li>
          </ul>
          <p
            v-else
            class="empty"
          >
            Aucun virement pour le moment. Stripe les déclenche automatiquement après vos premiers encaissements.
          </p>
        </section>
      </template>
    </template>
  </section>
</template>

<style lang="scss">
@use '@/views/Revenues/revenues.scss';
</style>
