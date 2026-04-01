<!-- File: src/views/ListingView/components/Comments/components/SummaryCard/SummaryCard.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'

// UTILS
import { formatRatingValue } from '@/views/ListingView/utils/formatters'
import { useListingViewport } from '@/views/ListingView/composables/useListingViewport'

// ASSETS
import { Star } from 'lucide-vue-next'
import AirbnbLogo from '@/components/svgs/icons/AirbnbLogo.vue'
import BookingLogo from '@/components/svgs/icons/BookingLogo.vue'

type ImportedScoreItem = {
  ota: string
  note: number
  sourceLabel?: string
}

const props = withDefaults(
  defineProps<{
    score: number | null
    ratingUnit: string
    overallLabel: string
    countLabel: string
    importedScores?: ImportedScoreItem[]
    showStars?: boolean
  }>(),
  {
    importedScores: () => [],
  },
)

const { isLg } = useListingViewport()

const hasScore = computed(() => typeof props.score === 'number' && !Number.isNaN(props.score))

const scoreLabel = computed(() =>
  formatRatingValue(hasScore.value ? props.score : null, 'fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
)

const importedScoreCards = computed(() => (
  (props.importedScores ?? [])
    .filter((score) => typeof score.note === 'number' && Number.isFinite(score.note))
    .map((score) => {
      const ota = (score.ota ?? '').toLowerCase()
      const icon = ota === 'airbnb' ? AirbnbLogo : ota === 'booking' ? BookingLogo : null
      const sourceLabel =
        (typeof score.sourceLabel === 'string' && score.sourceLabel.trim())
        || (ota === 'airbnb' ? 'Airbnb' : ota === 'booking' ? 'Booking.com' : score.ota || 'OTA')

      return {
        key: `${ota || sourceLabel}-${score.note}`,
        icon,
        sourceLabel,
        scoreLabel: formatRatingValue(score.note, 'fr-FR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      }
    })
))

// console.log(`${props.score !== null ? '✅' : '❌'} [SummaryCard.vue](setup) summary:score input=${props.score}`)
// console.log(`${hasScore.value ? '✅' : '❌'} [SummaryCard.vue](hasScore) summary:hasScore value=${hasScore.value}`)
// console.log(`${'ℹ️'} [SummaryCard.vue](scoreLabel) summary:scoreLabel formatted=${scoreLabel.value}`)
</script>

<template>
  <section class="summary-card">
    <!-- <h3>{{ overallLabel }}</h3> -->
    <div class="summary-main">
      <h3 v-html="scoreLabel"></h3>

      <Star
        v-if="props.showStars !== false"
        :size="24"
      />
      <svg
        v-if="props.showStars !== false"
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
      v-if="isLg"
      v-html="countLabel"
    ></strong>

    <div
      v-if="importedScoreCards.length"
      class="imported-scores"
    >
      <article
        v-for="score in importedScoreCards"
        :key="score.key"
        class="imported-score"
      >
        <component
          :is="score.icon || 'span'"
          class="score-source"
        >
          <template v-if="!score.icon">
            {{ score.sourceLabel }}
          </template>
        </component>
        <span
          class="score-value"
          v-html="score.scoreLabel"
        ></span>
        <Star :size="16" />
      </article>
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/ListingView/components/Comments/components/SummaryCard/summary-card.scss */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.summary-card {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--layout-gap-md);

  > strong {
    margin-bottom: 0 !important;
    @include h3-title($colorful: false);
  }

  > .summary-main {
    display: flex;
    align-items: center;
    gap: var(--layout-gap-2xs);

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
      stroke: transparent;
    }
  }

  > .imported-scores {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: var(--layout-gap-sm);

    > .imported-score {
      display: inline-flex;
      align-items: center;
      gap: var(--layout-gap-xs);
      padding: 0.45rem 0.75rem;
      border: 1px solid rgba($secondary, 0.12);
      border-radius: borders.$rounded-md;
      background: rgba($accent, 0.92);

      > .score-source {
        width: 1.5rem;
        height: 1.5rem;
        flex: 0 0 1.5rem;
      }

      > span.score-source {
        width: auto;
        height: auto;
        max-width: 6.5rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        @include little-text($thin: false);
        color: rgba($secondary, 0.82);
      }

      > .score-value {
        margin: 0 !important;

        font-family: 'Fustat', sans-serif;
        font-weight: 600;
        font-size: 1.65rem;
        line-height: 1;
        color: rgba($secondary, 0.95);
      }

      > .lucide-star-icon {
        fill: rgba($secondary, 0.9);
        stroke: transparent;
      }
    }
  }
}
</style>
