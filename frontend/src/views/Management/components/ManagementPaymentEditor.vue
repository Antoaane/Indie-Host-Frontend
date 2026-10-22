<!-- File: src/views/Management/components/ManagementPaymentEditor.vue -->

<script setup lang="ts">
import type { ReservationPaymentManualMethod } from '@/views/Management/utils/managementReservations'

const props = withDefaults(
  defineProps<{
    draftAmount: number | null
    draftMethod: ReservationPaymentManualMethod
    draftDate: string
    draftComment: string
    manualPaymentMethods: ReadonlyArray<{
      value: ReservationPaymentManualMethod
      label: string
    }>
    isSaving: boolean
    canEditManualPayments: boolean
    error?: string | null
    success?: string | null
  }>(),
  {
    error: null,
    success: null,
  },
)

const emit = defineEmits<{
  (e: 'update:draftAmount', value: number | null): void
  (e: 'update:draftMethod', value: ReservationPaymentManualMethod): void
  (e: 'update:draftDate', value: string): void
  (e: 'update:draftComment', value: string): void
  (e: 'add-manual-entry'): void
}>()

function getInputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement | null)?.value ?? ''
}

function toNonNegativeNumber(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

function handleDraftAmountInput(event: Event) {
  const raw = getInputValue(event)
  if (!raw.trim()) {
    emit('update:draftAmount', null)
    return
  }
  emit('update:draftAmount', toNonNegativeNumber(raw))
}

function handleDraftMethodInput(event: Event) {
  const value = getInputValue(event) as ReservationPaymentManualMethod
  emit('update:draftMethod', value)
}

function handleDraftDateInput(event: Event) {
  emit('update:draftDate', getInputValue(event))
}

function handleDraftCommentInput(event: Event) {
  emit('update:draftComment', getInputValue(event))
}
</script>

<template>
  <div class="payment-editor-card">
    <div class="section-title">
      <h4>Paiements manuels</h4>
    </div>

    <div class="payment-editor">
      <div
        v-if="canEditManualPayments"
        class="manual-editor"
      >
        <div class="manual-add">
          <select
            :value="draftMethod"
            :disabled="isSaving"
            @change="handleDraftMethodInput"
          >
            <option
              v-for="method in props.manualPaymentMethods"
              :key="method.value"
              :value="method.value"
            >
              {{ method.label }}
            </option>
          </select>
          <input
            :value="draftAmount ?? ''"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            placeholder="Montant"
            :disabled="isSaving"
            @input="handleDraftAmountInput"
          />
          <input
            :value="draftDate"
            type="date"
            :disabled="isSaving"
            @input="handleDraftDateInput"
          />
          <input
            :value="draftComment"
            type="text"
            maxlength="180"
            placeholder="Note"
            :disabled="isSaving"
            @input="handleDraftCommentInput"
          />
          <button
            type="button"
            :disabled="isSaving"
            @click="emit('add-manual-entry')"
          >
            Ajouter
          </button>
        </div>
      </div>
      <p
        v-else
        class="hint"
      >
        Edition verrouillee.
      </p>

      <p
        v-if="error"
        class="feedback error"
      >
        {{ error }}
      </p>
      <p
        v-if="success"
        class="feedback success"
      >
        {{ success }}
      </p>
    </div>
  </div>
</template>
