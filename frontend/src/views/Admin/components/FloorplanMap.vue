<!-- File: src/views/Admin/components/FloorplanMap.vue -->

<!-- Carte du code d'IndieHost dessinée par floorplan : chaque partie du site et du serveur, chaque
     requête, les services extérieurs et les parcours principaux, en mots simples. Elle est servie
     par l'API à l'administration seulement, dans un cadre isolé (bac à sable sans accès au site). -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Maximize2, RefreshCw } from 'lucide-vue-next'

import type { FloorplanTicket } from '@/domain/api/admin'
import { useAdminDataSource } from '@/views/Admin/adminDataSource'
import { formatDate } from '@/views/Admin/adminFormat'

const source = useAdminDataSource()

const ticket = ref<FloorplanTicket | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const isFrameLoaded = ref(false)

async function open() {
  isLoading.value = true
  error.value = null
  isFrameLoaded.value = false
  try {
    ticket.value = await source.openFloorplan()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible d’ouvrir la carte du code.'
  } finally {
    isLoading.value = false
  }
}

// Le lien de la carte ne vaut que deux minutes : « Plein écran » en demande un neuf.
async function openFullscreen() {
  try {
    const fresh = await source.openFloorplan()
    if (fresh.url) window.open(fresh.url, '_blank', 'noopener')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible d’ouvrir la carte du code.'
  }
}

onMounted(open)
</script>

<template>
  <section
    class="admin-floorplan"
    aria-labelledby="admin-floorplan-title"
  >
    <header class="head">
      <div class="title">
        <h3 id="admin-floorplan-title">Carte du code</h3>
        <p>
          Dessinée par floorplan à partir du code : chaque partie d’IndieHost, ce qu’elle fait et avec quoi elle parle.
          <template v-if="ticket?.updatedAtISO">Mise à jour le {{ formatDate(ticket.updatedAtISO) }}.</template>
        </p>
      </div>
      <div
        v-if="ticket?.url"
        class="fullscreen"
      >
        <button
          type="button"
          @click="openFullscreen"
        >
          <Maximize2
            :size="16"
            aria-hidden="true"
          />
          Plein écran
        </button>
      </div>
    </header>

    <p
      v-if="isLoading && !ticket"
      class="state"
      role="status"
    >
      Ouverture de la carte…
    </p>

    <div
      v-else-if="error"
      class="state is-error"
      role="alert"
    >
      <p>{{ error }}</p>
      <div class="retry">
        <button
          type="button"
          @click="open"
        >
          <RefreshCw
            :size="16"
            aria-hidden="true"
          />
          Réessayer
        </button>
      </div>
    </div>

    <div
      v-else-if="ticket && !ticket.available"
      class="state"
    >
      <p>La carte n’a pas encore été publiée sur ce serveur.</p>
      <p class="hint">
        Pour la créer ou la mettre à jour, demandez à Claude dans ce projet : « mets à jour la carte floorplan et publie-la dans l’administration », puis redéployez l’API.
      </p>
    </div>

    <div
      v-else-if="ticket?.url"
      class="frame"
      :class="{ 'is-loaded': isFrameLoaded }"
    >
      <p
        v-if="!isFrameLoaded"
        class="loading"
        role="status"
      >
        Dessin de la carte…
      </p>
      <iframe
        :src="ticket.url"
        title="Carte du code d’IndieHost (floorplan)"
        sandbox="allow-scripts allow-popups allow-downloads"
        referrerpolicy="no-referrer"
        @load="isFrameLoaded = true"
      />
    </div>
  </section>
</template>

<style lang="scss">
/* File: src/views/Admin/components/FloorplanMap.vue */

@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/components/buttons' as buttons;

.admin-floorplan {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--layout-gap-sm);

  > .head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--layout-gap-sm);

    > .title {
      flex: 1 1 18rem;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-2xs);

      > h3 {
        margin: 0;
        @include h4-title($color: $secondary-text, $colorful: false, $bigger: false);
      }

      > p {
        max-width: 70ch;
        @include little-text(rgba($secondary-text, 0.72), $thin: false);
      }
    }

    > .fullscreen {
      flex: 0 0 auto;
      @include buttons.primary($theme: white, $little: true);
    }
  }

  > .state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--layout-gap-xs);
    @include base-text(rgba($secondary-text, 0.8), $thin: false);

    > .hint {
      max-width: 70ch;
      @include little-text(rgba($secondary-text, 0.72), $thin: false);
    }

    &.is-error > p {
      @include base-text($bad-ink, $bold: true);
    }

    > .retry {
      @include buttons.primary($theme: white, $little: true);
    }
  }

  > .frame {
    position: relative;
    // La carte a besoin de place : presque toute la hauteur de l'écran, sans déborder.
    height: min(78dvh, 56rem);
    min-height: 26rem;
    overflow: hidden;
    border-radius: borders.$rounded-lg;
    border: 1px solid rgba($secondary, 0.1);
    background: $accent-surface-0;

    > .loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      @include little-text(rgba($secondary-text, 0.72), $thin: false);
    }

    > iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
    }
  }
}
</style>
