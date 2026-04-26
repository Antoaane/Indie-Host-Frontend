// File: src/views/CreateListing/wizard/createListingSteps.ts

import type { RawListingBundle } from '@/domain/listings/types'
import CreateAmenitiesStepPanel from '@/views/CreateListing/components/panels/CreateAmenitiesStepPanel.vue'
import CreateBasePricingStepPanel from '@/views/CreateListing/components/panels/CreateBasePricingStepPanel.vue'
import CreateCapacityStepPanel from '@/views/CreateListing/components/panels/CreateCapacityStepPanel.vue'
import CreateDescriptionStepPanel from '@/views/CreateListing/components/panels/CreateDescriptionStepPanel.vue'
import CreateGalleryStepPanel from '@/views/CreateListing/components/panels/CreateGalleryStepPanel.vue'
import CreateLocationStepPanel from '@/views/CreateListing/components/panels/CreateLocationStepPanel.vue'
import CreatePricingDiscountsStepPanel from '@/views/CreateListing/components/panels/CreatePricingDiscountsStepPanel.vue'
import CreateRoomsStepPanel from '@/views/CreateListing/components/panels/CreateRoomsStepPanel.vue'
import CreateTitleStepPanel from '@/views/CreateListing/components/panels/CreateTitleStepPanel.vue'
import type { CreateListingStep } from '@/views/CreateListing/wizard/createListing.types'
import { asNumber, cleanText, stripHtml } from '@/views/CreateListing/wizard/createListingDraft'

function resolveDraftListingId(bundle: RawListingBundle): string | null {
  const value = bundle.core?.id
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function validateTitle(bundle: RawListingBundle): string | null {
  const title = cleanText(bundle.core?.title)
  if (!title) return 'Ajoutez un titre à votre annonce pour continuer.'
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
    return 'Renseignez le type de logement et l’adresse précise pour générer automatiquement la ville, la région et le pays.'
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return 'Analysez l’adresse pour générer les coordonnées de la carte.'
  }
  return null
}

function validateCapacity(bundle: RawListingBundle): string | null {
  const capacity = asNumber(bundle.core?.guest_capacity, 0)
  if (capacity < 1) return 'Indiquez une capacité d’accueil d’au moins 1 voyageur.'
  return null
}

function validateRooms(bundle: RawListingBundle): string | null {
  const rooms = bundle.core?.rooms
  const hasAtLeastOneBed = Array.isArray(rooms) && rooms.some((room) => {
    const roomRecord = room as Record<string, unknown> | null | undefined
    const beds = roomRecord?.beds
    return Array.isArray(beds) && beds.some((bed) => asNumber((bed as Record<string, unknown> | null | undefined)?.quantity, 0) > 0)
  })

  if (!hasAtLeastOneBed) return 'Ajoutez au moins une pièce avec au moins un lit.'
  return null
}

function validateMedia(bundle: RawListingBundle): string | null {
  const images = bundle.medias?.images
  if (!Array.isArray(images) || !images.some((image) => typeof image?.src === 'string' && image.src.trim())) {
    return 'Ajoutez au moins une photo de votre logement.'
  }
  return null
}

function validateDescription(bundle: RawListingBundle): string | null {
  const description = stripHtml(bundle.core?.description ?? '')
  if (description.length < 30) {
    return 'Ajoutez une description plus détaillée (minimum 30 caractères).'
  }
  return null
}

function validatePricing(bundle: RawListingBundle): string | null {
  const price = asNumber(bundle.bookings?.price, 0)
  if (price <= 0) return 'Indiquez un tarif par nuit supérieur à 0 €.'
  return null
}

export function createListingSteps(): CreateListingStep[] {
  return [
    {
      id: 'location',
      label: 'Adresse',
      description: 'Indiquez l’adresse précise pour préremplir automatiquement la localisation publique.',
      component: CreateLocationStepPanel,
      props: (draft, context) => ({
        core: draft.core,
        requirePreciseAddress: true,
        validationError: context?.validationError ?? null,
      }),
      acceptsPatch: true,
      validate: validateLocation,
    },
    {
      id: 'capacity',
      label: 'Voyageurs',
      description: 'Définissez la capacité maximale que votre logement peut accueillir.',
      component: CreateCapacityStepPanel,
      props: (draft, context) => ({
        core: draft.core,
        validationError: context?.validationError ?? null,
      }),
      acceptsPatch: true,
      validate: validateCapacity,
    },
    {
      id: 'rooms',
      label: 'Pièces & lits',
      description: 'Précisez les pièces disponibles et le détail des lits.',
      component: CreateRoomsStepPanel,
      props: (draft, context) => ({
        core: draft.core,
        validationError: context?.validationError ?? null,
      }),
      acceptsPatch: true,
      validate: validateRooms,
    },
    {
      id: 'amenities',
      label: 'Équipements',
      description: 'Sélectionnez les équipements qui seront affichés aux voyageurs.',
      component: CreateAmenitiesStepPanel,
      props: (draft, context) => ({
        core: draft.core,
        validationError: context?.validationError ?? null,
      }),
      acceptsPatch: true,
    },
    {
      id: 'gallery',
      label: 'Photos',
      description: 'Ajoutez des photos de qualité et choisissez votre image de couverture.',
      component: CreateGalleryStepPanel,
      props: (draft, context) => ({
        medias: draft.medias,
        listingId: resolveDraftListingId(draft),
        listingStatus: draft.core?.status,
        validationError: context?.validationError ?? null,
      }),
      acceptsPatch: true,
      validate: validateMedia,
    },
    {
      id: 'title',
      label: 'Titre',
      description: 'Créez un titre court, clair et mémorable pour votre annonce.',
      component: CreateTitleStepPanel,
      props: (draft, context) => ({
        core: draft.core,
        validationError: context?.validationError ?? null,
      }),
      acceptsPatch: true,
      validate: validateTitle,
    },
    {
      id: 'description',
      label: 'Description',
      description: 'Présentez votre logement, son ambiance et ses points forts.',
      component: CreateDescriptionStepPanel,
      props: (draft, context) => ({
        core: draft.core,
        validationError: context?.validationError ?? null,
      }),
      acceptsPatch: true,
      validate: validateDescription,
    },
    {
      id: 'pricing',
      label: 'Tarifs',
      description: 'Définissez votre prix par nuit et vos frais additionnels.',
      component: CreateBasePricingStepPanel,
      props: (draft, context) => ({
        bookings: draft.bookings,
        validationError: context?.validationError ?? null,
      }),
      acceptsPatch: true,
      validate: validatePricing,
    },
    {
      id: 'pricing-discounts',
      label: 'Réductions',
      description: 'Ajoutez vos paliers de réduction par durée de séjour et par anticipation de réservation.',
      component: CreatePricingDiscountsStepPanel,
      props: (draft, context) => ({
        bookings: draft.bookings,
        validationError: context?.validationError ?? null,
      }),
      acceptsPatch: true,
    },
  ]
}
