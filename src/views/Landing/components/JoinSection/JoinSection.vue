<!-- File: src/views/Landing/components/JoinSection/JoinSection.vue -->

<script setup lang="ts">
// DEPS
import { computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
// COMPONENTS
import FrenchFlag from '@/components/svgs/icons/FrenchFlag.vue'
import form from '@/views/Landing/components/JoinSection/components/FormComp/FormComp.vue'
import Carousel from '@/views/Landing/components/HabitsSection/components/Carousel/Carousel.vue'
import SlidesTitles from '@/views/Landing/components/HabitsSection/components/SlidesTitles/SlidesTitles.vue'
// UTILS
import { vp } from '@/utils/viewport'
// CONTENT
import type { JoinContent, HabitsSlide } from '@/views/Landing/types/content'
// ASSETS
import RoadMapDark from '@/components/svgs/images/RoadMapDark.vue'

// Map des variantes "component" du JSON → composants Vue
const componentMap: Record<string, any> = {
  IconFrenchFlag: FrenchFlag,
  NewsletterForm: form,
}

const props = defineProps<{
  content: JoinContent
  slides: HabitsSlide[]
}>()

const slides = computed(() => props.slides ?? [])

const flagVariant = computed(() => props.content.flagIcon ?? '')
const FlagComp = computed(() => componentMap[flagVariant.value])

const formMeta = computed(() => props.content.form)
const FormComp = computed(() => componentMap[formMeta.value?.variant ?? ''])

const formProps = computed(() => ({
  data: {
    fields: formMeta.value?.fields ?? [],
    groups: formMeta.value?.groups ?? [],
    consents: formMeta.value?.consents ?? [],
    submit: formMeta.value?.submit,
  },
}))

let widgetId: number | null = null

function waitForHcaptcha(): Promise<void> {
  if ((window as any).hcaptcha) return Promise.resolve()
  return new Promise((res) => {
    const t = setInterval(() => {
      if ((window as any).hcaptcha) {
        clearInterval(t)
        res()
      }
    }, 50)
  })
}

onMounted(async () => {
  // si tu charges via GTM/Axeptio: api.js doit être avec `?render=explicit`
  await waitForHcaptcha()
  await nextTick() // s’assurer que le DOM de JoinSection est là

  const el = document.querySelector('.h-captcha') as HTMLElement | null
  if (!el) return

  // sécurité contre les conteneurs invisibles au moment du render
  const start = Date.now()
  while (el && (el.offsetHeight === 0 || getComputedStyle(el).display === 'none') && Date.now() - start < 3000) {
    await new Promise((r) => setTimeout(r, 50))
  }

  widgetId = (window as any).hcaptcha.render(el, {
    sitekey: el.getAttribute('data-sitekey') || 'TA_CLE_PUBLIQUE',
    size: 'normal',
    theme: 'light',
  })
})

onBeforeUnmount(() => {
  const hc = (window as any).hcaptcha
  if (hc && widgetId != null) {
    try {
      hc.reset(widgetId)
    } catch {}
  }
})
</script>

<template>
  <section id="join-section">
    <div class="wrapper">
      <div class="title">
        <div>
          <component
            v-if="FlagComp"
            :is="FlagComp"
            data-sr
            data-sr-y="-20"
            data-sr-delay="1.5"
            class="french-flag"
            aria-hidden="true"
          />
          <h2
            data-sr
            data-sr-delay="0.5"
            data-sr-y="-20"
            v-html="content.title"
          />
        </div>
        <p
          data-sr
          data-sr-y="20"
          data-sr-delay="1.25"
          v-html="content.description"
        />
      </div>

      <div
        data-sr
        data-sr-duration="1.5"
        class="roadmap"
      >
        <RoadMapDark />
      </div>
    </div>
    <div class="join-section-container">
      <div class="wrapper">
        <div class="main">
          <!-- data-sr
            data-sr-x="-100"
            data-sr-start="top 50%"
            data-sr-end="bottom 0%"
            data-sr-delay="0.75" -->
          <div
            class="illustration"
            v-if="slides.length"
          >
            <!-- <img
            :src="imageSrc"
            :alt="imageAlt"
            loading="lazy"
            class="image"
          /> -->
            <div class="overflow">
              <div class="carousel-container">
                <Carousel
                  v-if="vp.lg.value"
                  :slides="slides"
                />
                <SlidesTitles
                  v-if="!vp.lg.value"
                  :slides="slides"
                />
              </div>
            </div>
          </div>

          <div class="content">
            <!-- data-sr
              data-sr-x="100"
              data-sr-delay="0.75" -->
            <div
              class="form-container"
              v-if="FormComp"
            >
              <h3 v-html="formMeta.title" />
              <p v-html="formMeta.description" />
              <component
                :is="FormComp"
                v-bind="formProps"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Slide en grand -->
    <div
      id="slideDisplayRef"
      class="slide-display"
    />
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/JoinSection/join-section.scss';
</style>
