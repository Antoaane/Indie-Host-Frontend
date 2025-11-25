<!-- File: src/views/ListingView/components/ListingComments/components/CommentCard/CommentCard.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'

// UTILS
import { formatRatingValue } from '@/views/ListingView/utils/formatters'

// TYPES
import type { CommentItem } from '@/views/ListingView/types/listing'

// ASSETS
import { Star } from 'lucide-vue-next'

const props = defineProps<{
  comment: CommentItem
  stayTemplate: string
  ratingUnit: string
}>()

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

console.log(`${props.comment ? '✅' : '❌'} [CommentCard.vue](setup) comment:received name=${props.comment?.name}`)
console.log(`${'ℹ️'} [CommentCard.vue](ratingLabel) comment:rating formatted=${ratingLabel.value}`)
console.log(`${'ℹ️'} [CommentCard.vue](stayLabel) comment:stay label=${stayLabel.value}`)
console.log(`${fallbackInitials.value ? '✅' : '❌'} [CommentCard.vue](fallbackInitials) comment:initials value=${fallbackInitials.value}`)
</script>

<template>
  <div class="listing-comments__comment">
    <div>
      <div class="listing-comments__comment-meta">
        <img
          v-if="comment.avatar"
          :src="comment.avatar"
          :alt="comment.name"
          class="listing-comments__comment-avatar"
        />
        <span
          v-else
          aria-hidden="true"
          class="listing-comments__comment-avatar"
        >
          {{ fallbackInitials }}
        </span>

        <div>
          <h4>{{ comment.name }}</h4>
          <div class="listing-comments__comment-note">
            <p v-if="stayLabel">{{ stayLabel }}</p>
            <div>
              <Star
                v-for="star in comment.note"
                :size="12"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <blockquote>{{ comment.comment }}</blockquote>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.listing-comments__comment {
  margin-bottom: var(--gutter-spacing-xl);

  .listing-comments__comment-meta {
    margin-bottom: var(--gutter-spacing-sm);

    display: flex;
    align-items: center;
    gap: var(--gutter-spacing-md);

    .listing-comments__comment-avatar {
      width: 3rem;
      height: 3rem;

      display: flex;
      align-items: center;
      justify-content: center;

      font-weight: bold;
      font-size: 1.25rem;
      color: $secondary;

      border-radius: borders.$rounded;
      background-color: $quaternary;
    }

    & > div {
      display: flex;
      flex-direction: column;

      h4 {
        margin: 0 !important;
        font-weight: 500 !important;

        @include base-text($bigger: true);
      }

      .listing-comments__comment-note {
        display: flex;
        align-items: end;
        gap: var(--gutter-spacing-sm);

        p {
          @include little-text($thin: false);
        }

        & > div {
          margin-bottom: 2px;

          display: flex;
          gap: 1px;

          .lucide-star-icon {
            fill: $secondary;
            stroke: $secondary;
          }
        }
      }
    }
  }

  blockquote {
    margin: 0 !important;
    @include base-text($thin: false);
  }
}
</style>
