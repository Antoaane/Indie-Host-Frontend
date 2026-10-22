export const LISTING_RESOURCES = [
  'core',
  'bookings',
  'medias',
  'arrival',
  'notes',
  'comments',
  'host',
] as const;

export type ListingResourceKey = (typeof LISTING_RESOURCES)[number];

export const DEFAULT_ARRIVAL = {
  intro: {
    title: 'Bienvenue',
    subtitle: 'Pour profiter des lieux au maximum, voici votre guide d’arrivée.',
    tagline: 'Propulsé par IndieHost',
  },
  practical: {
    savings: {
      message: 'Réservez en direct pour éviter les commissions.',
    },
    access: {
      address: 'Adresse complète envoyée 24 h avant l’arrivée.',
      checkIn: 'À partir de 16 h.',
      checkOut: 'Avant 11 h.',
      parking: 'Gratuit sur place.',
    },
    services: {
      wifi: 'Nom du réseau et mot de passe disponibles sur place.',
      contacts: 'Urgences 112.',
      assistance: 'Assistance de l’hôte disponible par message.',
    },
    rules: '',
    shops: '',
  },
  guide: {
    title: '',
    content: '',
  },
} as const;

export function buildDefaultResource(resource: ListingResourceKey, listingId: string): Record<string, unknown> {
  switch (resource) {
    case 'core':
      return {
        id: listingId,
        status: 'draft',
        title: 'Nouvelle annonce',
      };
    case 'bookings':
      return {
        price: 0,
        fees: [],
        'booked-days': [],
        'external-booked-days': [],
        reservations: [],
      };
    case 'medias':
      return {
        images: [],
        videos: [],
      };
    case 'arrival':
      return structuredClone(DEFAULT_ARRIVAL);
    case 'notes':
      return {
        note: null,
      };
    case 'comments':
      return {
        comments: [],
      };
    case 'host':
      return {
        name: '',
        status: '',
        seniority: 0,
        'global-note': 0,
        avatar: '',
        'catalog-link': '',
      };
    default:
      return {};
  }
}
