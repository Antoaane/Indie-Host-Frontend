<!-- File: src/views/ListingView/components/ListintComments/ListintComments.vue -->

<script setup lang="ts">
// DEPS
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

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
  CommentsPagesModel,
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
  ctaCloseLabel: string
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

const comments = computed(() => data.comments ?? [])
const commentsCount = computed(() => comments.value.length)

const commentPages = computed<CommentsPagesModel>(() => data.commentsPages ?? [])

const detailsId = 'listint-comments-details'
const isExpanded = ref(false)
const visiblePages = ref(0)
const listRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)

let observer: IntersectionObserver | null = null
let isLoadingNext = false

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

const visibleComments = computed(() => {
  if (!visiblePages.value) {
    return []
  }

  return commentPages.value.slice(0, visiblePages.value).flat()
})

const canLoadMore = computed(() => visibleComments.value.length < comments.value.length)

function teardownObserver() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  isLoadingNext = false
}

function loadNextPage(): boolean {
  if (!canLoadMore.value) {
    return false
  }

  visiblePages.value = Math.min(visiblePages.value + 1, commentPages.value.length)
  return true
}

function handleIntersections(entries: IntersectionObserverEntry[]) {
  entries.forEach(entry => {
    if (!entry.isIntersecting || isLoadingNext) {
      return
    }

    if (!loadNextPage()) {
      teardownObserver()
      return
    }

    isLoadingNext = true
    nextTick().then(() => {
      isLoadingNext = false
      if (!canLoadMore.value) {
        teardownObserver()
      }
    })
  })
}

async function setupObserver() {
  await nextTick()

  if (!sentinelRef.value) {
    return
  }

  teardownObserver()

  const rootElement = listRef.value
  const hasScrollableRoot =
    !!rootElement && rootElement.scrollHeight > rootElement.clientHeight

  observer = new IntersectionObserver(handleIntersections, {
    root: hasScrollableRoot ? rootElement : null,
    rootMargin: hasScrollableRoot ? '0px 0px 40px 0px' : '0px 0px 120px 0px',
    threshold: 0.1,
  })

  observer.observe(sentinelRef.value)
}

function toggleExpanded() {
  if (!commentsCount.value) {
    return
  }
  isExpanded.value = !isExpanded.value
}

watch(isExpanded, async expanded => {
  if (expanded && commentPages.value.length) {
    visiblePages.value = 1
    await setupObserver()
  } else {
    visiblePages.value = 0
    teardownObserver()
  }
})

watch(commentPages, async pages => {
  if (!pages.length) {
    visiblePages.value = 0
    teardownObserver()
    return
  }

  if (!isExpanded.value) {
    return
  }

  if (!visiblePages.value) {
    visiblePages.value = 1
  } else if (visiblePages.value > pages.length) {
    visiblePages.value = pages.length
  }

  await setupObserver()
})

onBeforeUnmount(() => {
  teardownObserver()
})

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
      <button
        type="button"
        :disabled="!commentsCount"
        :aria-expanded="isExpanded"
        :aria-controls="detailsId"
        @click="toggleExpanded"
      >
        {{ isExpanded ? content.ctaCloseLabel : content.ctaLabel }}
      </button>
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

    <Transition name="fade">
      <div v-if="isExpanded" :id="detailsId" class="listint-comments__details">
        <div v-if="visibleComments.length" ref="listRef" class="listint-comments__list">
          <CommentCard
            v-for="comment in visibleComments"
            :key="`${comment.name}-${comment.comment}`"
            :comment="comment"
            :stay-template="content.comment.stayLabel"
            :rating-unit="content.summary.ratingUnit"
          />
          <div ref="sentinelRef" class="listint-comments__sentinel" aria-hidden="true" />
        </div>

        <div v-else class="listint-comments__empty">
          <h3>{{ content.empty.title }}</h3>
          <p v-if="content.empty.subtitle">{{ content.empty.subtitle }}</p>
        </div>
      </div>
    </Transition>

    <div v-if="!isExpanded && !hasData" class="listint-comments__empty">
      <h3>{{ content.empty.title }}</h3>
      <p v-if="content.empty.subtitle">{{ content.empty.subtitle }}</p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/ListintComments/listint-comments.scss';
</style>
