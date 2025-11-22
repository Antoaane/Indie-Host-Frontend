<!-- File: src/views/ListingView/components/ListingComments/ListingComments.vue -->

<script setup lang="ts">
// DEPS
import {
  computed,
  nextTick,
  onMounted,
  ref,
} from 'vue'

// UTILS
import { listingCore } from '@/views/ListingView/utils/useParseContent'
import { formatICUMessage } from '@/utils/i18n'
import { buildDistributionFromComments, computePercentage } from '@/views/ListingView/utils/formatters'

// TYPES
import type { CommentsModel, NotesModel } from '@/views/ListingView/types/listing'

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
console.log(`${data?.comments?.length ? '✅' : '❌'} [ListingComments.vue](setup) listingCore:resolved commentsCount=${data.comments?.length ?? 0} fetched`)
console.log(`${'ℹ️'} [ListingComments.vue](setup) contentLoaded=commentsWidget ready for render`)

const previewLimit = content.preview?.maxItems ?? 3

const overlayStep = 10
const isOverlayOpen = ref(false)
const overlayLimit = ref(overlayStep)
const overlayScrollEl = ref<HTMLElement | null>(null)

const comments = computed(() => {
  const value = data.comments ?? []
  console.log(`${value.length ? '✅' : '❌'} [ListingComments.vue](comments) comments:computed listLength=${value.length} prepared`)
  return value
})
const commentsCount = computed(() => {
  const count = comments.value.length
  console.log(`${count ? '✅' : '❌'} [ListingComments.vue](commentsCount) commentsCount:computed total=${count} ready`)
  return count
})

const countLabel = computed(() => {
  const label = formatICUMessage(content.summary.countLabel, { count: commentsCount.value })
  console.log(`${'ℹ️'} [ListingComments.vue](countLabel) countLabel:computed formatted=${label} applied`)
  return label
})

const overallScore = computed(() => {
  const overall = data.notes?.overall
  if (typeof overall === 'number' && !Number.isNaN(overall)) {
    console.log(`${'✅'} [ListingComments.vue](overallScore) overallScore:computed fromNotes=${overall} reused`)
    return overall
  }

  if (!commentsCount.value) {
    console.log(`${'❌'} [ListingComments.vue](overallScore) overallScore:computed unavailable=null noComments`)
    return null
  }

  const sum = comments.value.reduce((acc, comment) => acc + comment.note, 0)
  const value = commentsCount.value ? sum / commentsCount.value : null
  console.log(`${typeof value === 'number' ? '✅' : '❌'} [ListingComments.vue](overallScore) overallScore:computed averaged=${value} calculated`)
  return value
})

function resolveDistribution(notes: NotesModel | undefined, list: CommentsModel) {
  const source = notes?.distribution
  const base = source && Object.keys(source).length ? source : buildDistributionFromComments(list)

  const entries = Object.entries(base)
    .map(
      ([
        ratingKey,
        count,
      ]) => ({ rating: Number(ratingKey), count }),
    )
    .filter((entry) => Number.isFinite(entry.rating) && Number.isFinite(entry.count))
    .sort((a, b) => b.rating - a.rating)

  const total = entries.reduce((acc, entry) => acc + entry.count, 0)

  const resolved = {
    total,
    entries: entries.map((entry) => ({
      ...entry,
      percentage: computePercentage(entry.count, total),
    })),
  }

  console.log(`${resolved.entries.length ? '✅' : '❌'} [ListingComments.vue](resolveDistribution) distribution:resolved totalEntries=${resolved.total} compiled`)
  console.log(`${'ℹ️'} [ListingComments.vue](resolveDistribution) distribution:sourceNotes used=${Boolean(notes?.distribution)} validated`)

  return resolved
}

const distribution = computed(() => {
  const resolved = resolveDistribution(data.notes, comments.value)
  console.log(`${resolved.entries.length ? '✅' : '❌'} [ListingComments.vue](distribution) distribution:computed totalEntries=${resolved.total} readyForUI`)
  return resolved
})

const previewComments = computed(() => {
  const preview = comments.value.slice(0, previewLimit)
  console.log(`${preview.length ? '✅' : '❌'} [ListingComments.vue](previewComments) preview:computed items=${preview.length} trimmed`)
  return preview
})

const overlayComments = computed(() => {
  const overlayList = comments.value.slice(0, overlayLimit.value)
  console.log(`${overlayList.length ? '✅' : '❌'} [ListingComments.vue](overlayComments) overlay:computed items=${overlayList.length} limit=${overlayLimit.value}`)
  return overlayList
})

const canLoadOverlay = computed(() => overlayComments.value.length < comments.value.length)

function openOverlay() {
  overlayLimit.value = overlayStep
  isOverlayOpen.value = true
  console.log(`${'ℹ️'} [ListingComments.vue](openOverlay) overlay:state open=${isOverlayOpen.value} limit=${overlayLimit.value}`)
  nextTick(() => {
    if (overlayScrollEl.value) {
      overlayScrollEl.value.scrollTop = 0
    }
  })
}

function closeOverlay() {
  isOverlayOpen.value = false
  console.log(`${'ℹ️'} [ListingComments.vue](closeOverlay) overlay:state open=${isOverlayOpen.value}`)
}

function loadMoreOverlay() {
  if (!canLoadOverlay.value) {
    return
  }
  const nextLimit = Math.min(overlayLimit.value + overlayStep, comments.value.length)
  overlayLimit.value = nextLimit
  console.log(`${'ℹ️'} [ListingComments.vue](loadMoreOverlay) overlay:paginate limit=${overlayLimit.value} total=${comments.value.length}`)
}

function handleOverlayScroll(event: Event) {
  const target = overlayScrollEl.value ?? (event.target as HTMLElement | null)
  if (!target) {
    return
  }

  const reachedBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 4
  if (reachedBottom) {
    loadMoreOverlay()
  }
}

const hasData = computed(() => {
  const value = typeof overallScore.value === 'number' || commentsCount.value > 0 || distribution.value.entries.length > 0
  console.log(`${value ? '✅' : '❌'} [ListingComments.vue](hasData) hasData:computed ready=${value} gating`)
  return value
})

onMounted(() => {
  console.log(`${hasData.value ? '✅' : '❌'} [ListingComments.vue](onMounted) comments:mounted hydrated=${hasData.value} DOMMounted`)
})
</script>

<template>
  <section id="listing-comments">
    <div>
      <div>
        <h2>{{ content.title }}</h2>
        <p v-if="commentsCount">{{ countLabel }}</p>
      </div>
      <button
        type="button"
        :disabled="!commentsCount"
        @click="openOverlay"
        >{{ content.ctaLabel }}</button
      >
    </div>

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

    <div
      v-if="previewComments.length"
      class="listing-comments__list"
    >
      <CommentCard
        v-for="comment in previewComments"
        :key="`${comment.name}-${comment.comment}`"
        :comment="comment"
        :stay-template="content.comment.stayLabel"
        :rating-unit="content.summary.ratingUnit"
      />
    </div>

    <div
      v-else
      class="listing-comments__empty"
    >
      <h3>{{ content.empty.title }}</h3>
      <p v-if="content.empty.subtitle">{{ content.empty.subtitle }}</p>
    </div>

    <div
      v-if="isOverlayOpen"
      class="listing-comments__overlay"
      role="dialog"
      aria-modal="true"
      @click.self="closeOverlay"
    >
      <div class="listing-comments__overlay-panel">
        <header class="listing-comments__overlay-header">
          <div>
            <h2>{{ content.title }}</h2>
            <p v-if="commentsCount">{{ countLabel }}</p>
          </div>
          <button
            type="button"
            class="listing-comments__overlay-close"
            @click="closeOverlay"
            >×</button
          >
        </header>

        <div class="listing-comments__overlay-body">
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

          <div
            ref="overlayScrollEl"
            class="listing-comments__overlay-list"
            @scroll="handleOverlayScroll"
          >
            <CommentCard
              v-for="comment in overlayComments"
              :key="`${comment.name}-${comment.comment}`"
              :comment="comment"
              :stay-template="content.comment.stayLabel"
              :rating-unit="content.summary.ratingUnit"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListingComments/listing-comments.scss';
</style>
