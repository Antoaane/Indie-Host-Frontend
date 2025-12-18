<!-- File: src/views/ListingView/components/ListingComments/components/SummaryCard/SummaryCard.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'

// UTILS
import { vp } from '@/utils/viewport'
import { formatRatingValue } from '@/views/ListingView/utils/formatters'

// ASSETS
import { Star } from 'lucide-vue-next'

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

// console.log(`${props.score !== null ? '✅' : '❌'} [SummaryCard.vue](setup) summary:score input=${props.score}`)
// console.log(`${hasScore.value ? '✅' : '❌'} [SummaryCard.vue](hasScore) summary:hasScore value=${hasScore.value}`)
// console.log(`${'ℹ️'} [SummaryCard.vue](scoreLabel) summary:scoreLabel formatted=${scoreLabel.value}`)
</script>

<template>
  <section class="summary-card">
    <!-- <h3>{{ overallLabel }}</h3> -->
    <div>
      <h3 v-html="scoreLabel"></h3>

      <Star :size="24" />
      <svg
        width="0"
        height="0"
        style="position: absolute"
      >
        <defs>
          <linearGradient
            id="star-gradient"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop
              offset="0%"
              stop-opacity="1"
              stop-color="#111117"
            />
            <stop
              offset="100%"
              stop-opacity="0.65"
              stop-color="#111117"
            />
          </linearGradient>
        </defs>
      </svg>
    </div>
    <strong
      v-if="vp.lg.value"
      v-html="countLabel"
    ></strong>
  </section>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/ListingComments/components/SummaryCard/summary-card.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.summary-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);

  > strong {
    margin-bottom: 0 !important;
    @include h3-title($colorful: false);
  }

  > div {
    display: flex;
    gap: var(--spacing-2xs);

    > h3 {
      margin: 0 !important;

      font-family: 'Fustat', sans-serif;
      font-weight: 700;
      font-size: 28px;
      line-height: 28px;

      background: -webkit-linear-gradient(top, rgba($secondary_text_gradiant_first, 1) 0%, rgba($secondary_text_gradiant_second, 0.75) 100%);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      color: transparent;

      @include min-width(lg) {
        font-size: 32px;
        line-height: 30px;
      }
    }

    .lucide-star-icon {
      fill: url(#star-gradient);
      // stroke: url(#star-gradient);
      stroke: transparent;

      // background: linear-gradient(top, rgba($secondary_text_gradiant_first, 1) 0%, rgba($secondary_text_gradiant_second, 0.75) 100%);
      // stroke: linear-gradient(top, rgba($secondary_text_gradiant_first, 1) 0%, rgba($secondary_text_gradiant_second, 0.75) 100%);
      // background-clip: content-box;
    }
  }
}

</style>
