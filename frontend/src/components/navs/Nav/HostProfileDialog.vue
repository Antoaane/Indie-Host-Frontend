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

// Erreur affichée une fois le champ quitté ou l'envoi tenté, pas dès l'ouverture.
const pseudoTouched = ref(false)
const showPseudoError = computed(() => pseudoTouched.value && !state.isLoading && pseudoTooShort.value)

const canSubmit = computed(() => !state.isSaving && !state.isLoading)

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
  pseudoTouched.value = true
  if (pseudoTooShort.value) return

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

    pseudoTouched.value = false
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
          <h2>Mon profil</h2>
          <p class="subtitle">Votre pseudo et votre bio apparaissent sur vos annonces.</p>
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

        <div class="avatar-copy">
          <p class="hint">La photo vient de votre compte, dans Mes informations.</p>
          <div class="avatar-action">
            <button
              type="button"
              @click="openClerkAccountManagement"
            >
              Modifier la photo
            </button>
          </div>
        </div>
      </div>

      <form
        class="form"
        novalidate
        @submit.prevent="handleSave"
      >
        <label class="field">
          <span class="field-label">Pseudo</span>
          <span
            class="control"
            :class="{ 'is-invalid': showPseudoError }"
          >
            <input
              v-model="form.pseudo"
              type="text"
              maxlength="120"
              placeholder="Votre pseudo"
              autocomplete="nickname"
              :aria-invalid="showPseudoError"
              :aria-describedby="showPseudoError ? 'host-profile-pseudo-error' : undefined"
              @blur="pseudoTouched = true"
            />
          </span>
        </label>

        <label class="field">
          <span class="field-label">Bio</span>
          <span class="control is-textarea">
            <textarea
              v-model="form.bio"
              rows="4"
              maxlength="1000"
              placeholder="Décrivez-vous en quelques lignes"
            />
          </span>
        </label>

        <p
          v-if="showPseudoError"
          id="host-profile-pseudo-error"
          class="status is-error"
          role="alert"
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
          <div class="cancel">
            <button
              type="button"
              :disabled="state.isSaving"
              @click="closeDialog"
            >
              Annuler
            </button>
          </div>

          <div class="save">
            <button
              type="submit"
              :disabled="!canSubmit"
            >
              {{ state.isSaving ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
          </div>
        </footer>
      </form>

      <HostSubscriptionSettings :active="open" />
    </section>
  </AbsoluteOverlay>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
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
        gap: var(--layout-gap-xs);

        > h2 {
          margin: 0;
          @include h2-title;
        }

        > .subtitle {
          margin: 0;
          @include base-text(rgba($secondary-text, 0.72), $thin: false);
        }
      }

      > .close-button {
        flex-shrink: 0;
        width: 2.25rem;
        height: 2.25rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: none;
        border-radius: borders.$rounded;
        background: rgba($secondary, 0.06);
        color: $secondary;
        cursor: pointer;
        touch-action: manipulation;
        @include animations.transition(animations.$duration-fast);
        @include animations.press(0.94);

        @include on-hover {
          background: rgba($secondary, 0.12);
        }

        &:focus-visible {
          outline: 2px solid rgba($secondary, 0.4);
          outline-offset: 2px;
        }

        @media (pointer: coarse) {
          width: 44px;
          height: 44px;
        }
      }
    }

    > .avatar-row {
      display: flex;
      align-items: center;
      gap: var(--layout-gap-sm);
      padding: var(--layout-gap-sm);
      border-radius: borders.$rounded-md;
      background: $accent-surface-1;

      > .avatar {
        flex-shrink: 0;
        width: 3.25rem;
        height: 3.25rem;
        border-radius: borders.$rounded;
        object-fit: cover;
        border: 1px solid rgba($secondary, 0.12);
      }

      > .avatar-fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba($secondary, 0.08);
        color: rgba($secondary, 0.75);
      }

      > .avatar-copy {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--layout-gap-xs);
        min-width: 0;

        > .hint {
          margin: 0;
          @include little-text(rgba($secondary-text, 0.72), $thin: false);
        }

        > .avatar-action {
          @include buttons.primary($theme: white, $little: true);
        }
      }
    }

    > .form {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-sm);

      > .field {
        display: flex;
        flex-direction: column;
        gap: var(--layout-gap-xs);

        > .field-label {
          @include little-text($secondary, $bold: true);
        }

        > .control:not(.is-textarea) {
          @include inputs.field($theme: accent, $compact: true);
        }

        > .control.is-textarea {
          @include inputs.textarea($theme: accent, $compact: true);
        }

        > .control.is-invalid {
          border-color: rgba($bad-ink, 0.5);
        }
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
        justify-content: flex-end;
        gap: var(--layout-gap-sm);
        padding-top: var(--layout-gap-xs);

        > .cancel {
          @include buttons.primary($theme: white);
        }

        > .save {
          @include buttons.primary($theme: black);
        }
      }
    }
  }
}
</style>
