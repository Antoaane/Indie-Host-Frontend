<!-- File: src/views/Landing/StrengthsSection/StrengthsSection.vue -->

<script setup lang="ts">
// DEPS
import { onMounted } from 'vue'
// UTILS
import { vp } from '@/utils/viewport'
import { useStrengthsAnim } from '@/views/Landing/StrengthsSection/utils/useStrengthsAnim'
import { useDropDown } from '@/views/Landing/StrengthsSection/utils/useDropDown'
// ASSETS
import { Wallet, ShieldCheck, Users, ChevronDown } from 'lucide-vue-next'
// CONTENT
import type { ItemSection } from '@/content/types'
import rawContent from '@/content/fr/Landing/strengths-section.json'

const section = rawContent as ItemSection

useStrengthsAnim()

onMounted(() => {
  if (!vp.lg.value) {
    useDropDown()
  }
})
</script>

<template>
  <section id="strengths-section">
    <div class="container">
      <div class="title">
        <h2 v-html="section.items['title-1'].content" />
        <p v-html="section.items['subtitle-1'].content" />
      </div>

      <div class="strengths">
        <div
          class="strength"
          id="strength_1"
        >
          <span>
            <span>
              <span></span>
            </span>
          </span>
          <div>
            <div class="strength-title">
              <div class="icon-container">
                <Wallet
                  :size="24"
                  class="strength-icon"
                />
              </div>
              <h3 v-html="section.items['card-1-title'].content" />
            </div>
            <span></span>
            <p v-html="section.items['card-1-text'].content" />
            <div
              v-if="!vp.lg.value"
              class="trigger"
            >
              <p> Voir plus </p>
              <ChevronDown
                :size="16"
                class="chevron-down"
              />
            </div>
          </div>
        </div>
        <div
          class="strength"
          id="strength_2"
        >
          <span>
            <span>
              <span></span>
            </span>
          </span>
          <div>
            <div class="strength-title">
              <div class="icon-container">
                <ShieldCheck
                  :size="24"
                  class="strength-icon"
                />
              </div>
              <h3 v-html="section.items['card-2-title'].content" />
            </div>
            <span></span>
            <p v-html="section.items['card-2-text'].content" />
            <div
              v-if="!vp.lg.value"
              class="trigger"
            >
              <p> Voir plus </p>
              <ChevronDown
                :size="16"
                class="chevron-down"
              />
            </div>
          </div>
        </div>
        <div
          class="strength"
          id="strength_3"
        >
          <span>
            <span>
              <span></span>
            </span>
          </span>
          <div>
            <div class="strength-title">
              <div class="icon-container">
                <Users
                  :size="24"
                  class="strength-icon"
                />
              </div>
              <h3 v-html="section.items['card-3-title'].content" />
            </div>
            <span></span>
            <p v-html="section.items['card-3-text'].content" />
            <div
              v-if="!vp.lg.value"
              class="trigger"
            >
              <p> Voir plus </p>
              <ChevronDown
                :size="16"
                class="chevron-down"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/StrengthsSection/strengths-section.scss';
@use '@/styles/variables/borders' as borders;

.box {
  @include borders.squircle(0.12);
  width: 160px;
  aspect-ratio: 1;
  background: #3b3a40; /* <= indispensable pour VOIR le coin */
  outline: 1px solid rgba(255, 255, 255, 0.25);
  outline-offset: -1px;
}
</style>
