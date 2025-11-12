<!-- File: src/views/Donation/components/DonationHeroSection/DonationHeroSection.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import RoadMapLight from '@/components/svgs/images/RoadMapLight.vue'
import type { DonationArticleContent, DonationArticleSection } from '@/views/Donation/types/content'
import { formatRichText } from '@/utils/i18n'

const props = defineProps<{
  article: DonationArticleContent
}>()

type IntroBlock = {
  id: string
  className: string
  text: string
}

const introBlocks = computed<IntroBlock[]>(() => {
  const blocks: IntroBlock[] = []
  if (props.article.eyebrow) {
    blocks.push({ id: 'eyebrow', className: 'donation-hero__eyebrow', text: props.article.eyebrow })
  }
  if (props.article.title) {
    blocks.push({ id: 'title', className: 'donation-hero__title', text: props.article.title })
  }
  if (props.article.lead) {
    blocks.push({ id: 'lead', className: 'donation-hero__lead', text: props.article.lead })
  }
  if (props.article.intro) {
    blocks.push({ id: 'intro', className: 'donation-hero__intro-block', text: props.article.intro })
  }
  return blocks
})

const bodySections = computed(() => props.article.sections ?? [])

const isListSection = (section: DonationArticleSection) => section.type === 'list'
const isQuoteSection = (section: DonationArticleSection) => section.type === 'quote'
</script>

<template>
  <article class="donation-hero">
    <div
      v-if="introBlocks.length"
      class="donation-hero__intro"
    >
      <component
        v-for="block in introBlocks"
        :key="block.id"
        :is="block.id === 'title' ? 'h2' : block.id === 'eyebrow' ? 'p' : 'p'"
        :class="block.className"
        v-html="formatRichText(block.text)"
      />
    </div>

    <section
      v-if="bodySections.length"
      class="donation-hero__body"
    >
      <div
        v-for="(section, index) in bodySections"
        :key="`${section.type}-${index}`"
        class="donation-hero__body-block"
      >
        <template v-if="isListSection(section)">
          <h3 v-if="section.title">
            {{ section.title }}
          </h3>
          <ul>
            <li
              v-for="(item, idx) in section.items || []"
              :key="`${section.type}-${index}-item-${idx}`"
              v-html="formatRichText(item)"
            />
          </ul>
        </template>

        <blockquote v-else-if="isQuoteSection(section)">
          <p v-html="formatRichText(section.content || '')" />
          <cite v-if="section.cite">
            {{ section.cite }}
          </cite>
        </blockquote>

        <template v-else>
          <h3 v-if="section.title">
            {{ section.title }}
          </h3>
          <p
            v-for="(paragraph, idx) in section.paragraphs || []"
            :key="`${section.type}-${index}-paragraph-${idx}`"
            v-html="formatRichText(paragraph)"
          />
          <p
            v-if="section.content"
            v-html="formatRichText(section.content)"
          />
        </template>

        <RoadMapLight v-if="index === 0" />
      </div>
    </section>
  </article>
</template>
