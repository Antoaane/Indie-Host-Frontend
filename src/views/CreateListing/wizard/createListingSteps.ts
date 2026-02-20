// File: src/views/CreateListing/wizard/createListingSteps.ts

import TitlePanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/TitlePanel.vue'
import LocationPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/LocationPanel.vue'
import CapacityPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/CapacityPanel.vue'
import RoomsPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/RoomsPanel.vue'
import AmenitiesPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/AmenitiesPanel.vue'
import GalleryPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/GalleryPanel.vue'
import DescriptionPanel from '@/views/Editor/components/EditorSidebar/panels/ListingPanels/DescriptionPanel.vue'
import BasePricingPanel from '@/views/Editor/components/EditorSidebar/panels/PricingPanels/BasePricingPanel.vue'
import { editorStatic } from '@/views/Editor/utils/editorContent'
import CreateListingSummarySlide from '@/views/CreateListing/components/CreateListingSummarySlide.vue'
import type { RawListingBundle } from '@/domain/listings/types'
import type { CreateListingStep } from '@/views/CreateListing/wizard/createListing.types'
import { asNumber, cleanText, stripHtml } from '@/views/CreateListing/wizard/createListingDraft'

function validateTitle(bundle: RawListingBundle): string | null {
  const title = cleanText(bundle.core?.title)
  if (!title) return 'Ajoute un titre pour continuer.'
  if (title.length < 6) return 'Le titre doit contenir au moins 6 caractères.'
  return null
}

function validateLocation(bundle: RawListingBundle): string | null {
  const type = cleanText(bundle.core?.type)
  const preciseAddress = cleanText(bundle.core?.precise_address)
  const city = cleanText(bundle.core?.city)
  const region = cleanText(bundle.core?.region)
  const country = cleanText(bundle.core?.country)
  const latitude = asNumber(bundle.core?.latitude ?? bundle.core?.lat, Number.NaN)
  const longitude = asNumber(bundle.core?.longitude ?? bundle.core?.lng, Number.NaN)
  if (!type || !preciseAddress || !city || !region || !country) {
    return 'Renseigne le type de logement et l’adresse précise pour déduire ville, région et pays.'
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return 'Analyse l’adresse précise pour générer les coordonnées de la carte.'
  }
  return null
}

function validateCapacity(bundle: RawListingBundle): string | null {
  const capacity = asNumber(bundle.core?.guest_capacity, 0)
  if (capacity < 1) return 'Indique une capacité d’accueil d’au moins 1 voyageur.'
  return null
}

function validateMedia(bundle: RawListingBundle): string | null {
  const images = bundle.medias?.images
  if (!Array.isArray(images) || !images.some((image) => typeof image?.src === 'string' && image.src.trim())) {
    return 'Ajoute au moins une photo du logement.'
  }
  return null
}

function validateDescription(bundle: RawListingBundle): string | null {
  const description = stripHtml(bundle.core?.description ?? '')
  if (description.length < 30) {
    return 'Ajoute une description plus détaillée (minimum 30 caractères).'
  }
  return null
}

function validatePricing(bundle: RawListingBundle): string | null {
  const price = asNumber(bundle.bookings?.price, 0)
  if (price <= 0) return 'Indique un prix de base supérieur à 0 €.'
  return null
}

export function createListingSteps(): CreateListingStep[] {
  const listingContent = editorStatic.panels.listing
  const pricingContent = editorStatic.panels.pricing

  return [
    {
      id: 'title',
      label: listingContent.title.title,
      description: listingContent.title.subtitle,
      component: TitlePanel,
      props: (draft) => ({ core: draft.core }),
      acceptsPatch: true,
      validate: validateTitle,
    },
    {
      id: 'location',
      label: listingContent.location.title,
      description: listingContent.location.subtitle,
      component: LocationPanel,
      props: (draft) => ({
        core: draft.core,
        requirePreciseAddress: true,
      }),
      acceptsPatch: true,
      validate: validateLocation,
    },
    {
      id: 'capacity',
      label: listingContent.capacity.title,
      description: listingContent.capacity.subtitle,
      component: CapacityPanel,
      props: (draft) => ({ core: draft.core }),
      acceptsPatch: true,
      validate: validateCapacity,
    },
    {
      id: 'rooms',
      label: listingContent.rooms.title,
      description: listingContent.rooms.subtitle,
      component: RoomsPanel,
      props: (draft) => ({ core: draft.core }),
      acceptsPatch: true,
    },
    {
      id: 'amenities',
      label: listingContent.amenities.title,
      description: listingContent.amenities.subtitle,
      component: AmenitiesPanel,
      props: (draft) => ({ core: draft.core }),
      acceptsPatch: true,
    },
    {
      id: 'gallery',
      label: listingContent.gallery.title,
      description: listingContent.gallery.subtitle,
      component: GalleryPanel,
      props: (draft) => ({ medias: draft.medias }),
      acceptsPatch: true,
      validate: validateMedia,
    },
    {
      id: 'description',
      label: listingContent.description.title,
      description: listingContent.description.subtitle,
      component: DescriptionPanel,
      props: (draft) => ({ core: draft.core }),
      acceptsPatch: true,
      validate: validateDescription,
    },
    {
      id: 'pricing',
      label: pricingContent.base.title,
      description: pricingContent.base.subtitle,
      component: BasePricingPanel,
      props: (draft) => ({ bookings: draft.bookings }),
      acceptsPatch: true,
      validate: validatePricing,
    },
    {
      id: 'summary',
      label: 'Validation finale',
      description: 'Vérifie les données, puis crée ton annonce.',
      component: CreateListingSummarySlide,
      props: (draft) => ({ draft }),
    },
  ]
}
