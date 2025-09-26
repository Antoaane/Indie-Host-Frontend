<!-- File: src/views/Landing/components/JoinSection/JoinSection.vue -->

<script setup lang="ts">
// DEPS
import { computed } from 'vue'

// CONTENT
import type { ItemSection } from '@/content/types'
import rawContent from '@/content/fr/Landing/join-section.json'

// COMPONENTS
import FrenchFlag from '@/components/svgs/icons/FrenchFlag.vue'
import form from '@/views/Landing/components/JoinSection/components/FormComp/FormComp.vue'

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
</script>

<template>
  <section :id="section.id">
    <div class="container__xl">
      <!-- HEADER -->
      <div class="title">
        <!-- Drapeau (optionnel) -->
        <div>
          <component
            v-if="FlagComp"
            :is="FlagComp"
            class="french-flag"
            aria-hidden="true"
          />
          <h2 v-html="items['title-1']?.content" />
        </div>
        <p v-html="items['text-1']?.content" />
      </div>

      <!-- MAIN -->
      <div class="main">
        <div class="content">
          <p v-html="items['text-2']?.content" />
          <p v-html="items['text-3']?.content" />

          <div
            class="form-container"
            v-if="FormComp"
          >
            <!-- Le titre du formulaire est déjà dans meta.data.title -->
            <component
              :is="FormComp"
              v-bind="formProps"
            />
          </div>

          <!-- CTA secondaire (optionnel) -->
          <!-- <p v-if="items['cta-1']">
            <a
              class="cta"
              :href="cta.href"
              :target="cta.target"
              :rel="cta.rel"
              :aria-label="cta.ariaLabel"
              v-html="cta.content"
            />
          </p> -->
        </div>

        <div
          class="illustration"
          v-if="items['image-1']"
        >
          <img
            :src="imageSrc"
            :alt="imageAlt"
            loading="lazy"
            class="image"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/components/JoinSection/join-section.scss';
</style>
