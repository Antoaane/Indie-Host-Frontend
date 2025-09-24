<!-- File: src/views/Crowdfunding/components/DonationFormPanel/DonationFormPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { ItemSection } from '@/content/types'

const props = defineProps<{
  donationLink: string
  section: ItemSection
}>()

const items = computed(() => props.section.items ?? {})

const title = computed(() => items.value['title-1']?.content ?? 'Contribuer maintenant')
const intro = computed(() => items.value['intro-1']?.content ?? '')

const steps = computed(() => {
  const block = items.value['steps']
  const meta = block?.meta

  if (meta && Array.isArray(meta.items)) {
    return meta.items as string[]
  }

  return []
})

const ctaLabel = computed(() => items.value['cta-1']?.content ?? 'Soutenir IndieHost')
const securityNote = computed(() => items.value['note-security']?.content ?? '')
const missingLinkWarning = computed(
  () =>
    items.value['warning-missing-link']?.content ??
    'Lien de contribution manquant. Definissez <code>VITE_DONATION_LINK</code> dans votre environnement.'
)

const isLinkAvailable = computed(() => props.donationLink.length > 0)

const handleRedirect = () => {
  if (!isLinkAvailable.value) {
    console.warn('[Donation] VITE_DONATION_LINK is not defined.')
    return
  }

  if (typeof window !== 'undefined') {
    window.location.href = props.donationLink
  }
}
</script>

<template>
  <aside
    class="donation-form"
    aria-labelledby="donation-form-title"
  >
    <h2
      id="donation-form-title"
      class="donation-form__title"
      v-html="title"
    />

    <p
      v-if="intro"
      class="donation-form__intro"
      v-html="intro"
    />

    <ol
      v-if="steps.length"
      class="donation-form__steps"
    >
      <li
        v-for="(step, index) in steps"
        :key="index"
        v-html="step"
      />
    </ol>

    <div class="donation-form__actions">
      <button
        type="button"
        :disabled="!isLinkAvailable"
        @click="handleRedirect"
      >
        {{ ctaLabel }}
      </button>
    </div>

    <p
      v-if="securityNote"
      class="donation-form__security"
      v-html="securityNote"
    />

    <p
      v-if="!isLinkAvailable"
      class="donation-form__env-warn"
      v-html="missingLinkWarning"
    />
  </aside>
</template>

<style lang="scss" scoped src="@/views/Crowdfunding/components/DonationFormPanel/DonationFormPanel.scss"></style>
