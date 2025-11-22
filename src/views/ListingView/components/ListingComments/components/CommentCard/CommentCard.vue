<!-- File: src/views/ListingView/components/ListingComments/components/CommentCard/CommentCard.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { CommentItem } from '@/views/ListingView/types/listing'
import { formatRatingValue, formatStayPeriodLabel } from '@/views/ListingView/utils/formatters'

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

const stayLabel = computed(() => formatStayPeriodLabel(props.comment.stayDates, props.stayTemplate))

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
          <p v-if="stayLabel">{{ stayLabel }}</p>
        </div>
      </div>
      <div class="listing-comments__comment-note">
        <strong>{{ ratingLabel }}</strong>
        <span>{{ ratingUnit }}</span>
      </div>
    </div>
    <blockquote>{{ comment.comment }}</blockquote>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;

.listing-comments__comment {
  .listing-comments__comment-meta {
    display: flex;
    align-items: center;

    .listing-comments__comment-avatar {
      width: 3rem;
      height: 3rem;
      border-radius: borders.$rounded;
      background-color: $quaternary;
      color: $secondary;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 1.25rem;
    }

    div {
      display: flex;
      flex-direction: column;

      h4 {
        margin: 0 !important;
        @include h4-title;
      }
      p {
        @include little-text;
      }
    }
  }

  .listing-comments__comment-note {
  }

  blockquote {
    margin: 0 !important;
    @include base-text($thin: false);
  }
}
</style>
