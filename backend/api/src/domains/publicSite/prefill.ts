// Pré-remplissage d'une page principale : IndieHost écrit d'office ce qu'un moteur de recherche lit en
// premier, pour qu'aucune page ne reste vide en attendant l'hôte. Une seule fois par page
// (`core.page.prefilledAt`), et seulement les zones vides :
// - l'accroche (« Locations de vacances à Saint-François, Guadeloupe ») ;
// - une présentation de deux paragraphes, quand la page n'a aucun texte ;
// - le pied de page (nom du site et lieu).
// L'hôte modifie ou supprime ces textes dans le mode édition ; ce qu'il vide reste vide.
//
// Textes : `siteContent.ts`. Écriture : même nettoyage que le mode édition (`hubPage.ts`), et
// `core.description` suit le premier texte de la page, comme à chaque enregistrement.

import type { PrismaClient } from '@prisma/client';

import { asObject, isObject } from '../../lib/json.js';
import { toPrismaJson } from '../../lib/prisma.js';
import {
  buildDescriptionFromPage,
  collectPageImageSources,
  normalizeHubPage,
  PAGE_LIMITS,
  updateHubPageSchema,
  type HubPageSettings,
} from '../listings/hubPage.js';
import {
  defaultSiteFooter,
  htmlToParagraphs,
  hubPlace,
  listingPlace,
  proposedPresentation,
  proposedTagline,
  sharedPlace,
} from './siteContent.js';

type HubInput = {
  core: Record<string, unknown>;
  medias: Record<string, unknown>;
  children: Array<{ core: Record<string, unknown> }>;
};

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function secondImageSource(medias: Record<string, unknown>): string | null {
  const images = (Array.isArray(medias.images) ? medias.images : []).filter(isObject);
  const hasPosition = images.some((image) => typeof image.position === 'number');
  const sorted = hasPosition
    ? [...images].sort((left, right) => (
      (typeof left.position === 'number' ? left.position : Number.POSITIVE_INFINITY)
      - (typeof right.position === 'number' ? right.position : Number.POSITIVE_INFINITY)
    ))
    : images;
  return readText(sorted[1]?.src) || null;
}

/**
 * Page pré-remplie, ou `null` quand il n'y a rien à faire (déjà pré-remplie, aucun logement en ligne).
 * Fonction pure : la tâche planifiée l'écrit, le contrôle `scripts/public-site-smoke.ts` la rejoue.
 */
export function buildPrefilledPage(hub: HubInput, now = new Date()): HubPageSettings | null {
  const stored = asObject(hub.core.page);
  if (typeof stored.prefilledAt === 'string') return null;
  if (!hub.children.length) return null;

  const siteName = readText(hub.core.title) || 'Nos logements';
  const place = hubPlace(hub.core, sharedPlace(hub.children.map((child) => listingPlace(child.core))));
  const listingTitles = hub.children.map((child) => readText(child.core.title)).filter(Boolean);

  // Sections : celles que l'hôte a enregistrées ; sinon le contenu affiché par défaut (présentation de
  // l'annonce et deuxième photo, puis les logements), comme à la première modification sur la page.
  let sections: Array<Record<string, unknown>>;
  if (Array.isArray(stored.sections)) {
    sections = stored.sections.filter(isObject).map((section) => ({ ...section }));
  } else {
    sections = [];
    const description = htmlToParagraphs(hub.core.description).join('\n\n');
    const secondImage = secondImageSource(hub.medias);
    if (description || secondImage) {
      sections.push({ id: 'presentation', type: 'text-image', title: '', text: description, imageSrc: secondImage });
    }
    sections.push({ id: 'logements', type: 'listings', title: '' });
  }

  const hasText = sections.some((section) => (section.type === 'text' || section.type === 'text-image') && readText(section.text));
  const addedSections = sections.filter((section) => section.type !== 'listings').length;
  if (!hasText) {
    const proposal = proposedPresentation({ siteName, place, listingTitles });
    const emptyTextImage = sections.find((section) => section.type === 'text-image');
    if (emptyTextImage) {
      emptyTextImage.text = proposal.text;
      if (!readText(emptyTextImage.title)) emptyTextImage.title = proposal.title;
    } else if (addedSections < PAGE_LIMITS.maxSections) {
      const usedIds = new Set(sections.map((section) => readText(section.id)));
      const id = usedIds.has('presentation') ? `presentation-${now.getTime().toString(36)}` : 'presentation';
      sections.unshift({ id, type: 'text', title: proposal.title, text: proposal.text });
    }
  }

  const candidate = updateHubPageSchema.shape.page.safeParse({
    theme: stored.theme ?? null,
    tagline: readText(stored.tagline) || proposedTagline(place, hub.children.length),
    location: readText(stored.location),
    sections,
    footer: isObject(stored.footer) ? stored.footer : defaultSiteFooter(siteName, place),
  });
  if (!candidate.success) return null;

  const knownImages = collectPageImageSources(hub.core.page, hub.medias.images);
  return { ...normalizeHubPage(candidate.data, knownImages), prefilledAt: now.toISOString() };
}

export type PrefillReport = { prefilled: Array<{ listingId: string; title: string }> };

/** Pré-remplit les pages principales qui ont au moins un logement en ligne et ne l'ont jamais été. */
export async function prefillHubPages(prisma: PrismaClient, options: { dryRun?: boolean } = {}): Promise<PrefillReport> {
  const hubs = await prisma.listing.findMany({
    where: { kind: 'hub', status: { not: 'deleted' } },
    select: { id: true, core: true, medias: true },
  });

  const report: PrefillReport = { prefilled: [] };
  for (const hub of hubs) {
    const core = asObject(hub.core);
    if (typeof asObject(core.page).prefilledAt === 'string') continue;

    const children = await prisma.listing.findMany({
      where: { parentListingId: hub.id, status: { in: ['published', 'blocked'] } },
      select: { core: true },
    });
    const page = buildPrefilledPage({
      core,
      medias: asObject(hub.medias),
      children: children.map((child) => ({ core: asObject(child.core) })),
    });
    if (!page) continue;

    report.prefilled.push({ listingId: hub.id, title: readText(core.title) });
    if (options.dryRun) continue;

    await prisma.listing.update({
      where: { id: hub.id },
      data: {
        core: toPrismaJson({
          ...core,
          page,
          // Même règle que l'enregistrement depuis la page : la description suit le premier texte.
          description: buildDescriptionFromPage(page) || readText(core.description),
        }),
      },
    });
  }
  return report;
}
