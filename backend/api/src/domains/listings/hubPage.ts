// Page de présentation d'une page principale (`core.page`) : thème choisi par l'hôte, textes propres à
// la page et sections. Conception : docs/editeur-de-page.md (sections 6 et 8).
//
// Le front a les mêmes types et les mêmes limites dans `frontend/src/domain/listings/pageThemes.ts` :
// toute évolution (type de section, limite) se fait des deux côtés.

import { z } from 'zod';

import { env } from '../../config/env.js';
import { isObject } from '../../lib/json.js';
import { sanitizePlainText } from '../../lib/sanitizeHtml.js';

export const PAGE_THEME_IDS = ['maison', 'rivage', 'nocturne'] as const;
export type PageThemeId = typeof PAGE_THEME_IDS[number];

export const PAGE_LIMITS = {
  title: 80,
  tagline: 180,
  location: 80,
  sectionTitle: 80,
  sectionText: 1200,
  /** Sections ajoutées par l'hôte, sans compter celle des logements (décision D9). */
  maxSections: 12,
  gallerySize: 3,
} as const;

export type PageSection =
  | { id: string; type: 'text-image'; title: string; text: string; imageSrc: string | null }
  | { id: string; type: 'text'; title: string; text: string }
  | { id: string; type: 'gallery'; title: string; images: Array<string | null> }
  | { id: string; type: 'listings'; title: string };

export type HubPageSettings = {
  theme?: PageThemeId;
  tagline: string;
  location: string;
  sections: PageSection[];
};

// Les textes sont nettoyés et bornés ensuite : la validation limite seulement la taille brute reçue.
const looseText = z.string().max(5000).optional().default('');
const imageSrc = z.string().max(2048).nullable().optional().default(null);
const sectionId = z.string().max(64);

const sectionSchema = z.discriminatedUnion('type', [
  z.object({ id: sectionId, type: z.literal('text-image'), title: looseText, text: looseText, imageSrc }),
  z.object({ id: sectionId, type: z.literal('text'), title: looseText, text: looseText }),
  z.object({
    id: sectionId,
    type: z.literal('gallery'),
    title: looseText,
    images: z.array(imageSrc).max(PAGE_LIMITS.gallerySize).optional().default([]),
  }),
  z.object({ id: sectionId, type: z.literal('listings'), title: looseText }),
]);

export const updateHubPageSchema = z.object({
  /** Titre de la page (`core.title`). Absent : inchangé. */
  title: z.string().max(5000).optional(),
  /** Photo d'en-tête : remplace la première photo de l'annonce. Absent : inchangée. */
  coverSrc: z.string().max(2048).optional(),
  page: z.object({
    /** `null` ou absent : thème d'office selon le lieu des logements. */
    theme: z.enum(PAGE_THEME_IDS).nullable().optional(),
    tagline: looseText,
    location: looseText,
    // Une de plus que le maximum : la section des logements ne compte pas.
    sections: z.array(sectionSchema).max(PAGE_LIMITS.maxSections + 1),
  }),
});

export type UpdateHubPageInput = z.infer<typeof updateHubPageSchema>;

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trimEnd() : value;
}

export function cleanLine(value: unknown, max: number): string {
  return clip(sanitizePlainText(value), max);
}

function cleanParagraphs(value: unknown, max: number): string {
  return clip(sanitizePlainText(value, { multiline: true }), max);
}

function imageKitHost(): string | null {
  try {
    return env.IMAGEKIT_ENDPOINT ? new URL(env.IMAGEKIT_ENDPOINT).host : null;
  } catch {
    return null;
  }
}

/**
 * Photo acceptée sur la page : une adresse https hébergée sur ImageKit (c'est là qu'arrivent les
 * photos envoyées depuis la page), ou une photo que l'annonce affichait déjà (`known`). Toute autre
 * valeur devient « pas de photo ».
 */
export function cleanImageSrc(value: unknown, known: ReadonlySet<string> = new Set()): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  if (known.has(raw)) return raw;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    const isImageKit = url.host === imageKitHost() || url.host === 'ik.imagekit.io' || url.host.endsWith('.imagekit.io');
    return isImageKit ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Photos déjà affichées par l'annonce : celles de sa galerie et celles de sa page enregistrée. */
export function collectPageImageSources(page: unknown, galleryImages: unknown): Set<string> {
  const sources = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) sources.add(value.trim());
  };

  if (Array.isArray(galleryImages)) {
    for (const image of galleryImages) add(isObject(image) ? image.src : null);
  }

  const sections = isObject(page) && Array.isArray(page.sections) ? page.sections : [];
  for (const section of sections) {
    if (!isObject(section)) continue;
    add(section.imageSrc);
    if (Array.isArray(section.images)) section.images.forEach(add);
  }

  return sources;
}

function cleanSectionId(value: string, index: number, used: Set<string>): string {
  const base = value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || `section-${index + 1}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

/**
 * Réglages de page prêts à être enregistrés : textes ramenés à du texte brut et bornés, photos
 * vérifiées, au plus douze sections ajoutées, et toujours une (et une seule) section des logements.
 */
export function normalizeHubPage(input: UpdateHubPageInput['page'], knownImages: ReadonlySet<string> = new Set()): HubPageSettings {
  const usedIds = new Set<string>();
  const sections: PageSection[] = [];
  let hasListings = false;
  let added = 0;

  input.sections.forEach((section, index) => {
    const title = cleanLine(section.title, PAGE_LIMITS.sectionTitle);

    if (section.type === 'listings') {
      if (hasListings) return;
      hasListings = true;
      sections.push({ id: cleanSectionId(section.id, index, usedIds), type: 'listings', title });
      return;
    }

    if (added >= PAGE_LIMITS.maxSections) return;
    added += 1;
    const id = cleanSectionId(section.id, index, usedIds);

    if (section.type === 'gallery') {
      const images = Array.from(
        { length: PAGE_LIMITS.gallerySize },
        (_, slot) => cleanImageSrc(section.images[slot], knownImages),
      );
      sections.push({ id, type: 'gallery', title, images });
      return;
    }

    const text = cleanParagraphs(section.text, PAGE_LIMITS.sectionText);
    if (section.type === 'text-image') {
      sections.push({ id, type: 'text-image', title, text, imageSrc: cleanImageSrc(section.imageSrc, knownImages) });
      return;
    }
    sections.push({ id, type: 'text', title, text });
  });

  if (!hasListings) {
    sections.push({ id: cleanSectionId('logements', sections.length, usedIds), type: 'listings', title: '' });
  }

  return {
    ...(input.theme ? { theme: input.theme } : {}),
    tagline: cleanLine(input.tagline, PAGE_LIMITS.tagline),
    location: cleanLine(input.location, PAGE_LIMITS.location),
    sections,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * `core.description` d'une page principale dont la page est enregistrée : le premier texte de la
 * page, en paragraphes. Elle ne sert plus à l'affichage, seulement aux aperçus de partage et aux
 * moteurs de recherche.
 */
export function buildDescriptionFromPage(page: HubPageSettings): string {
  for (const section of page.sections) {
    if (section.type !== 'text' && section.type !== 'text-image') continue;
    if (!section.text) continue;
    return section.text
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
  return '';
}

type MediaImage = Record<string, unknown>;

/**
 * Remplace la photo d'en-tête : la première photo de l'annonce dans l'ordre d'affichage (`position`,
 * puis ordre du tableau). Sans photo, la nouvelle devient la première.
 */
export function replaceCoverImage(images: unknown, coverSrc: string): MediaImage[] {
  const list: MediaImage[] = Array.isArray(images) ? images.filter(isObject) : [];
  if (!list.length) return [{ src: coverSrc, alt: '', position: 0 }];

  // Même ordre que le site (`utils/medias/order.ts`) : par `position` dès qu'une photo en porte une
  // (celles qui n'en ont pas passent à la fin), sinon l'ordre du tableau.
  const positionOf = (image: MediaImage) => (
    typeof image.position === 'number' && Number.isFinite(image.position) ? image.position : Number.POSITIVE_INFINITY
  );
  let coverIndex = 0;
  if (list.some((image) => Number.isFinite(positionOf(image)))) {
    list.forEach((image, index) => {
      if (positionOf(image) < positionOf(list[coverIndex]!)) coverIndex = index;
    });
  }

  // La description de l'ancienne photo ne décrit plus la nouvelle : elle est vidée.
  return list.map((image, index) => (index === coverIndex ? { ...image, src: coverSrc, alt: '' } : image));
}
