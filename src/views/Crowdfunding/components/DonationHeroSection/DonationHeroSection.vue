<!-- File: src/views/Crowdfunding/components/DonationHeroSection/DonationHeroSection.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { ItemSection } from '@/content/types'

interface HeroBlock {
  type?: string
  title?: string
  paragraphs?: string[]
  items?: string[]
  content?: string
  cite?: string
}

const props = defineProps<{ section: ItemSection }>()

const items = computed(() => props.section.items ?? {})

const eyebrow = computed(() => items.value['eyebrow']?.content ?? '')
const title = computed(() => items.value['title-1']?.content ?? '')
const lead = computed(() => items.value['lead-1']?.content ?? '')

const blocks = computed<HeroBlock[]>(() => {
  const meta = items.value['blocks']?.meta

  if (meta && Array.isArray(meta.blocks)) {
    return meta.blocks as HeroBlock[]
  }

  return []
})
</script>

<template>
  <article class="donation-hero">
    <div class="donation-hero__intro">
      <span
        v-if="eyebrow"
        class="donation-hero__eyebrow"
        v-html="eyebrow"
      />
      <h2
        v-if="title"
        class="donation-hero__title"
        v-html="title"
      />
      <p
        v-if="lead"
        class="donation-hero__lead"
        v-html="lead"
      />
    </div>

    <section class="donation-hero__body">
      <template
        v-for="(block, index) in blocks"
        :key="index"
      >
        <div v-if="block.type === 'section'">
          <h3
            v-if="block.title"
            v-html="block.title"
          />
          <p
            v-for="(paragraph, paragraphIndex) in block.paragraphs || []"
            :key="'p-'"
            v-html="paragraph"
          />
        </div>

        <div v-else-if="block.type === 'list'">
          <h3
            v-if="block.title"
            v-html="block.title"
          />
          <ul>
            <li
              v-for="(item, itemIndex) in block.items || []"
              :key="'li-'"
              v-html="item"
            />
          </ul>
        </div>

        <blockquote v-else-if="block.type === 'quote'">
          <p v-html="block.content" />
          <cite v-if="block.cite">{{ block.cite }}</cite>
        </blockquote>
      </template>
    </section>
  </article>
</template>

<style lang="scss" scoped src="@/views/Crowdfunding/components/DonationHeroSection/DonationHeroSection.scss"></style>
