<!-- File: src/views/ListingView/components/Comments/Comments.vue -->

<script setup lang="ts">
// DEPS
import { computed, nextTick, ref } from 'vue'
import type { SwiperOptions } from 'swiper/types'
import type { SwiperModule } from 'swiper/types'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, Pagination } from 'swiper/modules'

// COMPONENTS
import SummaryCard from './components/SummaryCard/SummaryCard.vue'
import DistributionList from './components/DistributionList/DistributionList.vue'
import CommentCard from './components/CommentCard/CommentCard.vue'

// UTILS
import { vp } from '@/utils/viewport'
import { formatICUMessage } from '@/utils/i18n'
import { buildDistributionFromComments, computePercentage } from '@/views/ListingView/utils/formatters'

// TYPES
import type { CommentsModel, NotesModel } from '@/views/ListingView/types/listing'

// ASSETS
import { X } from 'lucide-vue-next'
import AbsoluteOverlay from '@/components/overlays/AbsoluteOverlay.vue'

// CONTENT
import staticLocale from '@/locales/_static/fr.json'

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

const props = withDefaults(
  defineProps<{
    notes?: NotesModel
    comments?: CommentsModel
  }>(),
  {
    comments: () => [],
  },
)
// console.log(`${data?.comments?.length ? '✅' : '❌'} [Comments.vue](setup) core:resolved commentsCount=${data.comments?.length ?? 0} fetched`)
// console.log(`${'ℹ️'} [Comments.vue](setup) contentLoaded=commentsWidget ready for render`)

const previewLimit = content.preview?.maxItems ?? 5

const overlayStep = 10
const isOverlayOpen = ref(false)
const overlayLimit = ref(overlayStep)
const overlayScrollEl = ref<HTMLElement | null>(null)

const comments = computed(() => {
  const value = props.comments ?? []
  // console.log(`${value.length ? '✅' : '❌'} [Comments.vue](comments) comments:computed listLength=${value.length} prepared`)
  return value
})
const commentsCount = computed(() => {
  const count = comments.value.length
  // console.log(`${count ? '✅' : '❌'} [Comments.vue](commentsCount) commentsCount:computed total=${count} ready`)
  return count
})

const countLabel = computed(() => {
  const label = formatICUMessage(content.summary.countLabel, { count: commentsCount.value })
  // console.log(`${'ℹ️'} [Comments.vue](countLabel) countLabel:computed formatted=${label} applied`)
  return label
})

const overallScore = computed(() => {
  const overall = props.notes?.overall
  if (typeof overall === 'number' && !Number.isNaN(overall)) {
    // console.log(`${'✅'} [Comments.vue](overallScore) overallScore:computed fromNotes=${overall} reused`)
    return overall
  }

  if (!commentsCount.value) {
    // console.log(`${'❌'} [Comments.vue](overallScore) overallScore:computed unavailable=null noComments`)
    return null
  }

  const sum = comments.value.reduce((acc, comment) => acc + comment.note, 0)
  const value = commentsCount.value ? sum / commentsCount.value : null
  // console.log(`${typeof value === 'number' ? '✅' : '❌'} [Comments.vue](overallScore) overallScore:computed averaged=${value} calculated`)
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

  // console.log(`${resolved.entries.length ? '✅' : '❌'} [Comments.vue](resolveDistribution) distribution:resolved totalEntries=${resolved.total} compiled`)
  // console.log(`${'ℹ️'} [Comments.vue](resolveDistribution) distribution:sourceNotes used=${Boolean(notes?.distribution)} validated`)

  return resolved
}

const distribution = computed(() => {
  const resolved = resolveDistribution(props.notes, comments.value)
  // console.log(`${resolved.entries.length ? '✅' : '❌'} [Comments.vue](distribution) distribution:computed totalEntries=${resolved.total} readyForUI`)
  return resolved
})

const previewComments = computed(() => {
  const preview = comments.value.slice(0, previewLimit)
  // console.log(`${preview.length ? '✅' : '❌'} [Comments.vue](previewComments) preview:computed items=${preview.length} trimmed`)
  return preview
})

const overlayComments = computed(() => {
  const overlayList = comments.value.slice(0, overlayLimit.value)
  // console.log(`${overlayList.length ? '✅' : '❌'} [Comments.vue](overlayComments) overlay:computed items=${overlayList.length} limit=${overlayLimit.value}`)
  return overlayList
})

const canLoadOverlay = computed(() => overlayComments.value.length < comments.value.length)

function computeOverlayLimitForIndex(index: number) {
  if (index < 0) {
    return overlayStep
  }

  const neededPages = Math.floor(index / overlayStep) + 1
  const neededLimit = neededPages * overlayStep

  return Math.min(Math.max(overlayStep, neededLimit), comments.value.length)
}

async function scrollOverlayToIndex(index: number) {
  await nextTick()

  const scrollEl = overlayScrollEl.value
  if (!scrollEl) {
    return
  }

  const target = scrollEl.querySelector(`[data-comment-index="${index}"]`) as HTMLElement | null
  if (!target) {
    return
  }

  const offset = 275
  scrollEl.scrollTop = Math.max(0, target.offsetTop - offset)
}

function openOverlay(targetIndex?: number) {
  overlayLimit.value = typeof targetIndex === 'number' ? computeOverlayLimitForIndex(targetIndex) : overlayStep

  isOverlayOpen.value = true
  // console.log(`${'ℹ️'} [Comments.vue](openOverlay) overlay:state open=${isOverlayOpen.value} limit=${overlayLimit.value}`)

  nextTick(() => {
    if (!overlayScrollEl.value) {
      return
    }

    if (typeof targetIndex === 'number') {
      scrollOverlayToIndex(targetIndex)
      return
    }

    overlayScrollEl.value.scrollTop = 0
  })
}

function closeOverlay() {
  isOverlayOpen.value = false
  // console.log(`${'ℹ️'} [Comments.vue](closeOverlay) overlay:state open=${isOverlayOpen.value}`)
}

function loadMoreOverlay() {
  if (!canLoadOverlay.value) {
    return
  }
  const nextLimit = Math.min(overlayLimit.value + overlayStep, comments.value.length)
  overlayLimit.value = nextLimit
  // console.log(`${'ℹ️'} [Comments.vue](loadMoreOverlay) overlay:paginate limit=${overlayLimit.value} total=${comments.value.length}`)
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

const swiperParams = computed(
  () =>
    ({
      modules: [
        Autoplay as SwiperModule,
        Pagination as SwiperModule,
      ],

      direction: 'horizontal',

      slidesPerView: 1.15,
      spaceBetween: 0,

      pagination: false,

      // centeredSlides: true,
      navigation: false,
    }) satisfies SwiperOptions,
)
</script>

<template>
  <section
    id="comments"
    class="comments"
  >
    <div class="top">
      <div class="header">
        <h2
          v-if="!vp.lg.value"
          v-html="`${content.title} — ${countLabel}`"
        />
        <!-- <p v-if="commentsCount">{{ countLabel }}</p> -->
        <SummaryCard
          :score="overallScore"
          :rating-unit="content.summary.ratingUnit"
          :overall-label="content.summary.overallLabel"
          :count-label="countLabel"
          :show-stars="commentsCount > 0"
        />
      </div>
    </div>

    <div class="scroll">
      <div
        v-if="previewComments.length"
        class="list"
      >
        <CommentCard
          v-if="vp.lg.value"
          v-for="comment in previewComments"
          :key="`${comment.name}-${comment.comment}`"
          :comment="comment"
          :stay-template="content.comment.stayLabel"
          :rating-unit="content.summary.ratingUnit"
        />
        <Swiper
          v-if="!vp.lg.value"
          ref="swiperWrapper"
          v-bind="swiperParams"
        >
          <SwiperSlide
            v-for="(comment, index) in previewComments"
            :key="`${comment.name}-${comment.comment}`"
          >
            <CommentCard
              :key="`${comment.name}-${comment.comment}`"
              :comment="comment"
              :stay-template="content.comment.stayLabel"
              :rating-unit="content.summary.ratingUnit"
              :index="index"
              @read-more="openOverlay"
            />
          </SwiperSlide>
        </Swiper>
      </div>
    </div>

    <div class="more">
      <div>
        <button
          type="button"
          class=""
          :disabled="!commentsCount"
          @click="openOverlay()"
          v-html="content.ctaLabel"
        />
      </div>
    </div>

    <AbsoluteOverlay
      class="comments-overlay"
      :open="isOverlayOpen"
      aria-label="Tous les commentaires"
      @close="closeOverlay"
    >
      <div class="panel">
        <div class="header">
          <div class="close">
            <button
              type="button"
              @click="closeOverlay"
            >
              <X :size="24" />
            </button>
          </div>
        </div>

        <div class="body">
          <div class="summary">
            <div class="summary-container">
              <h2 v-html="`${content.title} — ${countLabel}`" />
              <SummaryCard
                :score="overallScore"
                :rating-unit="content.summary.ratingUnit"
                :overall-label="content.summary.overallLabel"
                :count-label="countLabel"
                :show-stars="commentsCount > 0"
              />
            </div>

            <DistributionList
              v-if="distribution.entries.length"
              :entries="distribution.entries"
              :title="content.distribution.title"
              :rating-label="content.distribution.ratingLabel"
            />
          </div>

          <div
            ref="overlayScrollEl"
            class="list"
            @scroll="handleOverlayScroll"
          >
            <CommentCard
              v-for="(comment, index) in overlayComments"
              :key="`${comment.name}-${comment.comment}`"
              :comment="comment"
              :data-comment-index="index"
              :stay-template="content.comment.stayLabel"
              :rating-unit="content.summary.ratingUnit"
              :see-more="false"
            />
          </div>
        </div>
      </div>
    </AbsoluteOverlay>
  </section>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Comments/comments.scss';
</style>
