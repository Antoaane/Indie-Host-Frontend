<!-- File: src/views/BookingGroup/dev/DevBookingGroupRoute.vue -->

<script setup lang="ts">
// Route de développement (`/dev/group-payment`, enregistrée seulement en `import.meta.env.DEV`) : la
// page du paiement à plusieurs sur un groupe en mémoire, sans API ni Stripe.
// - `?role=organizer` (défaut) ou `?role=participant` ;
// - `&etat=pending` (défaut), `paid` (la part de l'amie est réglée), `seul` (seule l'organisatrice a
//   réglé : une personne peut être retirée), `complet`, `expire`, `annule`.
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import BookingGroupView from '@/views/BookingGroup/BookingGroupView.vue'
import { createDevGroupPaymentSource, type DevGroupScenario } from '@/views/BookingGroup/dev/devGroupPaymentSource'

const route = useRoute()

const scenario = computed<DevGroupScenario>(() => {
  const role = route.query.role === 'participant' ? 'participant' : 'organizer'
  const raw = typeof route.query.etat === 'string' ? route.query.etat : ''
  const state: DevGroupScenario['state'] = raw === 'paid'
    ? 'paid'
    : raw === 'seul'
      ? 'alone'
    : raw === 'complet'
      ? 'completed'
      : raw === 'expire'
        ? 'expired'
        : raw === 'annule'
          ? 'canceled'
          : 'pending'
  return { role, state }
})

const source = computed(() => createDevGroupPaymentSource(scenario.value))
const viewKey = computed(() => `${scenario.value.role}-${scenario.value.state}`)
</script>

<template>
  <BookingGroupView
    :key="viewKey"
    :source="source"
    share-key="gp_dev_000000000000000000000000"
  />
</template>
