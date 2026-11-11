<!-- File: src/views/Management/components/ManagementPaymentEditor.vue -->

<!-- Saisie d'un paiement reçu hors ligne (espèces, virement, chèque…). Repliée derrière un bouton :
     la plupart du temps l'hôte consulte, il ne saisit pas. -->

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus } from 'lucide-vue-next'

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
    // Change à chaque réservation affichée : le formulaire se referme.
    resetKey?: string | null
    error?: string | null
    success?: string | null
  }>(),
  {
    resetKey: null,
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

const isOpen = ref(false)

watch(
  () => props.resetKey,
  () => {
    isOpen.value = false
  },
)

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

function handleSubmit() {
  emit('add-manual-entry')
}
</script>

<template>
  <div class="payment-editor">
    <template v-if="canEditManualPayments">
      <div
        v-if="!isOpen"
        class="open-editor"
      >
        <button
          type="button"
          @click="isOpen = true"
        >
          <Plus
            :size="16"
            aria-hidden="true"
          />
          Ajouter un paiement reçu
        </button>
      </div>

      <form
        v-else
        class="manual-add"
        @submit.prevent="handleSubmit"
      >
        <p class="form-title">Paiement reçu hors ligne</p>

        <label class="field">
          <span>Moyen</span>
          <span class="select">
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
          </span>
        </label>

        <label class="field">
          <span>Montant (€)</span>
          <span class="control">
            <input
              :value="draftAmount ?? ''"
              type="number"
              inputmode="numeric"
              min="1"
              step="1"
              placeholder="0"
              :disabled="isSaving"
              @input="handleDraftAmountInput"
            />
          </span>
        </label>

        <label class="field">
          <span>Date</span>
          <span class="control">
            <input
              :value="draftDate"
              type="date"
              :disabled="isSaving"
              @input="handleDraftDateInput"
            />
          </span>
        </label>

        <label class="field is-wide">
          <span>Note (facultatif)</span>
          <span class="control">
            <input
              :value="draftComment"
              type="text"
              maxlength="180"
              placeholder="Ex. remis à l’arrivée"
              :disabled="isSaving"
              @input="handleDraftCommentInput"
            />
          </span>
        </label>

        <div class="actions">
          <div class="cancel">
            <button
              type="button"
              :disabled="isSaving"
              @click="isOpen = false"
            >
              Fermer
            </button>
          </div>
          <div class="submit">
            <button
              type="submit"
              :disabled="isSaving"
            >
              {{ isSaving ? 'Enregistrement…' : 'Enregistrer le paiement' }}
            </button>
          </div>
        </div>
      </form>
    </template>

    <p
      v-else
      class="hint"
    >
      Paiement en ligne suivi par Stripe : rien à saisir à la main.
    </p>

    <p
      v-if="error"
      class="feedback error"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-else-if="success"
      class="feedback success"
      role="status"
    >
      {{ success }}
    </p>
  </div>
</template>
