<!-- File: src/views/Donation/_DonationPage.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import DonationHeroSection from '@/views/Donation/components/DonationHeroSection/DonationHeroSection.vue'
import DonationFormPanel from '@/views/Donation/components/DonationFormPanel/DonationFormPanel.vue'
import DonationStatusBanner from '@/views/Donation/components/DonationStatusBanner/DonationStatusBanner.vue'

import donationLocale from '@/locales/donation/fr.json'
import type { DonationContent } from '@/views/Donation/types/content'

const route = useRoute()
const donationContent = donationLocale as DonationContent

const statusMessages = computed(() => donationContent.status.messages)

const statusKey = computed(() => {
  const raw = route.query.status
  const normalized = Array.isArray(raw) ? raw[0] : raw

  if (typeof normalized !== 'string' || normalized.length === 0) {
    return null
  }

  const lowerCased = normalized.toLowerCase()

  if (statusMessages.value?.[lowerCased]) {
    return lowerCased
  }

  if (statusMessages.value?.[normalized]) {
    return normalized
  }

  return null
})

const statusPayload = computed(() => {
  if (!statusKey.value) return null
  const message = statusMessages.value?.[statusKey.value]
  if (!message) return null

  return {
    status: statusKey.value,
    severity: message.severity,
    title: message.title,
    body: message.body,
  }
})

const donationLink = computed(() => (import.meta.env.VITE_DONATION_LINK ?? '').trim())
const pageTitle = computed(() => donationContent.page.title || 'Soutenir IndieHost')
const pageSubtitles = computed(() => donationContent.page.subtitles ?? [])
</script>

<template>
  <main class="donation-page">
    <h1
      class="donation-page__title"
      v-html="pageTitle"
    />

    <div class="donation-page__subtitle-container">
      <p
        v-for="subtitle in pageSubtitles"
        :key="subtitle"
        class="donation-page__subtitle"
        v-html="subtitle"
      />
    </div>

    <section class="donation-page__section">
      <div class="wrapper__xl donation-page__content">
        <DonationStatusBanner
          v-if="statusPayload"
          :status="statusPayload.status"
          :title="statusPayload.title"
          :body="statusPayload.body"
          :severity="statusPayload.severity"
        />

        <div class="donation-page__grid">
          <DonationHeroSection :article="donationContent.article" />

          <DonationFormPanel
            :panel="donationContent.panel"
            :donation-link="donationLink"
          />
        </div>
      </div>
    </section>
  </main>
</template>

<style lang="scss" src="@/views/Donation/_donation-page.scss"></style>
<style lang="scss" src="@/views/Donation/_donation-page.patch.scss"></style>
