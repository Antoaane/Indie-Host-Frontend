<!-- File: src/views/Donation/components/DonationFormPanel/DonationFormPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { DonationPanelContent } from '@/views/Donation/types/content'

const props = defineProps<{
  donationLink: string
  panel: DonationPanelContent
}>()

const isLinkAvailable = computed(() => props.donationLink.trim().length > 0)

const warnings = computed(() =>
  (props.panel.warnings ?? []).filter((warning) => {
    if (!warning.condition) return true
    if (warning.condition === 'missing-link') {
      return !isLinkAvailable.value
    }
    if (warning.condition === 'requires-link') {
      return isLinkAvailable.value
    }
    return true
  }),
)
</script>

<template>
  <aside class="donation-form-panel">
    <header>
      <h2 v-html="panel.title" />
      <p
        v-for="(paragraph, idx) in panel.intro"
        :key="`intro-${idx}`"
        v-html="paragraph"
      />
    </header>

    <section
      v-if="panel.steps?.length"
      class="donation-form-panel__steps"
    >
      <ol>
        <li
          v-for="(step, idx) in panel.steps"
          :key="`step-${idx}`"
        >
          <strong v-if="step.title">
            {{ step.title }}
          </strong>
          <p v-if="step.body">
            {{ step.body }}
          </p>
        </li>
      </ol>
    </section>

    <div class="donation-form-panel__cta">
      <a
        class="primary"
        :href="isLinkAvailable ? props.donationLink : undefined"
        :aria-disabled="!isLinkAvailable"
        :class="{ disabled: !isLinkAvailable }"
      >
        {{ panel.primaryCta.label }}
      </a>
    </div>

    <p
      v-if="panel.note"
      class="donation-form-panel__note"
      v-html="panel.note"
    />

    <ul
      v-if="warnings.length"
      class="donation-form-panel__warnings"
    >
      <li
        v-for="warning in warnings"
        :key="warning.id"
        v-html="warning.text"
      />
    </ul>
  </aside>
</template>

<style scoped lang="scss">
@use '@/views/Donation/components/DonationFormPanel/DonationFormPanel.scss';

.donation-form-panel__cta {
  .primary.disabled {
    pointer-events: none;
    opacity: 0.5;
  }
}
</style>
