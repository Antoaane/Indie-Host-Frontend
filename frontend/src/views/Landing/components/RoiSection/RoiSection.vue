<!-- File: src/views/Landing/components/RoiSection/RoiSection.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { RoiSectionContent } from '@/views/Landing/types/content'

const props = defineProps<{
  content: RoiSectionContent
}>()
const content = props.content

const SUPERHOST_MONTHLY_PRICE = 39
const SUPERHOST_YEARLY_PRICE = SUPERHOST_MONTHLY_PRICE * 12
const OTA_COMMISSION_RATE = 0.15
const revenuePresets = [25000, 50000, 100000, 150000]

const annualRevenueInput = ref<number>(50000)
const directShare = ref(20)

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const annualRevenue = computed(() => Math.max(0, annualRevenueInput.value))
const directShareRatio = computed(() => Math.max(0, Math.min(0.95, directShare.value / 100)))
const directRevenue = computed(() => annualRevenue.value * directShareRatio.value)
const otaFeesAvoided = computed(() => directRevenue.value * OTA_COMMISSION_RATE)
const superHostAnnualCost = computed(() => SUPERHOST_YEARLY_PRICE)
const netGain = computed(() => otaFeesAvoided.value - superHostAnnualCost.value)
const breakEvenDirectShare = computed(() => {
  if (!annualRevenue.value) return 0
  return Math.min(100, (superHostAnnualCost.value / (annualRevenue.value * OTA_COMMISSION_RATE)) * 100)
})

const interactiveContent = computed(() => ({
  helper: props.content.interactive?.helper ?? "Choisissez une tranche de revenus ou saisissez votre estimation. Aucune donnée n'est enregistrée.",
  revenueHint: props.content.interactive?.revenueHint ?? 'Par tranche, pour rester simple',
  directShareLabel: props.content.interactive?.directShareLabel ?? 'Part estimée qui passe en direct',
  directShareNote: props.content.interactive?.directShareNote ?? 'Même une petite part de direct peut suffire à rentabiliser SuperHost.',
  directRevenueLabel: props.content.interactive?.directRevenueLabel ?? 'Volume annuel estimé en direct',
  netGainLabel: props.content.interactive?.netGainLabel ?? 'Gain net théorique après SuperHost',
  breakEvenTemplate: props.content.interactive?.breakEvenTemplate ?? 'SuperHost est amorti dès environ {value} de ventes en direct.',
}))

const annualRevenueLabel = computed(() => currency.format(annualRevenue.value))
const otaFeesAvoidedLabel = computed(() => currency.format(otaFeesAvoided.value))
const superHostAnnualCostLabel = computed(() => currency.format(superHostAnnualCost.value))
const netGainLabel = computed(() => currency.format(netGain.value))
const breakEvenDirectShareLabel = computed(() => `${Math.max(1, Math.ceil(breakEvenDirectShare.value))} %`)
const breakEvenMessage = computed(() =>
  interactiveContent.value.breakEvenTemplate.replace('{value}', breakEvenDirectShareLabel.value),
)
const avoidedVsSubscriptionMessage = computed(
  () => `${otaFeesAvoidedLabel.value} de commissions évitées pour ${superHostAnnualCostLabel.value} d'abonnement.`,
)

function applyRevenuePreset(value: number) {
  annualRevenueInput.value = value
}
</script>

<template>
  <section id="roi-section">
    <div class="wrapper">
      <div class="title">
        <p
          data-sr
          data-sr-y="-20"
          class="eyebrow"
        >
          {{ content.eyebrow }}
        </p>
        <h2
          data-sr
          data-sr-y="-30"
          v-html="content.title"
        />
        <p
          data-sr
          data-sr-y="30"
          class="subtitle"
        >
          {{ content.subtitle }}
        </p>
      </div>

      <div class="grid">
        <article
          class="scenario"
          data-sr
          data-sr-y="40"
        >
          <p class="scenario-title">{{ content.scenario.title }}</p>
          <p class="scenario-helper">
            {{ interactiveContent.helper }}
          </p>

          <div class="simulator">
            <div class="field">
              <div class="field-heading">
                <label for="roi-revenue-input">{{ content.scenario.revenueLabel }}</label>
                <span>{{ interactiveContent.revenueHint }}</span>
              </div>

              <div class="preset-list">
                <button
                  v-for="preset in revenuePresets"
                  :key="preset"
                  type="button"
                  class="preset"
                  :class="{ 'is-active': annualRevenue === preset }"
                  @click="applyRevenuePreset(preset)"
                >
                  {{ currency.format(preset) }}
                </button>
              </div>
            </div>

            <div class="field">
              <div class="field-heading is-inline">
                <label for="roi-direct-share">{{ interactiveContent.directShareLabel }}</label>
                <strong>{{ directShare }} %</strong>
              </div>

              <input
                id="roi-direct-share"
                v-model.number="directShare"
                class="range"
                type="range"
                min="5"
                max="70"
                step="5"
              />

              <div class="range-legend">
                <span>5 %</span>
                <span>70 %</span>
              </div>

              <p class="field-note">
                {{ interactiveContent.directShareNote }}
              </p>
            </div>
          </div>

          <div class="profit-banner">
            <span>{{ netGainLabel }} / an</span>
            <small>{{ avoidedVsSubscriptionMessage }}</small>
          </div>

          <p class="scenario-note is-soft">
            {{ breakEvenMessage }}
          </p>

          <div class="scenario-rows">
            <div class="row">
              <span>{{ content.scenario.revenueLabel }}</span>
              <strong>{{ annualRevenueLabel }}</strong>
            </div>
            <div class="row">
              <span>{{ content.scenario.otaCostLabel }}</span>
              <strong class="is-positive">{{ otaFeesAvoidedLabel }}</strong>
            </div>
            <div class="row">
              <span>{{ content.scenario.indiehostCostLabel }}</span>
              <strong class="is-negative">{{ superHostAnnualCostLabel }}</strong>
            </div>
            <div class="row is-highlight">
              <span>{{ interactiveContent.netGainLabel }}</span>
              <strong :class="netGain >= 0 ? 'is-positive' : 'is-negative'">{{ netGainLabel }}</strong>
            </div>
          </div>

          <p class="scenario-note">
            {{ props.content.scenario.note }}
          </p>
        </article>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/RoiSection/roi-section.scss';
</style>
