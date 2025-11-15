<!-- File: src/views/ListingView/components/ListintComments/components/SummaryCard/SummaryCard.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { formatRatingValue } from '@/views/ListingView/utils/formatters'

const props = defineProps<{
  score: number | null
  ratingUnit: string
  overallLabel: string
  countLabel: string
}>()

const hasScore = computed(() => typeof props.score === 'number' && !Number.isNaN(props.score))

const scoreLabel = computed(() =>
  formatRatingValue(hasScore.value ? props.score : null, 'fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
)
</script>

<template>
  <section class="listint-comments__summary">
    <h3>{{ overallLabel }}</h3>
    <div>
      <strong>{{ scoreLabel }}</strong>
      <span>{{ ratingUnit }}</span>
    </div>
    <p>{{ countLabel }}</p>
  </section>
</template>
