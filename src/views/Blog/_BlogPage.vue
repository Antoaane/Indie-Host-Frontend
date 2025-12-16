<!-- File: src/views/Blog/_BlogPage.vue -->

<script setup lang="ts">
// DEPS
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { Search, X } from 'lucide-vue-next'
// COMPONENTS
import BlogHeroSection from './components/BlogHeroSection/BlogHeroSection.vue'
// UTILS
import { sr } from '@/utils/scrollReveal'
import detectOS from '@/utils/detectOs'

const os = ref<OSInfo | null>(null)
const showSearchModal = ref(false)
const searchQuery = ref('')

// Fonction pour ouvrir la recherche
const openSearch = () => {
  showSearchModal.value = true
  // Focus sur l'input après ouverture
  setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>('.search-modal__input')
    input?.focus()
  }, 100)
}

// Fonction pour fermer la recherche
const closeSearch = () => {
  showSearchModal.value = false
  searchQuery.value = ''
}

// Fonction de recherche
const handleSearchSubmit = (e: Event) => {
  e.preventDefault()
  if (searchQuery.value.trim()) {
    console.log('Recherche pour:', searchQuery.value)
    // TODO: Implémenter la logique de recherche ici
  }
}

// Détection OS
detectOS().then((res) => {
  os.value = res
  console.log(res)
  console.log(os.value?.os)
})

onMounted(() => {
  setTimeout(() => {
    if (os.value?.os === 'ios') return
    sr('[data-sr]')
  }, 500)

  // Écouter l'événement de recherche depuis NavBlog
  window.addEventListener('blog:search', openSearch)

  // Fermer avec la touche Escape
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && showSearchModal.value) {
      closeSearch()
    }
  }
  window.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  window.removeEventListener('blog:search', openSearch)
})
</script>

<template>
  <main
    id="blog-page"
    class="blog-page"
  >
    <div class="container__xl">
      <BlogHeroSection data-sr />

      <section class="blog-page__content"> </section>
    </div>

    <!-- Search Modal -->
    <Transition name="search-modal">
      <div
        v-if="showSearchModal"
        class="search-modal"
        @click.self="closeSearch"
      >
        <div class="search-modal__container">
          <div class="search-modal__header">
            <h2>Rechercher des articles</h2>
            <button
              class="search-modal__close"
              @click="closeSearch"
              aria-label="Fermer"
            >
              <X :size="24" />
            </button>
          </div>

          <form
            class="search-modal__form"
            @submit="handleSearchSubmit"
          >
            <div class="search-modal__input-wrapper">
              <Search
                :size="20"
                class="search-modal__icon"
              />
              <input
                v-model="searchQuery"
                type="text"
                class="search-modal__input"
                placeholder="Rechercher par titre, mots-clés..."
                autocomplete="off"
              />
            </div>
          </form>

          <div class="search-modal__results">
            <p
              v-if="!searchQuery"
              class="search-modal__placeholder"
            >
              Commencez à taper pour rechercher des articles...
            </p>
            <p v-else-if="searchQuery && !searchQuery.trim()">
              <!-- Pas de résultats -->
            </p>
            <div
              v-else
              class="search-modal__results-list"
            >
              <p>Résultats pour "{{ searchQuery }}"...</p>
              <!-- TODO: Afficher les résultats de recherche ici -->
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style lang="scss" src="@/views/Blog/_blog-page.scss"></style>
