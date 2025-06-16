<!-- File: src/views/Landing/BenefitsSection/components/AnimationPanel/AnimationPanel.vue -->

<script setup lang="ts">
// DEPS
import { useBenefitsAnim, commissionsAnim, totalOta, displayTotalOta } from '@/views/Landing/BenefitsSection/utils/useBenefitsAnim'
import { onMounted, watch } from 'vue'

// UTILS
import { vp } from '@/utils/viewport'

// ASSETS
import ShapesBg from '@/components/svgs/images/ShapesBg.vue'
import OtaBg from '@/components/svgs/images/OtaBg.vue'
import { icons } from '@/components/svgs'
import { ref } from 'vue'

const props = defineProps<{
  total: number
  commissions: number
}>()

onMounted(() => {
  // console.log(props.total)
  commissionsAnim.value = props.commissions
  totalOta.value = props.total
})

useBenefitsAnim() // init GSAP
</script>

<template>
  <div :class="`animation-${vp.lg.value ? 'desktop' : 'mobile'}`">
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
        <p class="total"> {{ total }} € </p>
        <!-- <p class="conclusion"><span>100%</span> de vos revenus vous reviennent </p> -->
        <p class="conclusion">100% de vos revenus vous reviennent </p>
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
        <!-- <div class="losses">
          <p> - {{ props.commissions }} € </p>
        </div> -->
        <div class="total">
          <p>
            <span
              class="total-ota"
              v-html="`${displayTotalOta} €`"
            />
            <span class="total-losses">
              <span>- {{ props.commissions }} €</span>
            </span>
          </p>
        </div>
      </div>
    </div>
    <div class="gains">
      <div class="advantages">
        <div
          class="block"
          v-if="vp.lg.value"
        >
          <p>
            <span class="focus">20 %</span><br />
            <span class="unfocus">de commissions<span class="line"></span></span><br />
          </p>
          <p id="plusvalue">
            pour <span class="focus">vous</span><br />
            et vos locataires <br />
          </p>
        </div>
        <div
          class="block"
          v-else
        >
          <p>
            <span class="focus">20 % </span>
            <span id="plusvalue">pour <span class="focus">vous</span> et vos locataires</span>
          </p>
        </div>
      </div>
      <div class="losses">
        <!-- <p> - 0 € </p> -->
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/views/Landing/BenefitsSection/components/AnimationPanel/animation-panel.scss';
</style>
