// File: src/views/ListingHub/dev/devPageContent.ts

// Faux contenu de la prévisualisation des thèmes (`/dev/page-themes`) : un hôte imaginaire et ses
// trois cabanes flottantes, avec les photos d'exemple déjà présentes dans le dépôt.

import type { HubPageContent, HubPageListing, PlaceSetting } from '@/domain/listings/pageThemes'

const PHOTOS = '/assets/media/images/listing-test-0'

export function buildDevPageContent(): HubPageContent {
  return {
    title: 'Les Cabanes du Lac',
    tagline: 'Trois cabanes flottantes pour dormir sur l’eau, au milieu des aulnes.',
    location: 'Lac des Aulnes, Bourgogne',
    coverSrc: `${PHOTOS}/image1.jpg`,
    coverAlt: 'Les cabanes flottantes au lever du soleil',
    hostName: 'Claire et Julien',
    footer: {
      name: 'Les Cabanes du Lac',
      text: 'Chemin du Ponton, 21000 Lac des Aulnes',
      email: '',
      phone: '',
    },
    sections: [
      {
        id: 'presentation',
        type: 'text-image',
        title: 'Un séjour posé sur l’eau',
        text: [
          'Nous avons construit ces cabanes en 2019, une par une, avec le bois de la scierie voisine. Chacune a sa terrasse, sa barque et sa vue sur le lac.',
          'Vous arrivez en bateau et vous repartez quand vous voulez. Le petit-déjeuner vous attend sur le ponton à 8 h.',
        ].join('\n\n'),
        imageSrc: `${PHOTOS}/image4.jpg`,
      },
      {
        // Note réelle d'« Appartement les Raisins Clairs » sur Booking (relevée par Nathan le 2026-11-11).
        id: 'note',
        type: 'rating',
        title: 'Ce qu’en disent nos voyageurs',
        platform: 'booking',
        score: 9.6,
        reviewCount: 7,
        label: 'Exceptionnel',
      },
      {
        id: 'logements',
        type: 'listings',
        title: 'Nos cabanes',
      },
    ],
  }
}

/** `setting` simule le cadre déduit de l'adresse de chaque logement (voir `suggestPageThemeId`). */
export function buildDevPageListings(setting: PlaceSetting | null): HubPageListing[] {
  return [
    {
      id: 'heron',
      title: 'La Cabane Héron',
      city: 'Rive nord',
      guestCapacity: 2,
      pricePerNight: 145,
      coverSrc: `${PHOTOS}/image8.jpg`,
      href: '#heron',
      setting,
    },
    {
      id: 'martin-pecheur',
      title: 'La Cabane Martin-Pêcheur',
      city: 'Anse des roseaux',
      guestCapacity: 4,
      pricePerNight: 185,
      coverSrc: `${PHOTOS}/image10.jpg`,
      href: '#martin-pecheur',
      setting,
    },
    {
      id: 'aulne',
      title: 'La Cabane Aulne',
      city: 'Pointe sud',
      guestCapacity: 6,
      pricePerNight: 230,
      coverSrc: `${PHOTOS}/image6.jpg`,
      href: '#aulne',
      setting,
    },
  ]
}
