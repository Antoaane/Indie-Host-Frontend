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
import type { ItemSection } from '@/content/types'
import rawContent from '@/content/fr/Landing/join-section.json'
// ASSETS
import RoadMapDark from '@/components/svgs/images/RoadMapDark.vue'

// Map des variantes "component" du JSON → composants Vue
const componentMap: Record<string, any> = {
  IconFrenchFlag: FrenchFlag,
  NewsletterForm: form,
}

const section = rawContent as ItemSection

// Helpers pour accéder aux items
const items = section.items

const flagVariant = computed(() => items['icon-flag']?.meta?.variant ?? '')
const FlagComp = computed(() => componentMap[flagVariant.value])

const formMeta = computed(() => items['form-1']?.meta ?? {})
const FormComp = computed(() => componentMap[formMeta.value?.variant ?? ''])

const imageSrc = computed(() => items['image-1']?.content ?? '')
const imageAlt = computed(() => items['image-1']?.meta?.alt ?? '')

const cta = computed(() => ({
  href: items['cta-1']?.meta?.href ?? '#',
  target: items['cta-1']?.meta?.target ?? '_self',
  rel: items['cta-1']?.meta?.rel ?? undefined,
  ariaLabel: items['cta-1']?.meta?.ariaLabel ?? undefined,
  content: items['cta-1']?.content ?? '',
}))

// Props/slots pour le composant "component" (formulaire)
const formProps = computed(() => {
  // `props` est une string dans le JSON pour être homogène ; on parse s'il y a quelque chose d'utile
  const rawProps = formMeta.value?.props
  let parsedProps: Record<string, any> = {}
  if (rawProps && typeof rawProps === 'string' && rawProps.trim()) {
    try {
      parsedProps = JSON.parse(rawProps)
    } catch {
      // on ignore silencieusement si non-JSON (ex: chaîne vide)
    }
  }
  return { ...(parsedProps || {}), data: formMeta.value?.data }
})

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
  <section :id="section.id">
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
            v-html="items['title-1']?.content"
          />
        </div>
        <p
          data-sr
          data-sr-y="20"
          data-sr-delay="1.25"
          v-html="items['text-2']?.content"
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
    <div :class="section.id + '-container'">
      <div class="wrapper">
        <div class="main">
          <!-- data-sr
            data-sr-x="-100"
            data-sr-start="top 50%"
            data-sr-end="bottom 0%"
            data-sr-delay="0.75" -->
          <div
            class="illustration"
            v-if="items['image-1']"
          >
            <!-- <img
            :src="imageSrc"
            :alt="imageAlt"
            loading="lazy"
            class="image"
          /> -->
            <div class="overflow">
              <div class="carousel-container">
                <Carousel v-if="vp.lg.value" />
                <SlidesTitles v-if="!vp.lg.value" />
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
              <h3 v-html="items['title-2'].content" />
              <p v-html="items['text-3']?.content" />
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
