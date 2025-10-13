<!-- File: src/views/Donation/_DonationPage.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import DonationHeroSection from '@/views/Donation/components/DonationHeroSection/DonationHeroSection.vue'
import DonationFormPanel from '@/views/Donation/components/DonationFormPanel/DonationFormPanel.vue'
import DonationStatusBanner from '@/views/Donation/components/DonationStatusBanner/DonationStatusBanner.vue'

import type { ItemSection, ContentBlock } from '@/content/types'
import pageContent from '@/content/fr/Donation/donation-page.json'
import statusContent from '@/content/fr/Donation/donation-status.json'
import heroContent from '@/content/fr/Donation/donation-article.json'
import panelContent from '@/content/fr/Donation/donation-panel.json'

interface SectionEntry {
  key: string
  block: ContentBlock
  index: number
}

const route = useRoute()

const pageSection = pageContent as ItemSection
const statusSection = statusContent as ItemSection
const heroSection = heroContent as ItemSection
const panelSection = panelContent as ItemSection

const toEntries = (items: Record<string, ContentBlock> | undefined): SectionEntry[] =>
  Object.entries(items ?? {}).map(
    (
      [
        key,
        block,
      ],
      index,
    ) => ({ key, block, index }),
  )

const normalizeOrder = (block: ContentBlock) => {
  const order = block.meta?.order
  return typeof order === 'number' ? order : Number.POSITIVE_INFINITY
}

const sortEntries = (list: SectionEntry[]) =>
  [
    ...list,
  ].sort((a, b) => {
    const diff = normalizeOrder(a.block) - normalizeOrder(b.block)

    if (diff !== 0) {
      return diff
    }

    return a.index - b.index
  })

const resolveTag = (block: ContentBlock | undefined, fallback: string) => {
  const tag = block?.tag

  if (typeof tag === 'string' && tag.trim().length > 0) {
    return tag
  }

  return fallback
}

const pageEntries = computed(() => sortEntries(toEntries(pageSection.items)))

const pageTitleEntry = computed(
  () =>
    pageEntries.value.find((entry) => {
      const role = entry.block.meta?.role

      if (typeof role === 'string' && role === 'title') {
        return true
      }

      const tag = entry.block.tag

      return typeof tag === 'string' && /^h[1-6]$/i.test(tag)
    }) ?? null,
)

const pageSubtitleEntries = computed(() => pageEntries.value.filter((entry) => entry.key !== pageTitleEntry.value?.key && entry.block.meta?.role === 'subtitle'))

const fallbackTitle = 'Soutenir IndieHost'

const pageTitleContent = computed(() => pageTitleEntry.value?.block.content ?? fallbackTitle)

const pageTitleTag = computed(() => resolveTag(pageTitleEntry.value?.block, 'h1'))

const statusEntries = computed(() => toEntries(statusSection.items))

const statusDictionary = computed<Record<string, ContentBlock>>(() => {
  const dict: Record<string, ContentBlock> = {}

  statusEntries.value.forEach((entry) => {
    dict[entry.key] = entry.block
  })

  return dict
})

const statusKey = computed(() => {
  const raw = route.query.status
  const normalized = Array.isArray(raw) ? raw[0] : raw

  if (typeof normalized !== 'string' || normalized.length === 0) {
    return null
  }

  const lowerCased = normalized.toLowerCase()

  if (statusDictionary.value[lowerCased]) {
    return lowerCased
  }

  if (statusDictionary.value[normalized]) {
    return normalized
  }

  return null
})

const statusPayload = computed(() => {
  if (!statusKey.value) {
    return null
  }

  const block = statusDictionary.value[statusKey.value]

  if (!block?.meta) {
    return null
  }

  const title = typeof block.meta.title === 'string' ? block.meta.title : ''
  const body = typeof block.meta.body === 'string' ? block.meta.body : ''
  const severity = typeof block.meta.severity === 'string' ? block.meta.severity : undefined

  if (!title && !body) {
    return null
  }

  return {
    status: statusKey.value,
    severity,
    title,
    body,
  }
})

const donationLink = computed(() => (import.meta.env.VITE_DONATION_LINK ?? '').trim())
</script>

<template>
  <main class="donation-page">
    <component
      :is="pageTitleTag"
      class="donation-page__title"
      v-html="pageTitleContent"
    />

    <div class="donation-page__subtitle-container">
      <template
        v-for="subtitle in pageSubtitleEntries"
        :key="subtitle.key"
      >
        <component
          v-if="subtitle.block.content"
          :is="resolveTag(subtitle.block, 'p')"
          class="donation-page__subtitle"
          v-html="subtitle.block.content"
        />
      </template>
    </div>

    <section class="donation-page__section">
      <div class="container__xl donation-page__content">
        <DonationStatusBanner
          v-if="statusPayload"
          :status="statusPayload.status"
          :title="statusPayload.title"
          :body="statusPayload.body"
          :severity="statusPayload.severity"
        />

        <div class="donation-page__grid">
          <DonationHeroSection :section="heroSection" />

          <DonationFormPanel
            :section="panelSection"
            :donation-link="donationLink"
          />
        </div>
      </div>
    </section>
  </main>
</template>

<style lang="scss" src="@/views/Donation/_donation-page.scss"></style>
