<!-- File: src/components/navs/Nav/HostDataSettings.vue -->

<script setup lang="ts">
import { useAuth } from '@clerk/vue'
import { ref, watch } from 'vue'

import { AccountDeletionRefusedError, deleteMyAccount, downloadMyDataExport } from '@/domain/api/privacy'

// Droits RGPD depuis Mon profil : export JSON de toutes les données du compte et suppression du
// compte (anonymisation côté API, puis fermeture de l'identifiant Clerk et déconnexion).
const props = defineProps<{
  active: boolean
}>()

const { signOut } = useAuth()

const isExporting = ref(false)
const exportError = ref('')
const exportSuccess = ref('')

const isConfirmingDeletion = ref(false)
const isDeleting = ref(false)
const deletionError = ref('')

async function handleExport() {
  if (isExporting.value) return
  isExporting.value = true
  exportError.value = ''
  exportSuccess.value = ''
  try {
    await downloadMyDataExport()
    exportSuccess.value = 'Votre export est en cours de téléchargement.'
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : 'Le téléchargement de vos données a échoué.'
  } finally {
    isExporting.value = false
  }
}

async function handleDelete() {
  if (isDeleting.value) return
  isDeleting.value = true
  deletionError.value = ''
  try {
    const result = await deleteMyAccount()
    if (result.warning) {
      window.alert(result.warning)
    }
    await signOut.value({ redirectUrl: '/' })
  } catch (error) {
    if (error instanceof AccountDeletionRefusedError) {
      deletionError.value = error.message
      isConfirmingDeletion.value = false
    } else {
      deletionError.value = error instanceof Error ? error.message : 'La suppression du compte a échoué.'
    }
  } finally {
    isDeleting.value = false
  }
}

watch(
  () => props.active,
  (active) => {
    if (active) return
    isConfirmingDeletion.value = false
    exportError.value = ''
    exportSuccess.value = ''
    deletionError.value = ''
  },
)
</script>

<template>
  <section
    class="host-data-settings"
    aria-labelledby="host-data-settings-title"
  >
    <h3 id="host-data-settings-title">
      Mes données
    </h3>

    <p class="hint">
      Vous pouvez récupérer à tout moment une copie de tout ce qu'IndieHost conserve sur vous : profil, annonces, réservations, messages et paiements, au format JSON.
    </p>

    <div class="actions">
      <button
        type="button"
        class="ghost-button"
        :disabled="isExporting"
        @click="handleExport"
      >
        {{ isExporting ? 'Préparation…' : 'Télécharger mes données' }}
      </button>
    </div>

    <p
      v-if="exportSuccess"
      class="status is-success"
      aria-live="polite"
    >
      {{ exportSuccess }}
    </p>

    <p
      v-if="exportError"
      class="status is-error"
      role="alert"
    >
      {{ exportError }}
    </p>

    <template v-if="isConfirmingDeletion">
      <p class="hint is-danger">
        Vos annonces seront retirées, vos informations personnelles effacées et votre identifiant de connexion fermé. Cette action est définitive. Les montants des paiements restent conservés, anonymisés, pour nos obligations comptables.
      </p>
      <div class="actions">
        <button
          type="button"
          class="ghost-button"
          :disabled="isDeleting"
          @click="isConfirmingDeletion = false"
        >
          Garder mon compte
        </button>
        <button
          type="button"
          class="danger-button"
          :disabled="isDeleting"
          @click="handleDelete"
        >
          {{ isDeleting ? 'Suppression…' : 'Confirmer la suppression' }}
        </button>
      </div>
    </template>

    <div
      v-else
      class="actions"
    >
      <button
        type="button"
        class="danger-button"
        @click="isConfirmingDeletion = true"
      >
        Supprimer mon compte
      </button>
    </div>

    <p
      v-if="deletionError"
      class="status is-error"
      role="alert"
    >
      {{ deletionError }}
    </p>

    <p class="note">
      Détail des données conservées et de leurs durées :
      <RouterLink to="/legal/confidentialite">
        politique de confidentialité
      </RouterLink>.
    </p>
  </section>
</template>

<style lang="scss">
/* File: src/components/navs/Nav/HostDataSettings.vue */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/buttons' as buttons;

.host-data-settings {
  display: flex;
  flex-direction: column;
  gap: var(--layout-gap-sm);
  padding-top: var(--layout-gap);
  border-top: 1px solid rgba($secondary, 0.08);

  > h3 {
    margin: 0;
    @include h4-title($colorful: false);
  }

  > .hint,
  > .note {
    margin: 0;

    a {
      color: $secondary;
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }
  }

  > .hint {
    @include little-text(rgba($secondary-text, 0.72), $thin: false);

    &.is-danger {
      color: $bad-ink;
    }
  }

  > .note {
    @include little-text(rgba($secondary-text, 0.62), $thin: false);
  }

  > .status {
    margin: 0;
    @include little-text($thin: false);

    &.is-error {
      color: $bad-ink;
    }

    &.is-success {
      color: $good-ink;
    }
  }

  > .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--layout-gap-xs);

    > .ghost-button {
      @include buttons.secondary;
    }

    > .danger-button {
      @include buttons.secondary;

      > * {
        color: $bad-ink;
      }

      @include on-hover {
        > * {
          color: $bad-ink;
          background: rgba($bad, 0.08);
        }
      }
    }
  }
}
</style>
