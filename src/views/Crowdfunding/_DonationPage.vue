<!-- File: src/views/Crowdfunding/_DonationPage.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import DonationHeroSection from '@/views/Crowdfunding/components/DonationHeroSection/DonationHeroSection.vue'
import DonationFormPanel from '@/views/Crowdfunding/components/DonationFormPanel/DonationFormPanel.vue'
import DonationStatusBanner from '@/views/Crowdfunding/components/DonationStatusBanner/DonationStatusBanner.vue'

import type { ItemSection, ContentBlock } from '@/content/types'
import pageContent from '@/content/fr/Crowdfunding/donation-page.json'
import statusContent from '@/content/fr/Crowdfunding/donation-status.json'
import heroContent from '@/content/fr/Crowdfunding/donation-hero.json'
import panelContent from '@/content/fr/Crowdfunding/donation-panel.json'

type DonationStatus = 'success' | 'cancel'

const route = useRoute()

const pageSection = pageContent as ItemSection
const statusSection = statusContent as ItemSection
const heroSection = heroContent as ItemSection
const panelSection = panelContent as ItemSection

const pageTitle = computed(() => pageSection.items['title-1']?.content ?? 'Soutenir IndieHost')

const donationLink = computed(() => (import.meta.env.VITE_DONATION_LINK ?? '').trim())

const statusDictionary = computed<Record<string, ContentBlock>>(() => statusSection.items ?? {})

const statusType = computed<DonationStatus | null>(() => {
  const raw = route.query.status
  const normalized = Array.isArray(raw) ? raw[0] : raw

  if (normalized === 'success' || normalized === 'cancel') {
    return normalized
  }

  return null
})

const statusPayload = computed(() => {
  if (!statusType.value) {
    return null
  }

  const statusBlock = statusDictionary.value[statusType.value]
  const meta = statusBlock?.meta

  if (!meta) {
    return null
  }

  return {
    status: statusType.value,
    title: meta.title as string,
    body: meta.body as string,
  }
})
</script>

<template>
  <main class="donation-page">
    <h1
      class="donation-page__title"
      v-html="pageTitle"
    />
    <section class="donation-page__section">
      <div class="container__xl donation-page__content">
        <DonationStatusBanner
          v-if="statusPayload"
          :status="statusPayload.status"
          :title="statusPayload.title"
          :body="statusPayload.body"
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

<style lang="scss" src="@/views/Crowdfunding/_donation-page.scss"></style>
