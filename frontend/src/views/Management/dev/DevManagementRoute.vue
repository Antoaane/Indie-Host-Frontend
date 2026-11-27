<!-- File: src/views/Management/dev/DevManagementRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import Management from '@/views/Management/_Management.vue'
import type { RawBookingReservation, RawListingBundle } from '@/domain/listings/types'
import type { EditorSource } from '@/views/Editor/types/editor'
import { createDevEditorSource } from '@/views/Editor/dev/devEditorSource'

// Route de développement (`/dev/management`, enregistrée seulement en `import.meta.env.DEV`) :
// l'écran « Réservations » sur les annonces en mémoire de `/dev/editor`, sans compte ni API. Elles
// contiennent une page principale, une vraie réservation et des dates venues d'un calendrier
// importé : de quoi vérifier que seules les vraies réservations ont une fiche et des paiements.
// `?groupe=1` : une réservation de plus sur l'appartement, en paiement à plusieurs pas encore complet.
const route = useRoute()
const withGroup = computed(() => 'groupe' in route.query)

function buildGroupReservation(): RawBookingReservation {
  const now = Date.now()
  return {
    id: 'dev-reservation-group',
    start: '2027-01-15',
    end: '2027-01-20',
    nights: 5,
    guestName: 'Sarah Lemoine',
    message: 'Nous venons à quatre pour l’anniversaire d’une amie.',
    guests: { adults: 4, children: 0, infants: 0, pets: 0, pmr: 0 },
    payment: {
      total: 450,
      deposit: 450,
      balance: 0,
      status: 'pending',
      method: 'En ligne, à plusieurs',
      stripe: { paymentIntentId: 'pi_mock_dev', status: 'requires_capture', chargeNowAmount: 450, deferredAmount: 0, paymentChoice: 'full', deferredMode: 'none', deferredDueDateISO: null },
      group: { id: 'grp-dev', status: 'pending', payers: 4, paidCount: 2, expiresAtISO: new Date(now + 40 * 60 * 60 * 1000).toISOString(), totalAmountMinor: 45_000 },
    },
    createdAt: new Date(now - 32 * 60 * 60 * 1000).toISOString(),
  }
}

function withGroupReservation<T extends Partial<RawListingBundle>>(listingId: string, bundle: T): T {
  if (listingId !== 'dev-apartment' || !bundle.bookings) return bundle
  const reservation = buildGroupReservation()
  return {
    ...bundle,
    bookings: {
      ...bundle.bookings,
      reservations: [...(bundle.bookings.reservations ?? []), reservation],
      'booked-days': [...(bundle.bookings['booked-days'] ?? []), { start: reservation.start, end: reservation.end }],
    },
  }
}

const source = computed<EditorSource>(() => {
  const base = createDevEditorSource()
  if (!withGroup.value) return base
  return {
    ...base,
    fetchEditableListingBundle: async (listingId) => withGroupReservation(listingId, await base.fetchEditableListingBundle(listingId)),
    fetchVolatileListingBundle: async (listingId) => withGroupReservation(listingId, await base.fetchVolatileListingBundle(listingId)),
  }
})
</script>

<template>
  <Management
    mode="static"
    :source="source"
  />
</template>
