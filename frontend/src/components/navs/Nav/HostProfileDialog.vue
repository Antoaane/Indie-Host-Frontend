<!-- File: src/components/navs/Nav/HostProfileDialog.vue -->

<script setup lang="ts">
import { useAuth, useClerk, useUser } from '@clerk/vue'
import { UserRound, X } from 'lucide-vue-next'
import { computed, reactive, ref, watch } from 'vue'

import AbsoluteOverlay from '@/components/overlays/AbsoluteOverlay.vue'
import HostSubscriptionSettings from '@/components/navs/Nav/HostSubscriptionSettings.vue'
import { fetchMyUser, updateMyUser } from '@/domain/api/users'
import clerkToken from '@/utils/clerkToken'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (event: 'close'): void
}>()

const { getToken } = useAuth()
const { user } = useUser()
const clerk = useClerk()

const state = reactive({
  isLoading: false,
  isSaving: false,
  loadError: '',
  saveError: '',
  saveSuccess: '',
})

const form = reactive({
  pseudo: '',
  bio: '',
})

const hostProfileSnapshot = ref<Record<string, unknown>>({})

const pseudoFallback = computed(() => {
  const firstName = typeof user.value?.firstName === 'string' ? user.value.firstName.trim() : ''
  const lastName = typeof user.value?.lastName === 'string' ? user.value.lastName.trim() : ''
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim()
  if (combined) return combined

  const username = typeof user.value?.username === 'string' ? user.value.username.trim() : ''
  if (username) return username

  return ''
})

const avatarUrl = computed(() => {
  const imageUrl = user.value?.imageUrl
  if (typeof imageUrl !== 'string') return ''
  return imageUrl.trim()
})

const pseudoTooShort = computed(() => form.pseudo.trim().length < 2)

const canSubmit = computed(() => {
  if (state.isSaving || state.isLoading) return false
  if (pseudoTooShort.value) return false
  return true
})

function readString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function readBioFromProfile(profile: Record<string, unknown>): string {
  const candidates = [
    readString(profile.bio),
    readString(profile.about),
    readString(profile.description),
  ]

  return candidates.find(Boolean) ?? ''
}

async function ensureClerkToken() {
  const token = await getToken.value()
  clerkToken.value = token ?? null
}

function resetStatusMessages() {
  state.loadError = ''
  state.saveError = ''
  state.saveSuccess = ''
}

function primeFormWithDefaults() {
  form.pseudo = pseudoFallback.value
  form.bio = ''
  hostProfileSnapshot.value = {}
}

async function loadProfile() {
  state.isLoading = true
  resetStatusMessages()
  primeFormWithDefaults()

  try {
    await ensureClerkToken()

    const userRecord = await fetchMyUser()
    const hostProfile = asRecord(userRecord.hostProfile)

    hostProfileSnapshot.value = hostProfile

    form.pseudo =
      readString(userRecord.displayName)
      || readString(hostProfile.pseudo)
      || readString(hostProfile.displayName)
      || readString(hostProfile.name)
      || pseudoFallback.value

    form.bio = readBioFromProfile(hostProfile)
  } catch (error) {
    state.loadError = 'Impossible de charger votre profil pour le moment.'
    console.warn('[HostProfileDialog] impossible de charger le profil utilisateur', { error })
  } finally {
    state.isLoading = false
  }
}

async function handleSave() {
  if (!canSubmit.value) return

  state.isSaving = true
  state.saveError = ''
  state.saveSuccess = ''

  try {
    await ensureClerkToken()

    const pseudo = form.pseudo.trim()
    const bio = form.bio.trim()

    const nextHostProfile: Record<string, unknown> = {
      ...hostProfileSnapshot.value,
      pseudo,
      displayName: pseudo,
      name: pseudo,
      bio,
      avatar: avatarUrl.value,
    }

    await updateMyUser({
      displayName: pseudo,
      avatarUrl: avatarUrl.value || undefined,
      hostProfile: nextHostProfile,
    })

    hostProfileSnapshot.value = nextHostProfile
    state.saveSuccess = 'Votre profil est à jour.'
  } catch (error) {
    state.saveError = 'La mise à jour a échoué. Réessayez dans quelques instants.'
    console.warn('[HostProfileDialog] impossible de mettre à jour le profil utilisateur', { error })
  } finally {
    state.isSaving = false
  }
}

function closeDialog() {
  if (state.isSaving) return
  emit('close')
}

function openClerkAccountManagement() {
  clerk.value?.openUserProfile()
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      resetStatusMessages()
      return
    }

    void loadProfile()
  },
)
</script>

<template>
  <AbsoluteOverlay
    class="host-profile-dialog-overlay"
    :open="open"
    aria-label="Mon profil"
    @close="closeDialog"
  >
    <section class="panel">
      <header class="header">
        <div class="title-copy">
          <p class="eyebrow">Profil hôte</p>
          <h2>Mon profil</h2>
        </div>

        <button
          type="button"
          class="close-button"
          aria-label="Fermer la fenêtre"
          @click="closeDialog"
        >
          <X :size="18" />
        </button>
      </header>

      <p class="hint">
        La photo est synchronisée avec Clerk. Utilisez
        <button
          type="button"
          class="inline-action"
          @click="openClerkAccountManagement"
        >
          Mes informations
        </button>
        pour la modifier.
      </p>

      <div class="avatar-row">
        <img
          v-if="avatarUrl"
          class="avatar"
          :src="avatarUrl"
          alt="Photo de profil"
        />
        <span
          v-else
          class="avatar avatar-fallback"
          aria-hidden="true"
        >
          <UserRound :size="24" />
        </span>

        <button
          type="button"
          class="avatar-action"
          @click="openClerkAccountManagement"
        >
          Modifier la photo
        </button>
      </div>

      <form
        class="form"
        @submit.prevent="handleSave"
      >
        <label class="field">
          <span class="field-label">Pseudo</span>
          <input
            v-model="form.pseudo"
            type="text"
            maxlength="120"
            placeholder="Votre pseudo"
            autocomplete="nickname"
          />
        </label>

        <label class="field bio-field">
          <span class="field-label">Bio</span>
          <textarea
            v-model="form.bio"
            rows="4"
            maxlength="1000"
            placeholder="Décrivez-vous en quelques lignes"
          />
        </label>

        <p
          v-if="pseudoTooShort"
          class="status is-error"
        >
          Le pseudo doit contenir au moins 2 caractères.
        </p>

        <p
          v-if="state.loadError"
          class="status is-error"
        >
          {{ state.loadError }}
        </p>

        <p
          v-if="state.saveError"
          class="status is-error"
        >
          {{ state.saveError }}
        </p>

        <p
          v-if="state.saveSuccess"
          class="status is-success"
        >
          {{ state.saveSuccess }}
        </p>

        <footer class="actions">
          <button
            type="button"
            class="ghost-button"
            :disabled="state.isSaving"
            @click="closeDialog"
          >
            Annuler
          </button>

          <button
            type="submit"
            class="save-button"
            :disabled="!canSubmit"
          >
            {{ state.isSaving ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </footer>
      </form>

      <HostSubscriptionSettings :active="open" />
    </section>
  </AbsoluteOverlay>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/buttons' as buttons;
@use '@/styles/components/inputs' as inputs;
@use '@/styles/components/overlays' as overlays;

.host-profile-dialog-overlay {
  > .panel {
    @extend %overlay-panel;
    gap: var(--layout-gap);
    max-width: min(680px, 100%);
    padding-bottom: calc(var(--layout-gap-4xl) + var(--safe-area-bottom));
    overflow-y: auto;
    overscroll-behavior: contain;

    > .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--layout-gap-sm);

      > .title-copy {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;

        > .eyebrow {
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: rgba($secondary, 0.62);
          @include little-text($thin: false);
        }

        > h2 {
          margin: 0;
          @include h2-title;
        }
      }

      > .close-button {
        @include buttons.secondary;
        width: 2.1rem;
        min-width: 2.1rem;
        height: 2.1rem;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;

        @media (pointer: coarse) {
          width: 44px;
          min-width: 44px;
          height: 44px;
        }
      }
    }

    > .hint {
      margin: 0;
      color: rgba($secondary-text, 0.72);
      @include base-text($thin: false);

      > .inline-action {
        border: 0;
        padding: 0;
        background: none;
        color: $secondary;
        text-decoration: underline;
        text-underline-offset: 0.15em;
        cursor: pointer;
      }
    }

    > .avatar-row {
      display: flex;
      align-items: center;
      gap: var(--layout-gap-sm);

      > .avatar {
        width: 3.25rem;
        height: 3.25rem;
        border-radius: 999px;
        object-fit: cover;
        border: 1px solid rgba($secondary, 0.2);
      }

      > .avatar-fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba($secondary, 0.08);
        color: rgba($secondary, 0.75);
      }

      > .avatar-action {
        @include buttons.secondary;
      }
    }

    > .form {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-sm);

      > .field {
        display: flex;
        flex-direction: column;
        gap: 0.42rem;

        > .field-label {
          @include little-text($thin: false);
        }

        @include inputs.field($theme: accent, $compact: true);
      }

      > .bio-field {
        @include inputs.textarea($theme: accent, $compact: true);
      }

      > .status {
        margin: 0;
        @include little-text($thin: false);

        &.is-error {
          color: $bad-ink;
        }

        &.is-success {
          color: rgba($good, 0.95);
        }
      }

      > .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--layout-gap-xs);
        padding-top: 0.4rem;

        > .ghost-button {
          @include buttons.secondary;
        }

        > .save-button {
          @include buttons.primary(true);
        }
      }
    }
  }
}
</style>
