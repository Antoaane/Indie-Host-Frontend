<!-- File: src/views/ListingView/components/ListingComments/components/CommentCard/CommentCard.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'

// UTILS
import { vp } from '@/utils/viewport'
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
          v-html="fallbackInitials"
        ></span>

        <div>
          <h4 v-html="comment.name"></h4>
          <div
            v-if="vp.lg.value"
            class="listing-comments__comment-note"
          >
            <p
              v-if="stayLabel"
              v-html="stayLabel"
            ></p>
            <div>
              <Star
                v-for="star in comment.note"
                :size="vp.lg.value ? 12 : 10"
              />
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="!vp.lg.value"
        class="listing-comments__comment-note"
      >
        <p
          v-if="stayLabel"
          v-html="stayLabel"
        ></p>
        <div>
          <Star
            v-for="star in comment.note"
            :size="vp.lg.value ? 12 : 10"
          />
        </div>
      </div>
    </div>
    <blockquote v-html="comment.comment"></blockquote>
    <span class="see-more">
      <button v-if="!vp.lg.value"> Lire plus </button>
    </span>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/buttons' as buttons;

.listing-comments__comment {
  padding-right: calc(var(--gutter-spacing-3xl) * 2);
  height: 100%;

  &::after {
    content: '';
    height: 75%;
    width: 0.5px;

    position: absolute;
    right: var(--gutter-spacing-3xl);
    top: 50%;
    transform: translateY(-50%);

    background-color: rgba($secondary, 0.5);
  }

  @include min-width(lg) {
    height: auto;
    padding-right: 0;
    margin-bottom: var(--gutter-spacing-xl);

    &::after {
      display: none;
    }
  }

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
    }
  }

  .listing-comments__comment-note {
    margin-bottom: 0.5rem;

    display: flex;
    align-items: end;
    gap: var(--gutter-spacing-sm);

    @include min-width(lg) {
      margin-bottom: 0;
    }

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

  blockquote {
    margin: 0 !important;
    @include base-text($thin: false);

    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;

    @include min-width(lg) {
      display: inline;
      text-overflow: unset;
      overflow: visible;
    }
  }

  .see-more {
    margin-top: 0.5rem;
    @include buttons.secondary($padding: false);
  }
}
</style>
