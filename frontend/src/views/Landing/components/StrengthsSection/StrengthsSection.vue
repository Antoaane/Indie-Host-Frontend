<!-- File: src/views/Landing/components/StrengthsSection/StrengthsSection.vue -->

<script setup lang="ts">
// DEPS
import { onMounted } from 'vue'
// UTILS
import detectOS from '@/utils/detectOs'
import { vp } from '@/utils/viewport'
import { useStrengthsAnim } from '@/views/Landing/components/StrengthsSection/utils/useStrengthsAnim'
import { useDropDown } from '@/views/Landing/components/StrengthsSection/utils/useDropDown'
// ASSETS
import { Wallet, ShieldCheck, Users, ChevronDown } from 'lucide-vue-next'
import ShapesCircle from '@/components/svgs/images/ShapesCircle.vue'
// CONTENT
import type { StrengthsContent } from '@/views/Landing/types/content'

const props = defineProps<{
  content: StrengthsContent
}>()

onMounted(async () => {
  const osInfo = await detectOS().catch(() => null)
  const normalizedOs = String(osInfo?.os ?? '').toLowerCase()
  const isIosMobile = !vp.lg.value && (normalizedOs === 'ios' || normalizedOs === 'ipados')

  if (!isIosMobile) {
    useStrengthsAnim()
  }

  if (!vp.lg.value) {
    useDropDown()
  }
})
</script>

<template>
  <section id="strengths-section">
    <ShapesCircle
      class="shapes-bg-circle"
      title="Décoration du fond"
      desc="Formes géométriques décoratives"
    />
    <div class="wrapper">
      <div class="title">
        <h2
          data-sr
          data-sr-y="-30"
          v-html="content.title"
        />
        <p
          data-sr
          data-sr-y="30"
          v-html="content.subtitle"
        />
      </div>

      <div class="strengths">
        <div
          v-for="(pillar, index) in content.pillars"
          :key="pillar.id"
          :id="'strength_' + pillar.id"
          data-sr
          data-sr-y="50"
          :data-sr-delay="index * 0.25"
          class="strength"
        >
          <span>
            <span>
              <span></span>
            </span>
          </span>
          <div>
            <div class="strength-title">
              <div class="icon-container">
                <component
                  :is="[Wallet, ShieldCheck, Users][index] || Wallet"
                  :size="24"
                  class="strength-icon"
                />
              </div>
              <h3 v-html="pillar.title" />
            </div>
            <span></span>
            <p v-html="pillar.description" />
            <div
              v-if="!vp.lg.value"
              class="trigger"
            >
              <p> Voir plus </p>
              <ChevronDown
                :size="20"
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
@use '@/views/Landing/components/StrengthsSection/strengths-section.scss';
@use '@/styles/variables/borders' as borders;

// .box {
//   @include borders.squircle(0.12);
//   width: 160px;
//   aspect-ratio: 1;
//   background: #3b3a40; /* <= indispensable pour VOIR le coin */
//   outline: 1px solid rgba(255, 255, 255, 0.25);
//   outline-offset: -1px;
// }
</style>
