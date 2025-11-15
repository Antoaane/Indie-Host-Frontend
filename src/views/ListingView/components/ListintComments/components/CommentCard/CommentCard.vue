<!-- File: src/views/ListingView/components/ListintComments/components/CommentCard/CommentCard.vue -->

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
</script>

<template>
  <div class="listint-comments__comment">
    <div>
      <div class="listint-comments__comment-avatar">
        <img
          v-if="comment.avatar"
          :src="comment.avatar"
          :alt="comment.name"
        />
        <span
          v-else
          aria-hidden="true"
          >{{ fallbackInitials }}</span
        >
      </div>
      <div class="listint-comments__comment-meta">
        <h4>{{ comment.name }}</h4>
        <p v-if="stayLabel">{{ stayLabel }}</p>
      </div>
      <div class="listint-comments__comment-note">
        <strong>{{ ratingLabel }}</strong>
        <span>{{ ratingUnit }}</span>
      </div>
    </div>
    <blockquote>{{ comment.comment }}</blockquote>
  </div>
</template>
