<!-- File: src/views/Landing/components/JoinSection/components/FormComp/FormComp.vue -->

<script setup lang="ts">
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

type NewsletterFormData = {
  fields?: FieldDef[]
  groups?: CheckboxGroup[]
  consents?: ConsentDef[]
  submit?: SubmitDef
}

const props = defineProps<{ data: NewsletterFormData }>()

// Icône utilisée dans le bouton (inchangée)
import { SendIcon } from 'lucide-vue-next'
const iconMap: Record<string, any> = { SendIcon }
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
        :type="f.type"
        :name="f.name"
        :placeholder="f.placeholder"
        :required="f.required"
        autocomplete="email"
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
