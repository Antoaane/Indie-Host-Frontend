<!-- File: src/views/Revenues/dev/DevRevenuesRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import type { StripeConnectOverview } from '@/domain/api/stripeSubscriptions'
import Revenues from '@/views/Revenues/_Revenues.vue'

// Route de développement (`/dev/revenues`, enregistrée seulement en `import.meta.env.DEV`) : la page
// « Mes revenus » sur de faux chiffres, sans compte ni Stripe. `?state=` choisit le cas affiché :
// `active` (par défaut), `verifying`, `none`, `empty` (compte actif, aucun paiement), `offline`.
const route = useRoute()

const ACTIVE: StripeConnectOverview = {
  account: { id: 'acct_dev', status: 'completed', chargesEnabled: true, payoutsEnabled: true },
  stripeAvailable: true,
  balance: { currency: 'eur', availableMinor: 41000, pendingMinor: 20500 },
  payouts: [
    { id: 'po_1', amountMinor: 34000, currency: 'eur', status: 'paid', arrivalDate: '2026-10-19' },
    { id: 'po_2', amountMinor: 41000, currency: 'eur', status: 'in_transit', arrivalDate: '2026-11-13' },
  ],
  sales: { currency: 'eur', last30Days: { amountMinor: 61500, count: 2 }, thisYear: { amountMinor: 245050, count: 9 } },
  payments: [
    {
      id: 'pay_1',
      listingId: 'dev-apartment',
      listingTitle: 'Appartement les Raisins Clairs',
      amountMinor: 20500,
      currency: 'eur',
      status: 'succeeded',
      createdAt: '2026-11-02T10:00:00.000Z',
      refundedAmountMinor: 0,
      disputeStatus: null,
      reservation: { id: 'r1', guestName: 'Camille Durand', startDate: '2026-11-24', endDate: '2026-11-28' },
    },
    {
      id: 'pay_2',
      listingId: 'dev-apartment',
      listingTitle: 'Appartement les Raisins Clairs',
      amountMinor: 41000,
      currency: 'eur',
      status: 'succeeded',
      createdAt: '2026-10-21T08:30:00.000Z',
      refundedAmountMinor: 12000,
      disputeStatus: null,
      reservation: { id: 'r2', guestName: 'Jean-Baptiste de La Rochefoucauld-Montmorency', startDate: '2026-12-01', endDate: '2026-12-06' },
    },
    {
      id: 'pay_3',
      listingId: 'dev-studio',
      listingTitle: 'Studio du Port',
      amountMinor: 18050,
      currency: 'eur',
      status: 'processing',
      createdAt: '2026-10-03T16:45:00.000Z',
      refundedAmountMinor: 0,
      disputeStatus: null,
      reservation: null,
    },
  ],
}

const EMPTY_SALES = { currency: 'eur', last30Days: { amountMinor: 0, count: 0 }, thisYear: { amountMinor: 0, count: 0 } }

const overview = computed<StripeConnectOverview>(() => {
  switch (route.query.state) {
    case 'verifying':
      return {
        account: { id: 'acct_dev', status: 'verifying', chargesEnabled: false, payoutsEnabled: false },
        stripeAvailable: true,
        balance: { currency: 'eur', availableMinor: 0, pendingMinor: 0 },
        payouts: [],
        sales: EMPTY_SALES,
        payments: [],
      }
    case 'none':
      return {
        account: { id: null, status: 'not_started', chargesEnabled: false, payoutsEnabled: false },
        stripeAvailable: false,
        balance: null,
        payouts: [],
        sales: EMPTY_SALES,
        payments: [],
      }
    case 'empty':
      return { ...ACTIVE, balance: { currency: 'eur', availableMinor: 0, pendingMinor: 0 }, payouts: [], sales: EMPTY_SALES, payments: [] }
    case 'offline':
      return { ...ACTIVE, stripeAvailable: false, balance: null, payouts: [] }
    default:
      return ACTIVE
  }
})
</script>

<template>
  <Revenues
    :overview="overview"
    :is-loading="false"
    :error="null"
  />
</template>
