<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/LegalInfoPanel.vue -->

<script setup lang="ts">
// Mentions légales obligatoires : qualité du loueur (art. L111-7 Code de la consommation,
// stockée dans la section `host`) et numéro d'enregistrement du meublé de tourisme
// (loi Le Meur, `core.tourismRegistrationNumber`). Les deux restent facultatifs à la publication.
import { computed, ref, useId, watch } from 'vue'

import type { HostLegalStatus, RawCore, RawHost } from '@/domain/listings/types'
import type { DraftPatch } from '@/views/Editor/utils/listingApi'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import { saveListingHostLegalInfo, type ListingHostLegalPatch } from '@/domain/api/listingHost'
import { normalizeTextInput } from '@/utils/inputValidation'

const props = defineProps<{
  listingId: string
  core?: Partial<RawCore> | null
  host?: Partial<RawHost> | null
}>()

const emit = defineEmits<{
  (e: 'patch', patch: DraftPatch): void
}>()

const panelContent = editorStatic.panels.listing.legal
const legalValidation = editorStatic.validation.listing.legal

const idPrefix = useId()
const statusHintId = `${idPrefix}-status-hint`
const companyNameId = `${idPrefix}-company-name`
const siretId = `${idPrefix}-siret`
const siretErrorId = `${idPrefix}-siret-error`
const registrationId = `${idPrefix}-registration`
const registrationHintId = `${idPrefix}-registration-hint`

const statusOptions: Array<{ value: HostLegalStatus; title: string; description: string }> = [
  { value: 'individual', ...panelContent.status.options.individual },
  { value: 'professional', ...panelContent.status.options.professional },
]

function readLegalStatus(host: Partial<RawHost> | null | undefined): HostLegalStatus | '' {
  const value = host?.legalStatus
  return value === 'individual' || value === 'professional' ? value : ''
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeSiret(value: string): string {
  return value.replace(/\s+/g, '')
}

// --- Qualité du loueur : section `host`, enregistrée directement (hors brouillon local). ---
const legalStatus = ref<HostLegalStatus | ''>(readLegalStatus(props.host))
const companyName = ref(readText(props.host?.companyName))
const siret = ref(readText(props.host?.siret))
const lastSaved = ref({ companyName: companyName.value, siret: siret.value })
const isSaving = ref(false)
const saveError = ref('')
const hasSaved = ref(false)

watch(() => props.listingId, () => {
  legalStatus.value = readLegalStatus(props.host)
  companyName.value = readText(props.host?.companyName)
  siret.value = readText(props.host?.siret)
  lastSaved.value = { companyName: companyName.value, siret: siret.value }
  saveError.value = ''
  hasSaved.value = false
})

const isProfessional = computed(() => legalStatus.value === 'professional')
const siretError = computed(() => {
  const digits = normalizeSiret(siret.value)
  if (!digits) return ''
  const pattern = new RegExp(`^\\d{${legalValidation.siretLength}}$`)
  return pattern.test(digits) ? '' : legalValidation.messages.siret
})
const feedback = computed(() => {
  if (saveError.value) return saveError.value
  if (isSaving.value) return panelContent.feedback.saving
  if (hasSaved.value) return panelContent.feedback.saved
  return ''
})

async function persistHost(patch: ListingHostLegalPatch) {
  isSaving.value = true
  saveError.value = ''
  hasSaved.value = false
  try {
    await saveListingHostLegalInfo(props.listingId, patch)
    hasSaved.value = true
  } catch (error) {
    saveError.value = error instanceof Error && error.message ? error.message : panelContent.feedback.error
  } finally {
    isSaving.value = false
  }
}

function onLegalStatusChange(value: HostLegalStatus) {
  if (legalStatus.value === value) return
  legalStatus.value = value
  void persistHost({ legalStatus: value })
}

function commitCompanyName() {
  const next = normalizeTextInput(companyName.value, legalValidation.companyNameMax).trim()
  companyName.value = next
  if (next === lastSaved.value.companyName) return
  lastSaved.value.companyName = next
  void persistHost({ companyName: next })
}

function commitSiret() {
  const next = normalizeSiret(siret.value)
  siret.value = next
  if (siretError.value || next === lastSaved.value.siret) return
  lastSaved.value.siret = next
  void persistHost({ siret: next })
}

// --- Numéro d'enregistrement : section `core`, suit le brouillon comme les autres champs. ---
const registrationNumber = computed({
  get: () => readText(props.core?.tourismRegistrationNumber),
  set: (value: string) => {
    const next = normalizeTextInput(value, legalValidation.registrationMax).toUpperCase()
    if (next === readText(props.core?.tourismRegistrationNumber)) return
    emit('patch', { core: { tourismRegistrationNumber: next } })
  },
})
</script>

<template>
  <section class="editor-legal-panel">
    <div class="header">
      <h3>{{ panelContent.title }}</h3>
      <p>{{ panelContent.subtitle }}</p>
    </div>

    <div class="body">
      <fieldset class="status">
        <legend class="label">{{ panelContent.status.label }}</legend>
        <p
          :id="statusHintId"
          class="hint"
        >
          {{ panelContent.status.hint }}
        </p>
        <div class="options">
          <label
            v-for="option in statusOptions"
            :key="option.value"
            class="option"
          >
            <input
              type="radio"
              :name="`${idPrefix}-legal-status`"
              :value="option.value"
              :checked="legalStatus === option.value"
              :aria-describedby="statusHintId"
              @change="onLegalStatusChange(option.value)"
            />
            <span class="text">
              <span class="title">{{ option.title }}</span>
              <span class="desc">{{ option.description }}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <template v-if="isProfessional">
        <div class="field">
          <label
            :for="companyNameId"
            class="label"
          >{{ panelContent.companyName.label }}</label>
          <p class="hint">{{ panelContent.companyName.hint }}</p>
          <div class="input">
            <input
              :id="companyNameId"
              v-model="companyName"
              type="text"
              autocomplete="organization"
              :maxlength="legalValidation.companyNameMax"
              :placeholder="panelContent.companyName.placeholder"
              @blur="commitCompanyName"
              @keydown.enter.prevent="commitCompanyName"
            />
          </div>
        </div>

        <div class="field">
          <label
            :for="siretId"
            class="label"
          >{{ panelContent.siret.label }}</label>
          <p class="hint">{{ panelContent.siret.hint }}</p>
          <div class="input">
            <input
              :id="siretId"
              v-model="siret"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              :maxlength="legalValidation.siretLength + 4"
              :placeholder="panelContent.siret.placeholder"
              :aria-invalid="Boolean(siretError)"
              :aria-describedby="siretError ? siretErrorId : undefined"
              @blur="commitSiret"
              @keydown.enter.prevent="commitSiret"
            />
          </div>
          <p
            v-if="siretError"
            :id="siretErrorId"
            class="meta is-error"
          >
            {{ siretError }}
          </p>
        </div>
      </template>

      <p
        class="feedback"
        :class="{ 'is-error': saveError }"
        aria-live="polite"
      >
        {{ feedback }}
      </p>

      <div class="field">
        <label
          :for="registrationId"
          class="label"
        >{{ panelContent.registration.label }}</label>
        <p
          :id="registrationHintId"
          class="hint"
        >
          {{ panelContent.registration.hint }}
        </p>
        <div class="input">
          <input
            :id="registrationId"
            v-model="registrationNumber"
            type="text"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            :maxlength="legalValidation.registrationMax"
            :placeholder="panelContent.registration.placeholder"
            :aria-describedby="registrationHintId"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/legal-info-panel.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-legal-panel {
  @extend %panel;

  > .header {
    @extend %panel-header;
  }

  > .body {
    @extend %panel-body;

    .label {
      display: block;
      margin: 0 0 var(--layout-gap-xs) 0;
      padding: 0;
      @include little-text($thin: false);
    }

    .hint {
      margin: 0 0 var(--layout-gap-xs) 0;
      @include little-text();
      color: rgba($secondary-text, 0.65);
    }

    > .status {
      margin: 0;
      padding: 0;
      border: 0;
      min-width: 0;

      > .options {
        display: grid;
        gap: var(--layout-gap-xs);

        > .option {
          display: grid;
          grid-template-columns: 20px 1fr;
          align-items: start;
          gap: var(--layout-gap-xs);
          padding: var(--layout-gap-xs);
          border: 1px solid rgba($secondary, 0.08);
          border-radius: borders.$rounded-md;
          cursor: pointer;
          -webkit-user-select: none;
          user-select: none;
          @include animations.transition(animations.$duration-fast, animations.$ease-out, (border-color, background-color));
          @include animations.press(0.99);

          &:has(> input:checked) {
            border-color: rgba($secondary, 0.35);
          }

          &:has(> input:focus-visible) {
            outline: 2px solid $secondary;
            outline-offset: 2px;
          }

          > input {
            margin-top: 4px;
          }

          .title {
            display: block;
            font-weight: 600;
          }

          .desc {
            display: block;
            @include little-text();
            color: rgba($secondary-text, 0.65);
          }
        }
      }
    }

    > .field {
      @extend %panel-field;

      > .input {
        @include inputs.field($theme: base);
      }

      > .meta {
        margin: var(--layout-gap-xs) 0 0;
        @include little-text($thin: false);

        &.is-error {
          color: $bad-ink;
        }
      }
    }

    > .feedback {
      margin: 0;
      min-height: 1.25em;
      @include little-text($thin: false);
      color: rgba($secondary-text, 0.65);

      &.is-error {
        color: $bad-ink;
      }
    }
  }
}
</style>
