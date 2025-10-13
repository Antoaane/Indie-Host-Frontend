<!-- File: src/views/Donation/components/DonationHeroSection/DonationHeroSection.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { ItemSection, ContentBlock } from '@/content/types'

interface HeroRichBlock {
  type?: string
  title?: string
  paragraphs?: string[]
  items?: string[]
  content?: string
  cite?: string
}

interface SectionEntry {
  key: string
  block: ContentBlock
  index: number
}

const props = defineProps<{ section: ItemSection }>()

const entries = computed<SectionEntry[]>(() => {
  const record = props.section.items ?? {}
  return Object.entries(record).map(
    (
      [
        key,
        block,
      ],
      index,
    ) => ({ key, block, index }),
  )
})

const normalizeOrder = (block: ContentBlock) => {
  const order = block.meta?.order
  return typeof order === 'number' ? order : Number.POSITIVE_INFINITY
}

const sortEntries = (list: SectionEntry[]) => {
  return [
    ...list,
  ].sort((a, b) => {
    const orderDiff = normalizeOrder(a.block) - normalizeOrder(b.block)

    if (orderDiff !== 0) {
      return orderDiff
    }

    return a.index - b.index
  })
}

const getSegment = (block: ContentBlock) => {
  const segment = block.meta?.segment

  if (typeof segment === 'string' && segment.length > 0) {
    return segment
  }

  return block.tag === 'component' ? 'body' : 'intro'
}

const introBlocks = computed(() => sortEntries(entries.value.filter((entry) => getSegment(entry.block) === 'intro')))

const bodyBlocks = computed(() => sortEntries(entries.value.filter((entry) => getSegment(entry.block) === 'body')))

const classForIntro = (block: ContentBlock) => {
  const role = block.meta?.role

  if (role === 'eyebrow') {
    return 'donation-hero__eyebrow'
  }

  if (role === 'title') {
    return 'donation-hero__title'
  }

  if (role === 'lead') {
    return 'donation-hero__lead'
  }

  return 'donation-hero__intro-block'
}

const resolveTag = (block: ContentBlock, fallback: string) => {
  const tag = block.tag

  if (typeof tag === 'string' && tag.trim().length > 0) {
    return tag
  }

  return fallback
}

const extractRichBlocks = (block: ContentBlock): HeroRichBlock[] => {
  const metaBlocks = block.meta?.blocks

  if (Array.isArray(metaBlocks)) {
    return metaBlocks as HeroRichBlock[]
  }

  return []
}
</script>

<template>
  <article class="donation-hero">
    <div
      v-if="introBlocks.length"
      class="donation-hero__intro"
    >
      <template
        v-for="intro in introBlocks"
        :key="intro.key"
      >
        <component
          v-if="intro.block.content"
          :is="resolveTag(intro.block, 'p')"
          :class="classForIntro(intro.block)"
          v-html="intro.block.content"
        />
      </template>
    </div>

    <section
      v-if="bodyBlocks.length"
      class="donation-hero__body"
    >
      <template
        v-for="body in bodyBlocks"
        :key="body.key"
      >
        <div
          v-if="body.block.meta?.variant === 'rich-blocks'"
          class="donation-hero__rich-blocks"
        >
          <template
            v-for="(richBlock, index) in extractRichBlocks(body.block)"
            :key="`${body.key}-${index}`"
          >
            <div v-if="richBlock.type === 'section'">
              <component
                v-if="richBlock.title"
                :is="body.block.meta?.sectionTag ?? 'h3'"
                v-html="richBlock.title"
              />
              <p
                v-for="(paragraph, paragraphIndex) in richBlock.paragraphs || []"
                :key="`${body.key}-section-${index}-p-${paragraphIndex}`"
                v-html="paragraph"
              />
            </div>

            <div v-else-if="richBlock.type === 'list'">
              <component
                v-if="richBlock.title"
                :is="body.block.meta?.sectionTag ?? 'h3'"
                v-html="richBlock.title"
              />
              <ul>
                <li
                  v-for="(item, itemIndex) in richBlock.items || []"
                  :key="`${body.key}-list-${index}-li-${itemIndex}`"
                  v-html="item"
                />
              </ul>
            </div>

            <blockquote v-else-if="richBlock.type === 'quote'">
              <p v-html="richBlock.content" />
              <cite v-if="richBlock.cite">
                {{ richBlock.cite }}
              </cite>
            </blockquote>

            <component
              v-else-if="richBlock.content"
              :is="richBlock.type || 'div'"
              v-html="richBlock.content"
            />
          </template>

          <video
            controls
            autoplay
            playsinline
            muted
            loop
          >
            <!-- webm -->
            <source
              src="/public/assets/media/videos/indiehost-demo.webm"
              type="video/webm"
            />
            <!-- mp4 -->
            <source
              src="/public/assets/media/videos/indiehost-demo.mp4"
              type="video/mp4"
            />
            Your browser does not support the video tag.
          </video>
        </div>

        <component
          v-else-if="body.block.content"
          :is="resolveTag(body.block, 'div')"
          class="donation-hero__body-block"
          v-html="body.block.content"
        />
      </template>
    </section>
  </article>
</template>

<style lang="scss" scoped src="@/views/Donation/components/DonationHeroSection/DonationHeroSection.scss"></style>
