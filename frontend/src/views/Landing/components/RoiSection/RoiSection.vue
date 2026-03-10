<!-- File: src/views/Landing/components/RoiSection/RoiSection.vue -->

<script setup lang="ts">
import type { RoiSectionContent } from '@/views/Landing/types/content'

defineProps<{
  content: RoiSectionContent
}>()
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

          <div class="scenario-rows">
            <div class="row">
              <span>{{ content.scenario.revenueLabel }}</span>
              <strong>{{ content.scenario.revenueValue }}</strong>
            </div>
            <div class="row">
              <span>{{ content.scenario.otaCostLabel }}</span>
              <strong class="is-negative">{{ content.scenario.otaCostValue }}</strong>
            </div>
            <div class="row">
              <span>{{ content.scenario.indiehostCostLabel }}</span>
              <strong>{{ content.scenario.indiehostCostValue }}</strong>
            </div>
            <div class="row is-highlight">
              <span>{{ content.scenario.savingsLabel }}</span>
              <strong class="is-positive">{{ content.scenario.savingsValue }}</strong>
            </div>
          </div>

          <p class="scenario-note">
            {{ content.scenario.note }}
          </p>
        </article>

        <article
          class="bullets"
          data-sr
          data-sr-y="40"
          data-sr-delay="0.12"
        >
          <h3>Ce que cela change</h3>
          <ul>
            <li
              v-for="bullet in content.bullets"
              :key="bullet"
            >
              {{ bullet }}
            </li>
          </ul>
        </article>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/RoiSection/roi-section.scss';
</style>
