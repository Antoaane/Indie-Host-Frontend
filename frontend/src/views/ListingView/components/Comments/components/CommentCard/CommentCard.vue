<!-- File: src/views/ListingView/components/Comments/components/CommentCard/CommentCard.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'

// UTILS
import { formatRatingValue } from '@/views/ListingView/utils/formatters'
import { useListingViewport } from '@/views/ListingView/composables/useListingViewport'

// TYPES
import type { CommentItem } from '@/views/ListingView/types/listing'

// ASSETS
import { Star } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    comment: CommentItem
    stayTemplate: string
    ratingUnit: string
    seeMore?: boolean
    index?: number
  }>(),
  {
    seeMore: true,
  },
)

const emit = defineEmits<{
  (event: 'read-more', index: number): void
}>()

const { isLg } = useListingViewport()

const ratingLabel = computed(() =>
  formatRatingValue(props.comment.note, 'fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }),
)

const stayLabel = computed(() => {
  const range = props.comment.stayDates

  if (!range?.start || !range?.end) {
    return ''
  }

  const start = new Date(range.start)
  const end = new Date(range.end)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ''
  }

  const monthYear = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(start)
  const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const nightsLabel = `${nights} nuit${nights > 1 ? 's' : ''}`

  return `${monthYear} — ${nightsLabel}`
})

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const fallbackInitials = computed(() => initials(props.comment.name))

function handleReadMoreClick() {
  if (typeof props.index === 'number') {
    emit('read-more', props.index)
  }
}

// console.log(`${props.comment ? '✅' : '❌'} [CommentCard.vue](setup) comment:received name=${props.comment?.name}`)
// console.log(`${'ℹ️'} [CommentCard.vue](ratingLabel) comment:rating formatted=${ratingLabel.value}`)
// console.log(`${'ℹ️'} [CommentCard.vue](stayLabel) comment:stay label=${stayLabel.value}`)
// console.log(`${fallbackInitials.value ? '✅' : '❌'} [CommentCard.vue](fallbackInitials) comment:initials value=${fallbackInitials.value}`)
</script>

<template>
  <div class="comment-card">
    <div class="header">
      <div class="meta">
        <img
          v-if="comment.avatar"
          :src="comment.avatar"
          :alt="comment.name"
          class="avatar"
        />
        <span
          v-else
          aria-hidden="true"
          class="avatar"
          v-html="fallbackInitials"
        ></span>

        <div class="info">
          <h4 v-html="comment.name"></h4>
          <div
            v-if="isLg"
            class="note"
          >
            <p
              v-if="stayLabel"
              v-html="stayLabel"
            ></p>
            <div>
              <Star
                v-for="star in comment.note"
                :size="isLg ? 12 : 10"
              />
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="!isLg"
        class="note"
      >
        <p
          v-if="stayLabel"
          v-html="stayLabel"
        ></p>
        <div>
          <Star
            v-for="star in comment.note"
            :size="isLg ? 12 : 10"
          />
        </div>
      </div>
    </div>
    <blockquote v-html="comment.comment"></blockquote>
    <span
      v-if="!isLg && props.seeMore"
      class="more"
    >
      <button
        type="button"
        @click="handleReadMoreClick"
      >
        Lire plus
      </button>
    </span>
  </div>
</template>

<style lang="scss">
@use '@/views/ListingView/components/Comments/components/CommentCard/comment-card.scss';
</style>
