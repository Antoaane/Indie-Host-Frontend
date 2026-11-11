// File: src/views/Editor/dev/devEditorSource.ts

import type { RawListingBundle, UserListingCard, VolatileBundle } from '@/domain/listings/types'
import { applyPatchToDraftBundle } from '@/views/Editor/composables/editorDraftTools'
import type { EditorSource } from '@/views/Editor/types/editor'

/**
 * Source d'éditeur en mémoire, réservée au développement (`/dev/editor`) : permet de
 * travailler l'interface de l'éditeur sans API ni base de données. Les panneaux qui
 * appellent l'API directement (domaines, iCal, import) affichent leur état d'erreur.
 */
const SAMPLE_IMAGE = '/assets/media/images/webp/hero-image.webp'

function buildApartment(): RawListingBundle {
  return {
    core: {
      id: 'dev-apartment',
      kind: 'listing',
      slug: 'appartement-les-raisins-clairs',
      status: 'paused',
      title: 'Appartement les Raisins Clairs',
      description:
        '<p>Appartement sécurisé au 1er étage se situe dans un immeuble de 2 étages, vous offrira tout le confort de base (cuisine équipée, climatisation, linge de maison, machine à laver).</p>',
      type: 'apartment',
      city: 'Saint-François',
      region: 'Guadeloupe',
      country: 'France',
      precise_address: 'Rue Paul Tilby 97118 Saint-François',
      latitude: 16.25,
      longitude: -61.27,
      guest_capacity: 3,
      rooms: [
        { type: 'bedroom', 'room-name': 'Chambre', beds: [{ type: 'double', capacity: 2, quantity: 1 }] },
        { type: 'livingroom', 'room-name': 'Salon', beds: [{ type: 'sofa-bed', capacity: 2, quantity: 1 }] },
      ],
      amenities: [],
    } as unknown as RawListingBundle['core'],
    medias: {
      images: [
        { src: SAMPLE_IMAGE, alt: '', position: 0 },
        { src: SAMPLE_IMAGE, alt: 'Salon avec canapé rouge', position: 1 },
      ],
      videos: [],
    } as RawListingBundle['medias'],
    // Une vraie réservation et deux périodes venues d'un calendrier importé (Booking), dont une
    // fermeture de plus d'un an : le cas réel qui produisait de fausses réservations.
    bookings: {
      price: 45,
      fees: [{ code: 'custom', name: 'Frais de ménage', amount: 25 }],
      'booked-days': [
        { start: '2026-10-03', end: '2026-10-10' },
        { start: '2026-11-13', end: '2026-11-22' },
        { start: '2026-11-24', end: '2026-11-28' },
        { start: '2026-12-07', end: '2028-05-11' },
      ],
      'external-booked-days': [
        { start: '2026-11-13', end: '2026-11-22' },
        { start: '2026-12-07', end: '2028-05-11' },
      ],
      reservations: [
        {
          id: 'dev-reservation-1',
          start: '2026-11-24',
          end: '2026-11-28',
          nights: 4,
          guestName: 'Camille Durand',
          message: 'Bonjour, nous arriverons vers 17 h. Est-il possible de laisser les valises plus tôt ?',
          guests: { adults: 2, children: 1, infants: 0, pets: 0, pmr: 0 },
          payment: { total: 205, deposit: 62, balance: 143, status: 'pending', method: 'Carte' },
          createdAt: '2026-11-02T10:00:00.000Z',
        },
        // Séjour passé, soldé, avec un paiement saisi à la main, une note et un nom très long.
        {
          id: 'dev-reservation-2',
          start: '2026-10-03',
          end: '2026-10-10',
          nights: 7,
          guestName: 'Jean-Baptiste de La Rochefoucauld-Montmorency',
          message: '',
          internalNote: 'Arrive tard le soir : laisser les clés dans la boîte à code.',
          guests: { adults: 2, children: 0, infants: 0, pets: 2, pmr: 0 },
          payment: {
            total: 340,
            deposit: 340,
            balance: 0,
            status: 'paid',
            method: 'Carte',
            manual: { entries: [{ id: 'dev-manual-1', amount: 100, date: '2026-10-03', method: 'cash', comment: 'Remis à l’arrivée' }] },
          },
          createdAt: '2026-09-12T08:30:00.000Z',
        },
      ],
      pricing: {},
    } as RawListingBundle['bookings'],
    arrival: {
      intro: { title: '', subtitle: '', tagline: '' },
      practical: { access: { checkIn: '16h', checkOut: '11h' }, rules: '' },
    } as unknown as RawListingBundle['arrival'],
    host: { name: 'Nathan', legalStatus: 'individual' } as RawListingBundle['host'],
    notes: null,
    comments: null,
  }
}

function buildHub(): RawListingBundle {
  return {
    core: {
      id: 'dev-hub',
      kind: 'hub',
      slug: 'coeur-de-saint-francois',
      status: 'published',
      title: 'Coeur de Saint François',
      description: '',
    } as RawListingBundle['core'],
    medias: { images: [{ src: SAMPLE_IMAGE, alt: '', position: 0 }], videos: [] } as RawListingBundle['medias'],
    bookings: { price: 0, fees: [], 'booked-days': [], reservations: [], pricing: {} } as RawListingBundle['bookings'],
    arrival: {} as RawListingBundle['arrival'],
    host: null,
    notes: null,
    comments: null,
  }
}

// Logement indépendant, en brouillon : sert à voir le groupe « Logements indépendants » et l'ajout à une page.
function buildStudio(): RawListingBundle {
  const base = buildApartment()
  return {
    ...base,
    core: {
      ...base.core,
      id: 'dev-studio',
      slug: 'studio-du-port',
      status: 'draft',
      title: 'Studio du Port',
      guest_capacity: 2,
      rooms: [],
    } as RawListingBundle['core'],
    bookings: { price: 60, fees: [], 'booked-days': [], reservations: [], pricing: {} } as RawListingBundle['bookings'],
  }
}

// Rattachements de démonstration : l'appartement est présenté par la page principale.
const DEV_PARENT_BY_LISTING_ID: Record<string, string> = {
  'dev-apartment': 'dev-hub',
}

function toCard(bundle: RawListingBundle): UserListingCard {
  const core = (bundle.core ?? {}) as Record<string, unknown>
  const images = Array.isArray(bundle.medias?.images) ? bundle.medias.images : []
  return {
    kind: core.kind === 'hub' ? 'hub' : 'listing',
    parentListingId: DEV_PARENT_BY_LISTING_ID[String(core.id)] ?? null,
    listingId: String(core.id),
    slug: typeof core.slug === 'string' ? core.slug : undefined,
    title: typeof core.title === 'string' ? core.title : undefined,
    status: typeof core.status === 'string' ? core.status : undefined,
    hasPendingChanges: false,
    coverSrc: images[0]?.src,
    images: images.map((image, index) => ({ src: image.src, alt: image.alt, position: image.position ?? index })),
    guestCapacity: typeof core.guest_capacity === 'number' ? core.guest_capacity : undefined,
    pricePerNight: typeof bundle.bookings?.price === 'number' ? bundle.bookings.price : undefined,
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function createDevEditorSource(): EditorSource {
  const bundles = new Map<string, RawListingBundle>()
  for (const bundle of [buildHub(), buildApartment(), buildStudio()]) {
    bundles.set(String(bundle.core?.id), bundle)
  }

  function requireBundle(listingId: string): RawListingBundle {
    const bundle = bundles.get(listingId)
    if (!bundle) throw new Error(`Annonce de démonstration introuvable : ${listingId}`)
    return bundle
  }

  return {
    fetchListings: async () => {
      await delay(120)
      return Array.from(bundles.values()).map(toCard)
    },
    fetchEditableListingBundle: async (listingId) => {
      await delay(120)
      return structuredClone(requireBundle(listingId))
    },
    fetchVolatileListingBundle: async (listingId): Promise<VolatileBundle> => {
      const bundle = requireBundle(listingId)
      return structuredClone({
        bookings: bundle.bookings,
        notes: bundle.notes,
        comments: bundle.comments,
        host: bundle.host,
      })
    },
    patchListingDraft: async (listingId, patch) => {
      await delay(250)
      bundles.set(listingId, applyPatchToDraftBundle(requireBundle(listingId), patch))
    },
    publishListingDraft: async (listingId, draft) => {
      await delay(400)
      bundles.set(listingId, structuredClone(draft))
    },
    createListing: async (payload) => {
      const listingId = `dev-${Date.now().toString(36)}`
      const base = buildApartment()
      const bundle: RawListingBundle = {
        ...base,
        ...payload,
        core: { ...base.core, ...(payload?.core ?? {}), id: listingId, status: 'draft' } as RawListingBundle['core'],
      }
      bundles.set(listingId, bundle)
      return { listingId }
    },
  }
}
