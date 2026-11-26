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
      type: 'Appartement',
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
      // Assez d'équipements pour remplir l'aperçu (6 sur téléphone, 8 sur ordinateur) et la fenêtre.
      amenities: [
        'WIFI', 'REVERSIBLE_AIR_CONDITIONING', 'EQUIPPED_KITCHEN', 'WASHER', 'WALK_TO_BEACH', 'SELF_CHECK_IN',
        'FREE_PARKING_ON_PREMISES', 'SMART_TV', 'LINENS_PROVIDED', 'HAIR_DRYER', 'NESPRESSO_COFFEE_MACHINE',
        'REFRIGERATOR', 'MICROWAVE', 'SMOKE_ALARM',
      ].map((id) => ({ id })),
    } as unknown as RawListingBundle['core'],
    medias: {
      images: [
        { src: SAMPLE_IMAGE, alt: '', position: 0 },
        { src: SAMPLE_IMAGE, alt: 'Salon avec canapé rouge', position: 1 },
        { src: SAMPLE_IMAGE, alt: 'Cuisine équipée', position: 2 },
        { src: SAMPLE_IMAGE, alt: 'Chambre', position: 3 },
        { src: SAMPLE_IMAGE, alt: 'Salle de bain', position: 4 },
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
        { start: '2026-12-01', end: '2026-12-05' },
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
        // Séjour à venir, payé en entier : une troisième période sur le calendrier du logement.
        {
          id: 'dev-reservation-3',
          start: '2026-12-01',
          end: '2026-12-05',
          nights: 4,
          guestName: 'Lucas Martin',
          message: '',
          guests: { adults: 2, children: 0, infants: 0, pets: 0, pmr: 0 },
          payment: { total: 225, deposit: 225, balance: 0, status: 'paid', method: 'Carte' },
          createdAt: '2026-11-20T18:45:00.000Z',
        },
      ],
      // Paliers par nombre de voyageurs : 45 € pour un voyageur, +10 % pour deux, +15 % pour trois.
      pricing: {
        stay: { minNights: 2 },
        cancellation: { policy: 'moderate', refundsEnabled: true },
        guestTiers: [
          { guests: 2, percent: 10 },
          { guests: 3, percent: 15 },
        ],
      },
    } as RawListingBundle['bookings'],
    arrival: {
      intro: { title: '', subtitle: '', tagline: '' },
      practical: {
        access: { checkIn: '16h', checkOut: '11h' },
        rules: '<p>Logement non-fumeur. Pas de fête ni de soirée.</p><p>Merci de respecter le calme de l’immeuble après 22 h.</p><p>Les animaux ne sont pas admis.</p>',
      },
    } as unknown as RawListingBundle['arrival'],
    host: { name: 'Nathan', legalStatus: 'individual' } as RawListingBundle['host'],
    // Une note et quelques avis, dont un long : la section « avis » de la page publique.
    notes: {
      note: { note: 4.8, reviewCount: 4, distribution: { 5: 3, 4: 1, 3: 0, 2: 0, 1: 0 } },
    } as RawListingBundle['notes'],
    comments: {
      comments: [[
        { name: 'Marine', note: 5, comment: 'Appartement très propre et bien placé, à deux pas de la plage. Nathan a répondu à toutes nos questions avant l’arrivée.', 'stay-dates': { start: '2026-08-02', end: '2026-08-09' } },
        { name: 'Julien', note: 5, comment: 'Séjour parfait. La climatisation et la machine à laver sont un vrai plus en famille. Le quartier est calme le soir et tout se fait à pied : le marché, les restaurants et l’embarcadère. Nous reviendrons sans hésiter l’an prochain, sans doute pour deux semaines cette fois.', 'stay-dates': { start: '2026-07-12', end: '2026-07-19' } },
        { name: 'Élodie', note: 4, comment: 'Très bon rapport qualité-prix. Seul bémol : le canapé-lit est un peu ferme.', 'stay-dates': { start: '2026-05-20', end: '2026-05-24' } },
        { name: 'Thomas', note: 5, comment: 'Arrivée autonome très simple, logement conforme aux photos.', 'stay-dates': { start: '2026-04-03', end: '2026-04-06' } },
      ]],
    } as RawListingBundle['comments'],
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
