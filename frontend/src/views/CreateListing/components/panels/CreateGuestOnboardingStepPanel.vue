<!-- File: src/views/CreateListing/components/panels/CreateGuestOnboardingStepPanel.vue -->

<script setup lang="ts">
import CreateWizardStepShell from '@/views/CreateListing/components/panels/CreateWizardStepShell.vue'

const props = defineProps<{
  email: string
  emailError?: string | null
  infoMessage?: string | null
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:email', value: string): void
  (e: 'back'): void
  (e: 'start-publish'): void
  (e: 'start-setup'): void
  (e: 'continue-without-account'): void
}>()
</script>

<template>
  <CreateWizardStepShell
    class="create-guest-onboarding-shell"
    title="Finaliser votre publication"
    hint="Ajoutez votre e-mail pour relier ce brouillon à votre onboarding compte."
  >
    <section class="create-guest-onboarding-step-panel">
      <div class="email-field">
        <label for="create-listing-guest-email">Adresse e-mail</label>
        <input
          id="create-listing-guest-email"
          :value="props.email"
          type="email"
          inputmode="email"
          autocomplete="email"
          placeholder="vous@exemple.com"
          :disabled="props.isLoading"
          @input="emit('update:email', String(($event.target as HTMLInputElement | null)?.value ?? ''))"
        >
        <p
          v-if="props.emailError"
          class="error"
        >
          {{ props.emailError }}
        </p>
        <p
          v-if="props.infoMessage"
          class="info"
        >
          {{ props.infoMessage }}
        </p>
      </div>

      <div class="actions">
        <button
          type="button"
          class="btn primary"
          :disabled="props.isLoading"
          @click="emit('start-publish')"
        >
          Finaliser publication
        </button>

        <button
          type="button"
          class="btn secondary"
          :disabled="props.isLoading"
          @click="emit('start-setup')"
        >
          Créer mon compte sans publier
        </button>

        <button
          type="button"
          class="btn ghost"
          :disabled="props.isLoading"
          @click="emit('continue-without-account')"
        >
          Continuer sans compte
        </button>
      </div>

      <button
        type="button"
        class="back"
        :disabled="props.isLoading"
        @click="emit('back')"
      >
        Retour à l’aperçu
      </button>
    </section>
  </CreateWizardStepShell>
</template>

<style lang="scss">
/* File: src/views/CreateListing/components/panels/create-guest-onboarding-step-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.create-guest-onboarding-step-panel {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin: 0 auto;
  flex: 0 1 auto;
  display: flex;
  flex-direction: column;
  gap: var(--layout-gap-md);
}

.create-guest-onboarding-shell {
  width: min(100%, 46rem);
  max-width: 100%;
  margin: 0 auto;
}

.create-guest-onboarding-step-panel {
  > .email-field {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;

    > label {
      @include little-text($thin: false);
      font-weight: 700;
    }

    > input {
      width: 100%;
      border-radius: borders.$rounded;
      border: 1px solid rgba($secondary, 0.2);
      background: $accent;
      padding: 0.75rem 0.85rem;
      color: $secondary-text;
    }

    > .error {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($bad, 0.95);
    }

    > .info {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($good, 0.95);
    }
  }

  > .actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.6rem;

    > .btn {
      border: none;
      border-radius: borders.$rounded;
      padding: 0.7rem 0.9rem;
      cursor: pointer;
      font-weight: 700;

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      &.primary {
        background: $secondary;
        color: $accent;
      }

      &.secondary {
        background: rgba($secondary, 0.12);
        color: $secondary-text;
      }

      &.ghost {
        background: transparent;
        border: 1px solid rgba($secondary, 0.18);
        color: rgba($secondary-text, 0.85);
      }
    }
  }

  > .back {
    align-self: flex-start;
    border: none;
    background: transparent;
    color: rgba($secondary-text, 0.68);
    text-decoration: underline;
    cursor: pointer;
  }
}
</style>
