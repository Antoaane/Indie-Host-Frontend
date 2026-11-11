<!-- File: src/views/Management/components/ManagementScheduleCard.vue -->

<!-- Paiements d'une réservation : une ligne par paiement (libellé, précision, montant, état). -->

<script setup lang="ts">
import { computed } from 'vue'
import { Trash2 } from 'lucide-vue-next'

import type {
  ReservationPaymentSchedule,
  ReservationPaymentScheduleEntry,
} from '@/views/Management/utils/managementReservations'

const props = defineProps<{
  schedule: ReservationPaymentSchedule
  methodLabel: string
  // Paiement en ligne suivi par Stripe : le solde différé est prélevé en ligne, pas par l'hôte.
  isStripeBacked?: boolean
  canRemoveManualEntries?: boolean
  isSaving?: boolean
  formatCurrency: (value?: number) => string
  formatDate: (iso?: string | null) => string
}>()

const emit = defineEmits<{
  (e: 'remove-manual-entry', entryId: string): void
}>()

function entryStatusLabel(status: ReservationPaymentScheduleEntry['status']) {
  return status === 'paid' ? 'Payé' : 'En attente'
}

function entryStatusClass(status: ReservationPaymentScheduleEntry['status']) {
  return status === 'paid' ? 'is-paid' : 'is-pending'
}

// Une seule ligne de précision : le moyen de paiement, puis la date quand elle est réellement connue.
function entryMeta(entry: ReservationPaymentScheduleEntry): string {
  const parts: string[] = []

  if (entry.source === 'manual') {
    parts.push(entry.methodLabel || 'Paiement manuel')
    if (entry.dateISO) parts.push(`le ${props.formatDate(entry.dateISO)}`)
    if (entry.detail) parts.push(entry.detail)
    return parts.join(' · ')
  }

  if (entry.source === 'deferred') {
    if (entry.status === 'paid') return 'Solde réglé'
    if (props.schedule.deferredModeLabel && props.isStripeBacked) parts.push(props.schedule.deferredModeLabel)
    else parts.push('À encaisser par vos soins')
    if (entry.dateISO) parts.push(`échéance le ${props.formatDate(entry.dateISO)}`)
    return parts.join(' · ')
  }

  parts.push(props.methodLabel)
  if (props.isStripeBacked && entry.detail) parts.push(entry.detail)
  return parts.join(' · ')
}

function canRemoveEntry(entry: ReservationPaymentScheduleEntry): boolean {
  return Boolean(props.canRemoveManualEntries && entry.source === 'manual' && entry.manualEntryId)
}

// Dès qu'une ligne peut être supprimée, toutes réservent la même place : montants et états alignés.
const hasRemovableEntry = computed(() => props.schedule.entries.some((entry) => canRemoveEntry(entry)))

function handleRemoveEntry(entry: ReservationPaymentScheduleEntry) {
  if (!entry.manualEntryId || !canRemoveEntry(entry)) return
  emit('remove-manual-entry', entry.manualEntryId)
}
</script>

<template>
  <ul
    v-if="schedule.entries.length"
    class="schedule-card"
  >
    <li
      v-for="entry in schedule.entries"
      :key="entry.id"
      class="payment-item"
      :class="entryStatusClass(entry.status)"
    >
      <div class="main">
        <p class="label">{{ entry.label }}</p>
        <p class="meta">{{ entryMeta(entry) }}</p>
      </div>

      <p class="amount">{{ formatCurrency(entry.amount) }}</p>

      <p
        class="entry-state"
        :class="entryStatusClass(entry.status)"
      >
        {{ entryStatusLabel(entry.status) }}
      </p>

      <div
        v-if="hasRemovableEntry"
        class="action"
      >
        <button
          v-if="canRemoveEntry(entry)"
          type="button"
          class="remove-manual-entry"
          :disabled="isSaving"
          :aria-label="`Supprimer le paiement de ${formatCurrency(entry.amount)}`"
          title="Supprimer ce paiement"
          @click="handleRemoveEntry(entry)"
        >
          <Trash2
            :size="16"
            aria-hidden="true"
          />
        </button>
      </div>
    </li>
  </ul>

  <p
    v-else
    class="schedule-empty"
  >
    Aucun paiement enregistré pour cette réservation.
  </p>
</template>
