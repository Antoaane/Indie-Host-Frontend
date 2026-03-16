<!-- File: src/views/Landing/components/FinalCtaSection/FinalCtaSection.vue -->

<script setup lang="ts">
import type { FinalCtaSectionContent } from '@/views/Landing/types/content'

const props = defineProps<{
  content: FinalCtaSectionContent
}>()

function handleCtaClick(href: string) {
  if (!href.startsWith('#')) {
    window.location.assign(href)
    return
  }

  const target = document.querySelector<HTMLElement>(href)
  if (!target) return
  target.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <section id="final-cta-section">
    <div
      class="wrapper"
      data-sr
      data-sr-y="30"
    >
      <p class="eyebrow">{{ props.content.eyebrow }}</p>
      <h2 v-html="props.content.title" />
      <p class="body">{{ props.content.body }}</p>

      <div class="actions">
        <div class="cta-primary">
          <button
            type="button"
            @click="handleCtaClick(props.content.primaryCta.href)"
          >
            <span v-html="props.content.primaryCta.label" />
          </button>
        </div>
        <div class="cta-secondary">
          <button
            type="button"
            @click="handleCtaClick(props.content.secondaryCta.href)"
          >
            <span v-html="props.content.secondaryCta.label" />
          </button>
        </div>
      </div>

      <p
        v-if="props.content.note"
        class="note"
      >
        {{ props.content.note }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/FinalCtaSection/final-cta-section.scss';
</style>
