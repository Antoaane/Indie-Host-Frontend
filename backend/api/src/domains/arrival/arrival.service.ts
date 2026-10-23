import type { PrismaClient } from '@prisma/client';

import { asObject, deepMerge } from '../../lib/json.js';
import { toPrismaJson } from '../../lib/prisma.js';
import { LISTING_ARRIVAL_TEXT_RULES, sanitizeTextFields } from '../../lib/sanitizeHtml.js';

const DEFAULT_ARRIVAL = {
  intro: {
    title: 'Bienvenue',
    subtitle: 'Pour profiter des lieux au maximum, voici votre guide d’arrivée.',
    tagline: 'Propulsé par IndieHost',
  },
  practical: {
    savings: { message: '' },
    access: {
      address: '',
      checkIn: '',
      checkOut: '',
      parking: '',
    },
    services: {
      wifi: '',
      contacts: '',
      assistance: '',
    },
    rules: '',
    shops: '',
  },
  guide: {
    title: '',
    content: '',
  },
};

export class ArrivalService {
  constructor(private readonly prisma: PrismaClient) {}

  async getListingArrival(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { arrival: true },
    });

    if (!listing) return null;
    return asObject(listing.arrival, structuredClone(DEFAULT_ARRIVAL));
  }

  async patchListingArrival(listingId: string, patch: Record<string, unknown>) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { arrival: true },
    });

    if (!listing) return null;

    const current = asObject(listing.arrival, structuredClone(DEFAULT_ARRIVAL));
    // Nettoyé à l'écriture (HTML Quill des règles / commerces / guide, texte brut ailleurs) : le
    // front assainit aussi au rendu, mais l'API sert aussi le pré-rendu et, demain, e-mails et .ics.
    const merged = sanitizeTextFields(deepMerge(current, patch), LISTING_ARRIVAL_TEXT_RULES);

    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        arrival: toPrismaJson(merged),
      },
    });

    return merged;
  }
}
