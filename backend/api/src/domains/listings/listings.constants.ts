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
    subtitle: 'Pour profiter des lieux au maximum, voici votre guide d\'arrivee.',
    tagline: 'Propulse par IndieHost',
  },
  practical: {
    savings: {
      message: 'Reservez en direct pour eviter les commissions.',
    },
    access: {
      address: 'Adresse complete envoyee 24h avant l\'arrivee.',
      checkIn: 'A partir de 16h.',
      checkOut: 'Avant 11h.',
      parking: 'Gratuit sur place.',
    },
    services: {
      wifi: 'Nom du reseau et mot de passe disponibles sur place.',
      contacts: 'Urgences 112.',
      assistance: 'Assistance hote disponible par message.',
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
