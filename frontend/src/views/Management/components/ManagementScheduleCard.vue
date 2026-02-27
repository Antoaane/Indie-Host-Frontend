<!-- File: src/views/Management/components/ManagementScheduleCard.vue -->

<script setup lang="ts">
import type {
  ReservationPaymentSchedule,
  ReservationPaymentScheduleEntry,
} from '@/views/Management/utils/managementReservations'

const props = defineProps<{
  schedule: ReservationPaymentSchedule
  methodLabel: string
  issueDateIso?: string | null
  fallbackPaymentDateIso?: string | null
  canRemoveManualEntries?: boolean
  isSaving?: boolean
  formatCurrency: (value?: number) => string
  formatDate: (iso?: string | null) => string
}>()

const emit = defineEmits<{
  (e: 'remove-manual-entry', entryId: string): void
}>()

function entryStatusLabel(status: ReservationPaymentScheduleEntry['status']) {
  return status === 'paid' ? 'Paye' : 'En attente'
}

function entryStatusClass(status: ReservationPaymentScheduleEntry['status']) {
  return status === 'paid' ? 'is-paid' : 'is-pending'
}

function entryModeLabel(entry: ReservationPaymentScheduleEntry) {
  if (entry.source === 'manual') return entry.methodLabel || 'Paiement manuel'
  if (entry.source === 'deferred') {
    return props.schedule.deferredModeLabel
  }
  return props.methodLabel
}

function entryPaymentDateISO(entry: ReservationPaymentScheduleEntry): string | null {
  if (entry.dateISO) return entry.dateISO
  if (entry.source === 'deferred') {
    return props.schedule.deferredDueDateISO ?? props.fallbackPaymentDateIso ?? null
  }
  return props.issueDateIso ?? null
}

function canRemoveEntry(entry: ReservationPaymentScheduleEntry): boolean {
  return Boolean(props.canRemoveManualEntries && entry.source === 'manual' && entry.manualEntryId)
}

function handleRemoveEntry(entry: ReservationPaymentScheduleEntry) {
  if (!entry.manualEntryId || !canRemoveEntry(entry)) return
  emit('remove-manual-entry', entry.manualEntryId)
}
</script>

<template>
  <div class="schedule-card">
    <div
      v-if="schedule.entries.length"
      class="list-entries"
    >
      <article
        v-for="entry in schedule.entries"
        :key="entry.id"
        class="payment-item"
        :class="`is-${entry.source}`"
      >
        <div class="payment-item-head">
          <h4>{{ entry.label }}</h4>
          <div class="payment-item-actions">
            <strong>{{ formatCurrency(entry.amount) }}</strong>
            <button
              v-if="canRemoveEntry(entry)"
              type="button"
              class="remove-manual-entry"
              :disabled="isSaving"
              @click="handleRemoveEntry(entry)"
            >
              Supprimer
            </button>
          </div>
        </div>

        <div class="payment-item-rows">
          <div class="row">
            <span>Mode de paiement</span>
            <strong>{{ entryModeLabel(entry) }}</strong>
          </div>
          <div class="row">
            <span>Date d'emission</span>
            <strong>{{ issueDateIso ? formatDate(issueDateIso) : '-' }}</strong>
          </div>
          <div class="row">
            <span>Date de paiement</span>
            <strong>{{ entryPaymentDateISO(entry) ? formatDate(entryPaymentDateISO(entry)) : '-' }}</strong>
          </div>
          <div class="row status-row">
            <span>Etat</span>
            <span
              class="entry-state"
              :class="entryStatusClass(entry.status)"
            >
              {{ entryStatusLabel(entry.status) }}
            </span>
          </div>
        </div>
      </article>
    </div>

    <p
      v-else
      class="list-empty"
    >
      Aucune echeance configuree.
    </p>
  </div>
</template>
