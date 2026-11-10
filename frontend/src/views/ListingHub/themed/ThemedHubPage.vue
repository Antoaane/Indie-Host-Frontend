<!-- File: src/views/ListingHub/themed/ThemedHubPage.vue -->

<!-- Page de présentation d'un hôte, habillée par un thème (`domain/listings/pageThemes.ts`).
     Composant de présentation pur : il reçoit le contenu et le thème, et remonte les modifications
     quand `editing` est vrai. Aucune requête ici. Voir `docs/editeur-de-page.md`. -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ImagePlus, MapPin, Trash2, Users } from 'lucide-vue-next'

import {
  buildPageThemeStyle,
  type AddablePageSectionType,
  type HubPageContent,
  type HubPageListing,
  type PageSection,
  type PageTheme,
} from '@/domain/listings/pageThemes'
import EditableText from '@/views/ListingHub/themed/EditableText.vue'
import SectionInserter from '@/views/ListingHub/themed/SectionInserter.vue'

/** Photo à remplacer : celle de l'en-tête, ou la n-ième d'une section. */
export type PageImageTarget =
  | { kind: 'cover' }
  | { kind: 'section'; sectionId: string; index: number }

type HeaderField = 'title' | 'tagline' | 'location'

const props = withDefaults(
  defineProps<{
    theme: PageTheme
    content: HubPageContent
    listings: HubPageListing[]
    editing?: boolean
  }>(),
  { editing: false },
)

const emit = defineEmits<{
  (e: 'update', patch: Partial<Pick<HubPageContent, HeaderField>>): void
  (e: 'update-section', sectionId: string, patch: { title?: string; text?: string }): void
  (e: 'add-section', index: number, type: AddablePageSectionType): void
  (e: 'remove-section', sectionId: string): void
  (e: 'pick-image', target: PageImageTarget, file: File): void
}>()

const root = ref<HTMLElement | null>(null)
const themeStyle = computed(() => buildPageThemeStyle(props.theme))

// Le fond du thème déborde de la page : sans lui, la marge de la barre de défilement et le rebond
// de fin de page restent à la couleur d'IndieHost (visible surtout avec un thème sombre).
function paintDocument(background: string, colorScheme: string) {
  if (typeof document === 'undefined') return
  document.body.style.backgroundColor = background
  document.documentElement.style.colorScheme = colorScheme
}

watch(() => props.theme, (theme) => paintDocument(theme.colors.bg, theme.colorScheme), { immediate: true })
onBeforeUnmount(() => paintDocument('', ''))

// --- Sections ---------------------------------------------------------------------------

// Une section « texte et photo » sur deux inverse ses colonnes, pour ne pas empiler deux blocs identiques.
const flippedSectionIds = computed(() => {
  const ids = new Set<string>()
  let rank = 0
  for (const section of props.content.sections) {
    if (section.type !== 'text-image') continue
    if (rank % 2 === 1) ids.add(section.id)
    rank += 1
  }
  return ids
})

// La signature de l'hôte suit le premier bloc « texte et photo » uniquement.
const signedSectionId = computed(() => props.content.sections.find((section) => section.type === 'text-image')?.id ?? null)

/** Hors édition, une section vide n'existe pas pour le voyageur. */
function isSectionVisible(section: PageSection): boolean {
  if (props.editing || section.type === 'listings') return true
  if (section.title.trim()) return true
  if (section.type === 'gallery') return section.images.some(Boolean)
  if (section.text.trim()) return true
  return section.type === 'text-image' && Boolean(section.imageSrc)
}

function showText(value: string): boolean {
  return props.editing || Boolean(value.trim())
}

// --- « + » entre les sections ---------------------------------------------------------------

const openInserterIndex = ref<number | null>(null)
let pendingFocusIndex: number | null = null

function toggleInserter(index: number) {
  openInserterIndex.value = openInserterIndex.value === index ? null : index
}

function addSection(index: number, type: AddablePageSectionType) {
  openInserterIndex.value = null
  pendingFocusIndex = index
  emit('add-section', index, type)
}

// La section ajoutée reçoit le curseur dans son titre : l'hôte tape tout de suite.
watch(() => props.content.sections.length, async () => {
  if (pendingFocusIndex === null) return
  const index = pendingFocusIndex
  pendingFocusIndex = null
  await nextTick()
  const section = root.value?.querySelector<HTMLElement>(`[data-section-index="${index}"]`)
  section?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  section?.querySelector<HTMLElement>('.editable-text')?.focus({ preventScroll: true })
})

watch(() => props.editing, (editing) => {
  if (!editing) openInserterIndex.value = null
})

// --- Champs ---------------------------------------------------------------------------------

function updateHeader(field: HeaderField, value: string) {
  emit('update', { [field]: value })
}

function onImagePicked(target: PageImageTarget, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('pick-image', target, file)
  input.value = ''
}

function formatPrice(value: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function guestsLabel(count: number | null): string | null {
  if (!count) return null
  return `${count} voyageur${count > 1 ? 's' : ''}`
}

// En édition, les cartes ne naviguent pas : un clic sert à modifier, pas à quitter la page.
function onCardClick(event: MouseEvent) {
  if (props.editing) event.preventDefault()
}
</script>

<template>
  <article
    ref="root"
    class="themed-hub-page"
    :class="{ 'is-editing': editing }"
    :data-theme="theme.id"
    :style="themeStyle"
  >
    <header class="page-hero">
      <div class="hero-text">
        <p
          v-if="showText(content.location)"
          class="hero-location"
        >
          <MapPin
            :size="16"
            aria-hidden="true"
          />
          <EditableText
            tag="span"
            label="Lieu"
            :model-value="content.location"
            :editing="editing"
            :max-length="80"
            @update:model-value="updateHeader('location', $event)"
          />
        </p>
        <EditableText
          tag="h1"
          label="Titre de la page"
          :model-value="content.title"
          :editing="editing"
          :max-length="80"
          @update:model-value="updateHeader('title', $event)"
        />
        <EditableText
          v-if="showText(content.tagline)"
          tag="p"
          class="hero-tagline"
          label="Phrase d’accroche"
          :model-value="content.tagline"
          :editing="editing"
          :max-length="180"
          @update:model-value="updateHeader('tagline', $event)"
        />
        <a
          class="page-button"
          href="#logements"
        >
          Voir les logements
        </a>
      </div>

      <div class="hero-media">
        <img
          v-if="content.coverSrc"
          :src="content.coverSrc"
          alt=""
        />
        <label
          v-if="editing"
          class="media-edit"
        >
          <ImagePlus
            :size="18"
            aria-hidden="true"
          />
          Changer la photo
          <input
            class="sr-only"
            type="file"
            accept="image/*"
            @change="onImagePicked({ kind: 'cover' }, $event)"
          >
        </label>
      </div>
    </header>

    <template
      v-for="(section, index) in content.sections"
      :key="section.id"
    >
      <SectionInserter
        v-if="editing"
        :open="openInserterIndex === index"
        @toggle="toggleInserter(index)"
        @add="addSection(index, $event)"
      />

      <!-- Texte et photo -->
      <section
        v-if="section.type === 'text-image' && isSectionVisible(section)"
        class="page-about"
        :class="{ 'is-flipped': flippedSectionIds.has(section.id) }"
        :data-section-index="index"
      >
        <button
          v-if="editing"
          type="button"
          class="section-remove"
          @click="emit('remove-section', section.id)"
        >
          <Trash2
            :size="16"
            aria-hidden="true"
          />
          <span class="remove-label">Supprimer la section</span>
        </button>

        <div class="about-text">
          <EditableText
            v-if="showText(section.title)"
            tag="h2"
            label="Titre de la section"
            :model-value="section.title"
            :editing="editing"
            :max-length="80"
            @update:model-value="emit('update-section', section.id, { title: $event })"
          />
          <EditableText
            v-if="showText(section.text)"
            tag="p"
            class="about-body"
            label="Écrivez votre texte ici"
            multiline
            :model-value="section.text"
            :editing="editing"
            :max-length="1200"
            @update:model-value="emit('update-section', section.id, { text: $event })"
          />
          <p
            v-if="content.hostName && section.id === signedSectionId"
            class="about-signature"
          >
            {{ content.hostName }}, votre hôte
          </p>
        </div>

        <div
          v-if="section.imageSrc || editing"
          class="about-media"
        >
          <img
            v-if="section.imageSrc"
            :src="section.imageSrc"
            alt=""
            loading="lazy"
          />
          <label
            v-if="editing"
            class="media-edit"
          >
            <ImagePlus
              :size="18"
              aria-hidden="true"
            />
            {{ section.imageSrc ? 'Changer la photo' : 'Ajouter une photo' }}
            <input
              class="sr-only"
              type="file"
              accept="image/*"
              @change="onImagePicked({ kind: 'section', sectionId: section.id, index: 0 }, $event)"
            >
          </label>
        </div>
      </section>

      <!-- Texte seul -->
      <section
        v-else-if="section.type === 'text' && isSectionVisible(section)"
        class="page-text"
        :data-section-index="index"
      >
        <button
          v-if="editing"
          type="button"
          class="section-remove"
          @click="emit('remove-section', section.id)"
        >
          <Trash2
            :size="16"
            aria-hidden="true"
          />
          <span class="remove-label">Supprimer la section</span>
        </button>

        <EditableText
          v-if="showText(section.title)"
          tag="h2"
          label="Titre de la section"
          :model-value="section.title"
          :editing="editing"
          :max-length="80"
          @update:model-value="emit('update-section', section.id, { title: $event })"
        />
        <EditableText
          v-if="showText(section.text)"
          tag="p"
          class="text-body"
          label="Écrivez votre texte ici"
          multiline
          :model-value="section.text"
          :editing="editing"
          :max-length="1200"
          @update:model-value="emit('update-section', section.id, { text: $event })"
        />
      </section>

      <!-- Photos -->
      <section
        v-else-if="section.type === 'gallery' && isSectionVisible(section)"
        class="page-gallery"
        :data-section-index="index"
      >
        <button
          v-if="editing"
          type="button"
          class="section-remove"
          @click="emit('remove-section', section.id)"
        >
          <Trash2
            :size="16"
            aria-hidden="true"
          />
          <span class="remove-label">Supprimer la section</span>
        </button>

        <EditableText
          v-if="showText(section.title)"
          tag="h2"
          label="Titre de la section"
          :model-value="section.title"
          :editing="editing"
          :max-length="80"
          @update:model-value="emit('update-section', section.id, { title: $event })"
        />

        <ul class="gallery-grid">
          <template
            v-for="(image, imageIndex) in section.images"
            :key="imageIndex"
          >
            <li
              v-if="image || editing"
              class="gallery-item"
            >
              <img
                v-if="image"
                :src="image"
                alt=""
                loading="lazy"
              />
              <label
                v-if="editing"
                class="media-edit"
              >
                <ImagePlus
                  :size="18"
                  aria-hidden="true"
                />
                {{ image ? 'Changer la photo' : 'Ajouter une photo' }}
                <input
                  class="sr-only"
                  type="file"
                  accept="image/*"
                  @change="onImagePicked({ kind: 'section', sectionId: section.id, index: imageIndex }, $event)"
                >
              </label>
            </li>
          </template>
        </ul>
      </section>

      <!-- Logements : toujours présente, jamais supprimable -->
      <section
        v-else-if="section.type === 'listings'"
        id="logements"
        class="page-listings"
        :data-section-index="index"
      >
        <EditableText
          v-if="showText(section.title)"
          tag="h2"
          label="Titre de la liste des logements"
          :model-value="section.title"
          :editing="editing"
          :max-length="80"
          @update:model-value="emit('update-section', section.id, { title: $event })"
        />

        <ul class="listing-grid">
          <li
            v-for="listing in listings"
            :key="listing.id"
          >
            <a
              class="listing-card"
              :href="listing.href"
              @click="onCardClick"
            >
              <span class="card-media">
                <img
                  v-if="listing.coverSrc"
                  :src="listing.coverSrc"
                  :alt="listing.title"
                  loading="lazy"
                />
              </span>
              <span class="card-body">
                <strong class="card-title">{{ listing.title }}</strong>
                <span class="card-facts">
                  <span
                    v-if="listing.city"
                    class="card-fact"
                  >
                    <MapPin
                      :size="14"
                      aria-hidden="true"
                    />
                    {{ listing.city }}
                  </span>
                  <span
                    v-if="guestsLabel(listing.guestCapacity)"
                    class="card-fact"
                  >
                    <Users
                      :size="14"
                      aria-hidden="true"
                    />
                    {{ guestsLabel(listing.guestCapacity) }}
                  </span>
                </span>
                <span
                  v-if="formatPrice(listing.pricePerNight)"
                  class="card-price"
                >
                  À partir de {{ formatPrice(listing.pricePerNight) }} / nuit
                </span>
              </span>
            </a>
          </li>
        </ul>
      </section>
    </template>

    <SectionInserter
      v-if="editing"
      :open="openInserterIndex === content.sections.length"
      @toggle="toggleInserter(content.sections.length)"
      @add="addSection(content.sections.length, $event)"
    />

    <footer class="page-footer">
      <p
        v-if="content.hostName"
        class="footer-host"
      >
        {{ content.title }}, proposé par {{ content.hostName }}
      </p>
      <slot name="footer" />
    </footer>
  </article>
</template>

<style lang="scss">
@use '@/views/ListingHub/themed/themed-hub-page.scss';
</style>
