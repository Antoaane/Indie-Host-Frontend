<!-- File: src/views/Landing/components/JoinSection/components/FormComp/FormComp.vue -->

<script setup lang="ts">
import { resolveTextMaxLength } from '@/utils/inputValidation'

// Types minimes pour typer les props
type FieldDef = {
  type: string
  name: string
  placeholder?: string
  required?: boolean
}

type CheckboxOption = { label: string; value: string }

type CheckboxGroup = {
  type: 'checkbox-group'
  name: string
  legend?: string
  options: CheckboxOption[]
}

type ConsentDef = {
  type: 'checkbox'
  name: string
  label: string
  required?: boolean
}

type SubmitDef = {
  label: string
  icon?: string
}

type FieldValidation = {
  minLength?: number
  maxLength?: number
  autocomplete?: string
  inputMode?: 'text' | 'email' | 'tel' | 'numeric'
  pattern?: string
  patternTitle?: string
}

type FormValidation = {
  defaults?: {
    simpleText?: {
      maxLength?: number
      hideIndicatorAt?: number
    }
  }
  fields?: {
    text?: FieldValidation
    email?: FieldValidation
    tel?: FieldValidation
    zip?: FieldValidation
  }
  nameAutocomplete?: {
    first?: string
    last?: string
    name?: string
    default?: string
  }
}

type NewsletterFormData = {
  fields?: FieldDef[]
  groups?: CheckboxGroup[]
  consents?: ConsentDef[]
  validation?: FormValidation
  submit?: SubmitDef
}

const props = defineProps<{ data: NewsletterFormData }>()

// Icône utilisée dans le bouton (inchangée)
import { SendIcon } from 'lucide-vue-next'
const iconMap: Record<string, any> = { SendIcon }

function normalizedFieldType(field: FieldDef): string {
  const type = String(field.type || 'text').toLowerCase()
  if (type === 'email' || type === 'tel' || type === 'text') return type
  return 'text'
}

function fieldName(field: FieldDef): string {
  return String(field.name || '').toLowerCase()
}

function isZipField(field: FieldDef): boolean {
  const name = fieldName(field)
  return name.includes('zip') || name.includes('postal') || name.includes('code_postal') || name === 'cp'
}

function resolveFieldValidation(field: FieldDef): FieldValidation {
  const byType = props.data.validation?.fields
  if (isZipField(field)) return byType?.zip ?? {}

  const type = normalizedFieldType(field)
  if (type === 'email') return byType?.email ?? {}
  if (type === 'tel') return byType?.tel ?? {}
  return byType?.text ?? {}
}

function resolveAutocomplete(field: FieldDef): string {
  const byName = props.data.validation?.nameAutocomplete
  const fieldValidation = resolveFieldValidation(field)
  if (fieldValidation.autocomplete) return fieldValidation.autocomplete

  const name = fieldName(field)
  if (name.includes('first')) return byName?.first ?? byName?.default ?? 'off'
  if (name.includes('last')) return byName?.last ?? byName?.default ?? 'off'
  if (name.includes('name')) return byName?.name ?? byName?.default ?? 'off'
  return byName?.default ?? 'off'
}

function resolveInputMode(field: FieldDef): 'email' | 'tel' | 'numeric' | 'text' {
  const configured = resolveFieldValidation(field).inputMode
  if (configured === 'email' || configured === 'tel' || configured === 'numeric' || configured === 'text') {
    return configured
  }
  return 'text'
}

function resolveMaxLength(field: FieldDef): number | undefined {
  return resolveTextMaxLength(
    resolveFieldValidation(field).maxLength,
    props.data.validation?.defaults?.simpleText,
  )
}

function resolveMinLength(field: FieldDef): number | undefined {
  return resolveFieldValidation(field).minLength
}

function resolvePattern(field: FieldDef): string | undefined {
  return resolveFieldValidation(field).pattern
}

function resolvePatternTitle(field: FieldDef): string | undefined {
  return resolveFieldValidation(field).patternTitle
}
</script>

<template>
  <!-- ✅ Post direct vers Formspree -->
  <form
    action="https://formspree.io/f/meorqbyk"
    method="POST"
  >
    <!-- Champs simples -->
    <div
      v-for="f in data.fields"
      :key="f.name"
      class="input"
    >
      <input
        :type="normalizedFieldType(f)"
        :name="f.name"
        :placeholder="f.placeholder"
        :required="f.required"
        :autocomplete="resolveAutocomplete(f)"
        :inputmode="resolveInputMode(f)"
        :maxlength="resolveMaxLength(f)"
        :minlength="resolveMinLength(f)"
        :pattern="resolvePattern(f)"
        :title="resolvePatternTitle(f)"
        :spellcheck="normalizedFieldType(f) === 'text' && !isZipField(f)"
      />
    </div>

    <!-- Groupes de checkbox (mêmes name pour collecter plusieurs valeurs) -->
    <fieldset
      v-for="g in data.groups"
      :key="g.name"
    >
      <legend>{{ g.legend }}</legend>
      <div class="checkboxes-container">
        <label
          v-for="opt in g.options"
          :key="opt.value"
        >
          <input
            type="checkbox"
            :name="g.name"
            :value="opt.value"
          />
          {{ opt.label }}
        </label>
      </div>
    </fieldset>

    <!-- Consentements (avec name pour que la valeur parte bien) -->
    <label
      v-for="c in data.consents"
      :key="c.name"
      class="checkbox"
    >
      <input
        type="checkbox"
        :name="c.name"
        value="true"
        :required="c.required"
      />
      <span v-html="c.label" />
    </label>

    <!-- Honeypot anti-spam (champ caché, non requis, pas d'autocomplete) -->
    <div
      class="hp-field"
      aria-hidden="true"
    >
      <label for="company">Company</label>
      <input
        id="company"
        type="text"
        name="company"
        tabindex="-1"
        autocomplete="off"
      />
    </div>

    <!-- hCaptcha (ajoute une div avec le widget) -->
    <div
      class="h-captcha"
      data-sitekey="79626bfc-0578-469c-bde4-93a4051cb48c"
      data-theme="light"
      data-size="normal"
      data-error-callback="onHcaptchaError"
    ></div>

    <!-- Bouton submit (style conservé) -->
    <div class="submit-btn">
      <button type="submit">
        <span>{{ data.submit?.label || 'Envoyer' }}</span>
        <component
          v-if="data.submit?.icon && iconMap[data.submit.icon]"
          :is="iconMap[data.submit.icon]"
          class="send-icon"
          :size="20"
        />
      </button>
    </div>
  </form>
</template>

<style lang="scss">
@use '@/views/Landing/components/JoinSection/components/FormComp/form-comp.scss';

.hp-field {
  position: absolute !important;
  left: -9999px;
  height: 0;
  width: 0;
  overflow: hidden;
}
</style>
