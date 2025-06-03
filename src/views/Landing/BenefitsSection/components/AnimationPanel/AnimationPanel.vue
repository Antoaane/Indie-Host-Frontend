<!-- File: src/views/Landing/BenefitsSection/components/AnimationPanel/AnimationPanel.vue -->

<script setup lang="ts">
// DEPS
import { useBenefitsAnim } from '@/views/Landing/BenefitsSection/utils/useBenefitsAnim'

// ASSETS
import ShapesBg from '@/components/svgs/images/ShapesBg.vue'
import OtaBg from '@/components/svgs/images/OtaBg.vue'
import { icons } from '@/components/svgs'

defineProps<{
  total: number
  commissions: number
}>()

useBenefitsAnim() // init GSAP
</script>

<template>
  <div class="animation">
    <div id="indiehost">
      <ShapesBg
        class="shapes-bg"
        title="Décoration du fond"
        desc="Formes géométriques décoratives"
      />

      <div class="ih-title-container">
        <component
          :is="icons.logoFull.dark"
          class="logo-full"
          title="IndieHost"
          desc="Logo de IndieHost, plateforme de gestion de locations saisonnières"
          role="img"
        />
      </div>

      <div class="ih-total">
        <p> {{ total }} € </p>
      </div>
    </div>
    <div id="ota">
      <OtaBg
        class="ota-bg"
        title="Décoration du fond"
        desc="Formes géométriques décoratives"
      />

      <div class="ota-title-container">
        <p class="ota-title"> Plateformes<br />traditionnelles </p>
      </div>

      <div class="ota-total">
        <div class="losses">
          <p> - {{ commissions }} € </p>
        </div>
        <div class="total">
          <p> {{ total - commissions }} € </p>
        </div>
      </div>
    </div>
    <div class="gains">
      <div class="advantages">
        <div class="block">
          <p>
            <span class="focus">20 %</span><br />
            <span class="unfocus">de commissions<span class="line"></span></span><br />
          </p>
          <p id="plusvalue">
            pour <span class="focus">vous</span><br />
            et vos locataires <br />
          </p>
          <!-- after -->
        </div>
      </div>
      <div class="losses">
        <p> - 0 € </p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/views/Landing/BenefitsSection/components/AnimationPanel/animation-panel.scss';
</style>
