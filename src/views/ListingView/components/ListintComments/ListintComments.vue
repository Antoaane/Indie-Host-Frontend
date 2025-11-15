<!-- File: src/views/ListingView/components/ListintComments/ListintComments.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'

// UTILS
import { listingCore } from '@/views/ListingView/utils/useParseContent'
import { formatICUMessage } from '@/utils/i18n'
import {
  buildDistributionFromComments,
  computePercentage,
} from '@/views/ListingView/utils/formatters'

// TYPES
import type {
  CommentsModel,
  NotesModel,
} from '@/views/ListingView/types/listing'

// CONTENT
import staticLocale from '@/locales/_static/fr.json'

// COMPONENTS
import SummaryCard from './components/SummaryCard/SummaryCard.vue'
import DistributionList from './components/DistributionList/DistributionList.vue'
import CommentCard from './components/CommentCard/CommentCard.vue'

interface CommentsWidgetStaticContent {
  title: string
  ctaLabel: string
  summary: {
    overallLabel: string
    ratingUnit: string
    countLabel: string
  }
  distribution: {
    title: string
    ratingLabel: string
  }
  comment: {
    stayLabel: string
  }
  preview: {
    maxItems: number
  }
  empty: {
    title: string
    subtitle?: string
  }
}

interface StaticContentRoot {
  listing: {
    commentsWidget: CommentsWidgetStaticContent
  }
}

const content = (staticLocale as StaticContentRoot).listing.commentsWidget

const data = await listingCore()

const previewLimit = content.preview?.maxItems ?? 3

const comments = computed(() => data.comments ?? [])
const commentsCount = computed(() => comments.value.length)

const countLabel = computed(() =>
  formatICUMessage(content.summary.countLabel, { count: commentsCount.value }),
)

const overallScore = computed(() => {
  const overall = data.notes?.overall
  if (typeof overall === 'number' && !Number.isNaN(overall)) {
    return overall
  }

  if (!commentsCount.value) {
    return null
  }

  const sum = comments.value.reduce((acc, comment) => acc + comment.note, 0)
  return commentsCount.value ? sum / commentsCount.value : null
})

function resolveDistribution(notes: NotesModel | undefined, list: CommentsModel) {
  const source = notes?.distribution
  const base = source && Object.keys(source).length ? source : buildDistributionFromComments(list)

  const entries = Object.entries(base)
    .map(([ratingKey, count]) => ({ rating: Number(ratingKey), count }))
    .filter(entry => Number.isFinite(entry.rating) && Number.isFinite(entry.count))
    .sort((a, b) => b.rating - a.rating)

  const total = entries.reduce((acc, entry) => acc + entry.count, 0)

  return {
    total,
    entries: entries.map(entry => ({
      ...entry,
      percentage: computePercentage(entry.count, total),
    })),
  }
}

const distribution = computed(() => resolveDistribution(data.notes, comments.value))

const previewComments = computed(() => comments.value.slice(0, previewLimit))

const hasData = computed(
  () =>
    typeof overallScore.value === 'number' ||
    commentsCount.value > 0 ||
    distribution.value.entries.length > 0,
)
</script>

<template>
  <section id="listint-comments">
    <header>
      <div>
        <h2>{{ content.title }}</h2>
        <p v-if="commentsCount">{{ countLabel }}</p>
      </div>
      <button type="button" :disabled="!commentsCount">{{ content.ctaLabel }}</button>
    </header>

    <SummaryCard
      v-if="hasData"
      :score="overallScore"
      :rating-unit="content.summary.ratingUnit"
      :overall-label="content.summary.overallLabel"
      :count-label="countLabel"
    />

    <DistributionList
      v-if="distribution.entries.length"
      :entries="distribution.entries"
      :title="content.distribution.title"
      :rating-label="content.distribution.ratingLabel"
    />

    <div v-if="previewComments.length" class="listint-comments__list">
      <CommentCard
        v-for="comment in previewComments"
        :key="`${comment.name}-${comment.comment}`"
        :comment="comment"
        :stay-template="content.comment.stayLabel"
        :rating-unit="content.summary.ratingUnit"
      />
    </div>

    <div v-else class="listint-comments__empty">
      <h3>{{ content.empty.title }}</h3>
      <p v-if="content.empty.subtitle">{{ content.empty.subtitle }}</p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListintComments/listint-comments.scss';
</style>
