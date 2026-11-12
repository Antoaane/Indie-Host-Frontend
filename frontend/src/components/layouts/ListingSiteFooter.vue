<!-- File: src/components/layouts/ListingSiteFooter.vue -->

<script setup lang="ts">
// Pied de page des pages d'un logement : le site de l'hôte (nom, une ligne, coordonnées), celui de sa
// page principale quand il en a une, puis les liens légaux avec son nom après le ©. L'hôte le modifie
// sur sa page principale (mode édition) ; sans page principale, nom et lieu du logement.
import { computed, ref, watch } from 'vue'
import { Mail, Phone } from 'lucide-vue-next'

import LegalLinksCompact from '@/components/layouts/LegalLinksCompact.vue'
import { fetchListingSite, type ListingSiteInfo } from '@/domain/api/listingHubs'

const props = defineProps<{
  listingId: string | null | undefined
}>()

const site = ref<ListingSiteInfo | null>(null)

watch(
  () => props.listingId,
  async (listingId) => {
    site.value = null
    const id = listingId?.trim()
    if (!id) return
    try {
      const info = await fetchListingSite(id)
      if (props.listingId?.trim() === id) site.value = info
    } catch {
      // Pied de page sans le nom du site : les liens légaux restent.
    }
  },
  { immediate: true },
)

const footer = computed(() => site.value?.footer ?? null)
const hasContact = computed(() => Boolean(footer.value?.email || footer.value?.phone))

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`
}
</script>

<template>
  <footer class="listing-site-footer">
    <div
      v-if="footer?.name"
      class="site"
    >
      <p class="name">
        {{ footer.name }}
      </p>
      <p
        v-if="footer.text"
        class="line"
      >
        {{ footer.text }}
      </p>
      <p
        v-if="hasContact"
        class="contact"
      >
        <a
          v-if="footer.email"
          :href="`mailto:${footer.email}`"
        >
          <Mail
            :size="14"
            aria-hidden="true"
          />
          {{ footer.email }}
        </a>
        <a
          v-if="footer.phone"
          :href="telHref(footer.phone)"
        >
          <Phone
            :size="14"
            aria-hidden="true"
          />
          {{ footer.phone }}
        </a>
      </p>
    </div>
    <LegalLinksCompact
      :owner="footer?.name || 'IndieHost'"
      :show-contact="!hasContact"
    />
  </footer>
</template>

<style lang="scss">
/* File: src/components/layouts/ListingSiteFooter.vue */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;

.listing-site-footer {
  display: flex;
  flex-direction: column;
  align-items: center;

  > .site {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--layout-gap-2xs);
    padding-inline: var(--layout-gap-sm);
    padding-top: var(--layout-gap);
    text-align: center;

    > .name {
      @include base-text($secondary, $thin: false);
    }

    > .line {
      @include little-text(rgba($secondary, 0.7));
    }

    > .contact {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      column-gap: var(--layout-gap-sm);
      @include little-text(rgba($secondary, 0.7));
    }

    > .contact > a {
      display: inline-flex;
      align-items: center;
      gap: var(--layout-gap-2xs);
      min-height: 2rem;
      overflow-wrap: anywhere;
      color: inherit;
      text-decoration: none;
      @include animations.transition(animations.$duration-fast, animations.$ease-out, color);

      @include on-hover {
        color: $secondary;
      }

      &:focus-visible {
        color: $secondary;
        outline: 2px solid $secondary;
        outline-offset: 2px;
        border-radius: borders.$rounded-xs;
      }
    }
  }
}
</style>
