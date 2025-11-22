<!-- File: src/views/ListingView/components/ListingComments/components/SummaryCard/SummaryCard.vue -->

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

console.log(`${props.score !== null ? '✅' : '❌'} [SummaryCard.vue](setup) summary:score input=${props.score}`)
console.log(`${hasScore.value ? '✅' : '❌'} [SummaryCard.vue](hasScore) summary:hasScore value=${hasScore.value}`)
console.log(`${'ℹ️'} [SummaryCard.vue](scoreLabel) summary:scoreLabel formatted=${scoreLabel.value}`)
</script>

<template>
  <section class="listing-comments__summary">
    <h3>{{ overallLabel }}</h3>
    <div>
      <strong>{{ scoreLabel }}</strong>
      <span>{{ ratingUnit }}</span>
    </div>
    <p>{{ countLabel }}</p>
  </section>
</template>
