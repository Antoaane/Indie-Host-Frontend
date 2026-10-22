<!-- File: src/views/Legal/LegalPage.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useHead } from '@unhead/vue'
import { useRoute, useRouter } from 'vue-router'
import {
  findLegalPage,
  legalCanonicalOrigin,
  legalPages,
  legalUpdatedAtLabel,
  loadLegalContent,
} from '@/views/Legal/legalPages'

const route = useRoute()
const router = useRouter()

const page = computed(() => findLegalPage(route.params.page) ?? legalPages[0])
const content = ref('')
const canonicalUrl = computed(() => `${legalCanonicalOrigin}/legal/${page.value.slug}`)

watch(
  () => page.value.slug,
  async (slug) => {
    const html = await loadLegalContent(slug)
    if (page.value.slug === slug) content.value = html
  },
  { immediate: true },
)

useHead(() => ({
  title: `${page.value.title} | IndieHost`,
  link: [{ rel: 'canonical', href: canonicalUrl.value }],
  meta: [
    { name: 'description', content: page.value.description },
    { property: 'og:title', content: `${page.value.title} | IndieHost` },
    { property: 'og:description', content: page.value.description },
    { property: 'og:url', content: canonicalUrl.value },
  ],
}))

// Les liens internes des documents naviguent sans recharger l'application.
function onContentClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const anchor = (event.target as HTMLElement | null)?.closest('a')
  const href = anchor?.getAttribute('href') ?? ''
  if (!href.startsWith('/') || href.startsWith('//') || anchor?.target) return
  event.preventDefault()
  void router.push(href)
}
</script>

<template>
  <div class="legal-page">
    <div class="wrapper__md legal-page__inner">
      <div class="legal-page__header">
        <h1 class="legal-page__title">
          {{ page.title }}
        </h1>
        <p class="legal-page__updated">
          Dernière mise à jour : {{ legalUpdatedAtLabel }}
        </p>
      </div>

      <!-- Contenu rédigé par IndieHost et embarqué au build : aucune donnée utilisateur. -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <article
        class="legal-page__content"
        @click="onContentClick"
        v-html="content"
      />

      <nav
        class="legal-page__nav"
        aria-label="Informations légales"
      >
        <ul>
          <li
            v-for="item in legalPages"
            :key="item.slug"
          >
            <RouterLink
              :to="`/legal/${item.slug}`"
              :aria-current="item.slug === page.slug ? 'page' : undefined"
            >
              {{ item.navLabel }}
            </RouterLink>
          </li>
        </ul>
      </nav>
    </div>
  </div>
</template>

<style lang="scss" src="@/views/Legal/legal-page.scss"></style>
