<!-- File: src/views/Donation/components/DonationFormPanel/DonationFormPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { DonationPanelContent } from '@/views/Donation/types/content'

const props = defineProps<{
  donationLink: string
  panel: DonationPanelContent
}>()

/**
 * --- TITLE ---
 */
const title = computed(() => props.panel.title || 'Contribuer maintenant')

/**
 * --- INTRO ---
 */
const introBlocks = computed(() => props.panel.intro ?? [])

/**
 * --- STEPS ---
 */
const steps = computed(() => props.panel.steps || [])
const stepsTitle = computed(() => steps.value[0]?.title || '')
const stepsItems = computed(() => steps.value.map((s) => s.body).filter(Boolean))
const stepsOrdered = computed(() => true) // panel.steps est toujours ordonné dans ton JSON

/**
 * --- CTA ---
 */
const primaryCta = computed(() => props.panel.primaryCta.label || 'Soutenir IndieHost')

const isLinkAvailable = computed(() => props.donationLink && props.donationLink.trim().length > 0)

const isCtaDisabled = computed(() => !isLinkAvailable.value)

const handleCtaClick = () => {
  if (!isLinkAvailable.value) {
    console.warn('[Donation] VITE_DONATION_LINK manquant.')
    return
  }
  window.location.href = props.donationLink
}

/**
 * --- NOTES ---
 */
const note = computed(() => props.panel.note)

/**
 * --- WARNINGS ---
 */
const activeWarnings = computed(() =>
  props.panel.warnings.filter((w) => {
    if (!w.condition) return true
    if (w.condition === 'missing-link') return !isLinkAvailable.value
    if (w.condition === 'requires-link') return isLinkAvailable.value
    return true
  }),
)
</script>

<template>
  <aside
    class="donation-form"
    aria-labelledby="donation-form-title"
  >
    <!-- HEADER -->
    <div class="donation-form__header">
      <h2
        id="donation-form-title"
        class="donation-form__title"
        v-html="title"
      />

      <div class="donation-form__intro-group">
        <template
          v-for="(text, i) in introBlocks"
          :key="`intro-${i}`"
        >
          <p
            class="donation-form__intro"
            v-html="text"
          />
        </template>
      </div>
    </div>

    <!-- STEPS -->
    <section
      v-if="stepsItems.length"
      class="donation-form__steps-wrapper"
    >
      <p
        v-if="stepsTitle"
        class="donation-form__steps-title"
        v-html="stepsTitle"
      />
      <component
        :is="stepsOrdered ? 'ol' : 'ul'"
        class="donation-form__steps"
      >
        <li
          v-for="(step, index) in stepsItems"
          :key="`step-${index}`"
          v-html="step"
        />
      </component>
    </section>

    <!-- CTA -->
    <div
      v-if="primaryCta"
      class="donation-form__actions"
      data-has-secondary="false"
    >
      <button
        type="button"
        :disabled="isCtaDisabled"
        @click="handleCtaClick"
      >
        {{ primaryCta }}
      </button>
    </div>

    <!-- NOTE -->
    <p
      v-if="note"
      class="donation-form__security"
      v-html="note"
    />

    <!-- WARNINGS -->
    <template
      v-for="(warning, i) in activeWarnings"
      :key="`warning-${i}`"
    >
      <p
        class="donation-form__env-warn"
        v-html="warning.text"
      />
    </template>
  </aside>
</template>

<style lang="scss" scoped src="@/views/Donation/components/DonationFormPanel/donation-form-panel.scss"></style>
