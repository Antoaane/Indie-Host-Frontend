<!-- File: src/views/ListingHub/themed/ThemedHubPage.vue -->

<!-- Page de présentation d'un hôte, habillée par un thème (`domain/listings/pageThemes.ts`).
     Composant de présentation pur : il reçoit le contenu et le thème, et remonte les modifications
     quand `editing` est vrai. Aucune requête ici. Voir `docs/editeur-de-page.md`. -->

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ImagePlus, Mail, MapPin, Phone, Star, Trash2, Users } from 'lucide-vue-next'

import { PAGE_LIMITS, normalizeFooterEmail, normalizeFooterPhone } from '@/domain/listings/hubPageContent'
import {
  RATING_PLATFORMS,
  buildPageThemeStyle,
  normalizeRatingScore,
  normalizeReviewCount,
  resolveRatingPlatform,
  type AddablePageSectionType,
  type HubPageContent,
  type HubPageListing,
  type PageRatingSection,
  type PageSection,
  type PageSectionPatch,
  type PageTheme,
  type RatingPlatform,
  type SiteFooter,
  type SiteFooterField,
} from '@/domain/listings/pageThemes'
import AirbnbLogo from '@/components/svgs/icons/AirbnbLogo.vue'
import BookingLogo from '@/components/svgs/icons/BookingLogo.vue'
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
    /** Rendue dans un cadre (aperçu de l'éditeur) : ne repeint pas le document, ne force pas la hauteur d'écran. */
    embedded?: boolean
    /** Affiché à la place de la grille quand il n'y a pas de logement à montrer (chargement, erreur, aucun en ligne). */
    listingsMessage?: string | null
    listingsMessageIsError?: boolean
  }>(),
  { editing: false, embedded: false, listingsMessage: null, listingsMessageIsError: false },
)

const emit = defineEmits<{
  (e: 'update', patch: Partial<Pick<HubPageContent, HeaderField>>): void
  (e: 'update-footer', patch: Partial<SiteFooter>): void
  (e: 'update-section', sectionId: string, patch: PageSectionPatch): void
  (e: 'add-section', index: number, type: AddablePageSectionType): void
  (e: 'remove-section', sectionId: string): void
  (e: 'pick-image', target: PageImageTarget, file: File): void
  /** Clic sur une carte hors édition : le parent décide de la navigation (routeur, nouvel onglet…). */
  (e: 'open-listing', listing: HubPageListing, event: MouseEvent): void
}>()

const root = ref<HTMLElement | null>(null)
const themeStyle = computed(() => buildPageThemeStyle(props.theme))

// Le fond du thème déborde de la page : sans lui, la marge de la barre de défilement et le rebond
// de fin de page restent à la couleur d'IndieHost (visible surtout avec un thème sombre).
function paintDocument(background: string, colorScheme: string) {
  if (typeof document === 'undefined' || props.embedded) return
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

/** Hors édition, une section vide n'existe pas pour le voyageur. Une note sans chiffre non plus. */
function isSectionVisible(section: PageSection): boolean {
  if (props.editing || section.type === 'listings') return true
  if (section.type === 'rating') return section.score !== null
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
  // Une note a déjà un titre : le curseur va dans le chiffre.
  const field = section?.querySelector<HTMLElement>('[data-autofocus]') ?? section?.querySelector<HTMLElement>('.editable-text')
  field?.focus({ preventScroll: true })
})

watch(() => props.editing, (editing) => {
  if (!editing) openInserterIndex.value = null
})

// --- Champs ---------------------------------------------------------------------------------

function updateHeader(field: HeaderField, value: string) {
  emit('update', { [field]: value })
}

function updateFooter(field: SiteFooterField, value: string) {
  emit('update-footer', { [field]: value })
}

// E-mail et téléphone : une saisie qui n'en est pas un est refusée, le champ reprend l'ancien texte.
const formatFooterEmail = (typed: string) => normalizeFooterEmail(typed)
const formatFooterPhone = (typed: string) => normalizeFooterPhone(typed)

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`
}

const hasFooterContact = computed(() => Boolean(props.content.footer.email || props.content.footer.phone))

function onImagePicked(target: PageImageTarget, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('pick-image', target, file)
  input.value = ''
}

// --- Note Booking ou Airbnb -------------------------------------------------------------

/** Note telle que la plateforme l'écrit : « 9,6 » et « 10 » chez Booking, « 4,92 » et « 5,0 » chez Airbnb. */
function formatRatingScore(score: number | null, platformId: RatingPlatform): string {
  if (score === null) return ''
  const platform = resolveRatingPlatform(platformId)
  const minimumFractionDigits = platformId === 'booking' && score === platform.scale ? 0 : 1
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits, maximumFractionDigits: platform.decimals }).format(score)
}

/** Note saisie : un nombre dans l'échelle de la plateforme (« 9,6 », « 9.6/10 ») ; `null` : effacée ; `undefined` : refusée. */
function parseRatingInput(typed: string, platformId: RatingPlatform): number | null | undefined {
  if (!typed.trim()) return null
  const match = typed.replace(',', '.').match(/\d+(?:\.\d+)?/)
  if (!match) return undefined
  return normalizeRatingScore(Number(match[0]), platformId) ?? undefined
}

function ratingScoreFormatter(platformId: RatingPlatform) {
  return (typed: string): string | null => {
    const score = parseRatingInput(typed, platformId)
    return score === undefined ? null : formatRatingScore(score, platformId)
  }
}

function formatReviewCount(count: number | null): string {
  return count === null ? '' : new Intl.NumberFormat('fr-FR').format(count)
}

/** Nombre saisi (« 7 », « 1 234 », « 7 commentaires ») ; `null` : effacé ; `undefined` : refusé. */
function parseReviewCountInput(typed: string): number | null | undefined {
  if (!typed.trim()) return null
  const match = typed.match(/\d[\d\s.  ]*/)
  if (!match) return undefined
  return normalizeReviewCount(Number(match[0].replace(/\D/g, ''))) ?? undefined
}

function reviewCountFormatter(typed: string): string | null {
  const count = parseReviewCountInput(typed)
  return count === undefined ? null : formatReviewCount(count)
}

function reviewsWord(count: number | null): string {
  return count !== null && count > 1 ? 'commentaires' : 'commentaire'
}

/** Phrase lue par les lecteurs d'écran à la place du bloc visuel. */
function ratingSummary(section: PageRatingSection): string {
  const platform = resolveRatingPlatform(section.platform)
  const parts = [`${platform.name} : ${formatRatingScore(section.score, section.platform)} sur ${platform.scale}`]
  if (section.label.trim()) parts.push(section.label.trim())
  if (section.reviewCount !== null) parts.push(`${formatReviewCount(section.reviewCount)} ${reviewsWord(section.reviewCount)}`)
  return `${parts.join(', ')}.`
}

function updateRatingScore(section: PageRatingSection, typed: string) {
  const score = parseRatingInput(typed, section.platform)
  if (score !== undefined) emit('update-section', section.id, { score })
}

function updateReviewCount(section: PageRatingSection, typed: string) {
  const reviewCount = parseReviewCountInput(typed)
  if (reviewCount !== undefined) emit('update-section', section.id, { reviewCount })
}

// Les échelles diffèrent (sur 10, sur 5) : changer de plateforme efface la note, à ressaisir.
function setRatingPlatform(section: PageRatingSection, platform: RatingPlatform) {
  if (section.platform === platform) return
  emit('update-section', section.id, { platform, score: null })
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
function onCardClick(event: MouseEvent, listing: HubPageListing) {
  if (props.editing) {
    event.preventDefault()
    return
  }
  emit('open-listing', listing, event)
}

const hasHeroMedia = computed(() => Boolean(props.content.coverSrc) || props.editing)
</script>

<template>
  <article
    ref="root"
    class="themed-hub-page theme-light"
    :class="{ 'is-editing': editing, 'is-embedded': embedded }"
    :data-theme="theme.id"
    :style="themeStyle"
  >
    <header
      class="page-hero"
      :class="{ 'has-media': hasHeroMedia }"
    >
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
          required
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
          v-if="listings.length"
          class="page-button"
          href="#logements"
        >
          Voir les logements
        </a>
      </div>

      <div
        v-if="hasHeroMedia"
        class="hero-media"
      >
        <img
          v-if="content.coverSrc"
          :src="content.coverSrc"
          :alt="content.coverAlt"
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

      <!-- Note Booking ou Airbnb : recopiée par l'hôte, avec le logo de la plateforme -->
      <section
        v-else-if="section.type === 'rating' && isSectionVisible(section)"
        class="page-rating"
        :data-platform="section.platform"
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

        <div
          v-if="editing"
          class="rating-platforms"
          role="radiogroup"
          aria-label="Plateforme de la note"
        >
          <button
            v-for="platform in RATING_PLATFORMS"
            :key="platform.id"
            type="button"
            role="radio"
            class="platform-option"
            :aria-checked="section.platform === platform.id"
            @click="setRatingPlatform(section, platform.id)"
          >
            <BookingLogo
              v-if="platform.id === 'booking'"
              class="platform-logo"
            />
            <AirbnbLogo
              v-else
              class="platform-logo"
            />
            {{ platform.name }}
          </button>
        </div>

        <p
          v-if="!editing"
          class="sr-only"
        >
          {{ ratingSummary(section) }}
        </p>

        <div
          class="rating-card"
          :aria-hidden="editing ? undefined : 'true'"
        >
          <p class="rating-score">
            <Star
              v-if="section.platform === 'airbnb'"
              class="score-star"
              aria-hidden="true"
            />
            <EditableText
              tag="span"
              class="score-value"
              data-autofocus
              label="Note"
              inputmode="decimal"
              :model-value="formatRatingScore(section.score, section.platform)"
              :format="ratingScoreFormatter(section.platform)"
              :editing="editing"
              :max-length="8"
              @update:model-value="updateRatingScore(section, $event)"
            />
            <span class="score-scale">/{{ resolveRatingPlatform(section.platform).scale }}</span>
          </p>

          <div class="rating-details">
            <EditableText
              v-if="showText(section.label)"
              tag="p"
              class="rating-label"
              label="Appréciation (ex. Exceptionnel)"
              :model-value="section.label"
              :editing="editing"
              :max-length="40"
              @update:model-value="emit('update-section', section.id, { label: $event })"
            />
            <p
              v-if="editing || section.reviewCount !== null"
              class="rating-count"
            >
              <EditableText
                tag="span"
                label="Nombre de commentaires"
                inputmode="numeric"
                :model-value="formatReviewCount(section.reviewCount)"
                :format="reviewCountFormatter"
                :editing="editing"
                :max-length="16"
                @update:model-value="updateReviewCount(section, $event)"
              />
              <!-- Espace insécable : Vue retire l'espace en tête d'un élément, et « 7 commentaires » ne se coupe pas. -->
              <span v-if="section.reviewCount !== null">&nbsp;{{ reviewsWord(section.reviewCount) }}</span>
            </p>
            <p class="rating-source">
              <BookingLogo
                v-if="section.platform === 'booking'"
                class="source-logo"
              />
              <AirbnbLogo
                v-else
                class="source-logo"
              />
              Note des voyageurs sur {{ resolveRatingPlatform(section.platform).name }}
            </p>
          </div>
        </div>

        <p
          v-if="editing"
          class="rating-hint"
        >
          Recopiez la note, l’appréciation et le nombre de commentaires affichés sur
          {{ resolveRatingPlatform(section.platform).name }}. Sans note, la section n’apparaît pas aux voyageurs.
        </p>
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

        <p
          v-if="!listings.length && listingsMessage"
          class="listings-message"
          :role="listingsMessageIsError ? 'alert' : undefined"
        >
          {{ listingsMessage }}
        </p>

        <ul
          v-else
          class="listing-grid"
        >
          <li
            v-for="listing in listings"
            :key="listing.id"
          >
            <a
              class="listing-card"
              :href="listing.href"
              @click="onCardClick($event, listing)"
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
                <span
                  v-if="listing.note"
                  class="card-note"
                >
                  {{ listing.note }}
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
      <!-- Pied de page du site : modifiable sur la page, repris par les pages des logements. -->
      <div class="footer-site">
        <EditableText
          tag="p"
          class="footer-name"
          label="Nom du site"
          :model-value="content.footer.name"
          :editing="editing"
          :max-length="PAGE_LIMITS.footerName"
          required
          @update:model-value="updateFooter('name', $event)"
        />
        <EditableText
          v-if="showText(content.footer.text)"
          tag="p"
          class="footer-text"
          label="Une ligne sur votre site : quartier, adresse…"
          :model-value="content.footer.text"
          :editing="editing"
          :max-length="PAGE_LIMITS.footerText"
          @update:model-value="updateFooter('text', $event)"
        />
        <p
          v-if="editing"
          class="footer-contact"
        >
          <span class="footer-contact-item">
            <Mail
              :size="16"
              aria-hidden="true"
            />
            <EditableText
              tag="span"
              label="E-mail de contact (facultatif)"
              :model-value="content.footer.email"
              :editing="editing"
              :max-length="PAGE_LIMITS.footerEmail"
              inputmode="email"
              :format="formatFooterEmail"
              @update:model-value="updateFooter('email', $event)"
            />
          </span>
          <span class="footer-contact-item">
            <Phone
              :size="16"
              aria-hidden="true"
            />
            <EditableText
              tag="span"
              label="Téléphone (facultatif)"
              :model-value="content.footer.phone"
              :editing="editing"
              :max-length="PAGE_LIMITS.footerPhone"
              inputmode="tel"
              :format="formatFooterPhone"
              @update:model-value="updateFooter('phone', $event)"
            />
          </span>
        </p>
        <p
          v-else-if="hasFooterContact"
          class="footer-contact"
        >
          <a
            v-if="content.footer.email"
            class="footer-contact-item"
            :href="`mailto:${content.footer.email}`"
          >
            <Mail
              :size="16"
              aria-hidden="true"
            />
            {{ content.footer.email }}
          </a>
          <a
            v-if="content.footer.phone"
            class="footer-contact-item"
            :href="telHref(content.footer.phone)"
          >
            <Phone
              :size="16"
              aria-hidden="true"
            />
            {{ content.footer.phone }}
          </a>
        </p>
        <p
          v-if="content.hostName"
          class="footer-host"
        >
          Proposé par {{ content.hostName }}
        </p>
      </div>
      <slot name="footer" />
    </footer>
  </article>
</template>

<style lang="scss">
@use '@/views/ListingHub/themed/themed-hub-page.scss';
</style>
