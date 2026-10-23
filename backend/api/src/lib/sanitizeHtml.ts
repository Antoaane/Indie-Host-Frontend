import sanitize from 'sanitize-html';

// Nettoyage côté serveur, à l'écriture, de tout HTML ou texte fourni par un hôte, un voyageur ou
// un import Airbnb / Booking. Même politique que `frontend/src/utils/sanitizeHtml.ts` (DOMPurify,
// appliqué au rendu) : les deux doivent évoluer ensemble. Ce module est pur (aucun état partagé).

// Balises autorisées : sortie Quill 2 + import OTA. Pas d'img, d'iframe, de tableau ni de formulaire.
const ALLOWED_TAGS = [
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
  'span',
  'sub',
  'sup',
  'code',
  'pre',
];

// Liens absolus http(s), mailto et tel uniquement (javascript:, data:, relatifs… retirés).
const ALLOWED_HREF_PATTERN = /^(?:https?|mailto|tel):/i;

// Classes Quill uniquement (ql-align-*, ql-indent-*…) : pas de classes de l'app ni Tailwind.
const QUILL_CLASS_PATTERN = /^ql-[a-z0-9-]+$/;

// Le contenu de ces balises disparaît avec elles (le texte des autres balises interdites est gardé).
const NON_TEXT_TAGS = ['script', 'style', 'textarea', 'option', 'iframe', 'noscript', 'object', 'embed', 'svg', 'math'];

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‍⁠﻿]/g;

function filterQuillClasses(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const kept = value.split(/\s+/).filter((name) => QUILL_CLASS_PATTERN.test(name));
  return kept.length ? kept.join(' ') : undefined;
}

function transformElement(tagName: string, attribs: sanitize.Attributes): sanitize.Tag {
  const next: sanitize.Attributes = {};

  const classes = filterQuillClasses(attribs.class);
  if (classes) next.class = classes;

  if (tagName === 'a') {
    const href = attribs.href?.trim();
    if (href && ALLOWED_HREF_PATTERN.test(href)) next.href = href;
    // Comme côté front : un lien qui demande une cible s'ouvre dans un nouvel onglet, sans opener.
    if (attribs.target !== undefined) {
      next.target = '_blank';
      next.rel = 'noopener noreferrer';
    }
  }

  if (tagName === 'li' && attribs['data-list'] !== undefined) {
    // Puces Quill 2 : `bullet`, `ordered`, `checked`, `unchecked`.
    const list = attribs['data-list'].trim().toLowerCase();
    if (/^[a-z]+$/.test(list)) next['data-list'] = list;
  }

  return { tagName, attribs: next };
}

const RICH_TEXT_OPTIONS: sanitize.IOptions = {
  allowedTags: ALLOWED_TAGS,
  // Les attributs sont filtrés et réécrits par `transformElement` ; cette liste ne fait qu'autoriser
  // ceux qu'il peut laisser passer.
  allowedAttributes: {
    '*': ['class'],
    a: ['href', 'target', 'rel'],
    li: ['data-list'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  nonTextTags: NON_TEXT_TAGS,
  transformTags: {
    '*': transformElement,
  },
  // Pas de commentaires HTML ni d'instructions de traitement dans le contenu stocké.
  parser: { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
};

const STRIP_ALL_OPTIONS: sanitize.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
  nonTextTags: NON_TEXT_TAGS,
  parser: { decodeEntities: true, lowerCaseTags: true },
};

// sanitize-html ré-échappe le texte en sortie ; en texte brut on veut les caractères eux-mêmes.
function decodeOutputEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// Fin de bloc et <br> : séparent les textes qu'ils entourent une fois retirés (« <p>a</p><p>b</p> » → « a\nb »).
const BLOCK_BOUNDARY_PATTERN = /<(?:\/(?:p|div|li|ul|ol|h[1-6]|blockquote|pre|tr|td|th|section|article|header|footer)|br\b)[^>]*>/gi;

export type PlainTextOptions = {
  /** Conserve les sauts de ligne (deux au maximum d'affilée). Sinon tout blanc devient une espace. */
  multiline?: boolean;
};

/**
 * HTML riche (Quill, import OTA) : ne garde que les balises, attributs, classes et schémas d'URL de la
 * politique ci-dessus. Renvoie '' pour tout ce qui n'est pas une chaîne.
 */
export function sanitizeRichText(html: unknown): string {
  if (typeof html !== 'string') return '';
  const input = html.replace(CONTROL_CHARS_PATTERN, '');
  if (!input.trim()) return '';
  return sanitize(input, RICH_TEXT_OPTIONS).trim();
}

/**
 * Texte brut (titres, noms, messages, avis) : balises retirées, entités décodées, caractères de
 * contrôle supprimés, blancs normalisés. Renvoie '' pour tout ce qui n'est pas une chaîne.
 */
export function sanitizePlainText(value: unknown, options: PlainTextOptions = {}): string {
  if (typeof value !== 'string') return '';
  if (!value) return '';

  const withBoundaries = value.replace(BLOCK_BOUNDARY_PATTERN, (tag) => `\n${tag}`);
  const stripped = decodeOutputEntities(sanitize(withBoundaries, STRIP_ALL_OPTIONS))
    .replace(/ /g, ' ')
    .replace(CONTROL_CHARS_PATTERN, '')
    .replace(/\r\n?/g, '\n');

  if (!options.multiline) {
    return stripped.replace(/\s+/g, ' ').trim();
  }

  return stripped
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type TextFieldPolicy = 'rich' | 'plain' | 'plain-multiline';

/**
 * Règles par chemin dans un objet JSON. Segments séparés par des points, `*` = toutes les clés d'un
 * objet ou tous les éléments d'un tableau. Exemple : `{ 'rooms.*.name': 'plain', description: 'rich' }`.
 */
export type TextFieldRules = Record<string, TextFieldPolicy>;

function applyPolicy(value: unknown, policy: TextFieldPolicy): unknown {
  if (typeof value !== 'string') return value;
  if (policy === 'rich') return sanitizeRichText(value);
  return sanitizePlainText(value, { multiline: policy === 'plain-multiline' });
}

function applyRuleAtPath(node: unknown, segments: string[], index: number, policy: TextFieldPolicy): void {
  const segment = segments[index];
  if (segment === undefined || node === null || typeof node !== 'object') return;
  const isLast = index === segments.length - 1;

  const visit = (container: Record<string, unknown> | unknown[], key: string | number) => {
    const child = (container as Record<string | number, unknown>)[key];
    if (isLast) {
      if (typeof child === 'string') (container as Record<string | number, unknown>)[key] = applyPolicy(child, policy);
      return;
    }
    applyRuleAtPath(child, segments, index + 1, policy);
  };

  if (segment === '*') {
    if (Array.isArray(node)) node.forEach((_, i) => visit(node, i));
    else Object.keys(node as Record<string, unknown>).forEach((key) => visit(node as Record<string, unknown>, key));
    return;
  }

  if (Array.isArray(node)) return;
  if (!Object.prototype.hasOwnProperty.call(node, segment)) return;
  visit(node as Record<string, unknown>, segment);
}

/**
 * Applique les règles à une copie profonde de `value` (l'entrée n'est jamais modifiée). Les chemins
 * absents sont ignorés ; les valeurs non textuelles sont laissées telles quelles.
 */
export function sanitizeTextFields<T>(value: T, rules: TextFieldRules): T {
  if (value === null || typeof value !== 'object') return value;
  const clone = structuredClone(value);
  for (const [path, policy] of Object.entries(rules)) {
    applyRuleAtPath(clone, path.split('.'), 0, policy);
  }
  return clone;
}

// ---------------------------------------------------------------------------------------------
// Politiques par section d'annonce (cf. `frontend/src/domain/listings/types.ts`). Les clés absentes
// d'une section (patch partiel) sont simplement ignorées.

/** `core` : titre, description Quill, message de pause, localisation, pièces, équipements, atouts. */
export const LISTING_CORE_TEXT_RULES: TextFieldRules = {
  title: 'plain',
  description: 'rich',
  pause_message: 'plain-multiline',
  tourismRegistrationNumber: 'plain',
  city: 'plain',
  region: 'plain',
  country: 'plain',
  precise_address: 'plain',
  'rooms.*.name': 'plain',
  'rooms.*.description': 'plain-multiline',
  'amenities.*.name': 'plain',
  'amenities.*.description': 'plain-multiline',
  'amenities.*.category': 'plain',
  'perkSettings.*.name': 'plain',
  'perkSettings.*.description': 'plain-multiline',
};

/** `arrival` : intro et champs courts en texte brut ; règles, commerces et guide édités dans Quill. */
export const LISTING_ARRIVAL_TEXT_RULES: TextFieldRules = {
  'intro.title': 'plain',
  'intro.subtitle': 'plain',
  'intro.tagline': 'plain',
  'practical.savings.*': 'plain-multiline',
  'practical.access.*': 'plain-multiline',
  'practical.services.*': 'plain-multiline',
  'practical.rules': 'rich',
  'practical.shops': 'rich',
  'guide.title': 'plain',
  'guide.content': 'rich',
};

/** `comments` : avis (pages de commentaires) ; `profile-pic` est une URL, non touchée. */
export const LISTING_COMMENTS_TEXT_RULES: TextFieldRules = {
  'comments.*.*.name': 'plain',
  'comments.*.*.author': 'plain',
  'comments.*.*.comment': 'plain-multiline',
  'comments.*.*.text': 'plain-multiline',
};

/** `notes` : libellés de source des notes OTA. */
export const LISTING_NOTES_TEXT_RULES: TextFieldRules = {
  'note.source': 'plain',
  'otas-note.*.ota': 'plain',
  'otas-note.*.sourceLabel': 'plain',
};

/** `host` : identité affichée sur l'annonce ; `avatar` et `catalog-link` sont des URL, non touchées. */
export const LISTING_HOST_TEXT_RULES: TextFieldRules = {
  name: 'plain',
  displayName: 'plain',
  pseudo: 'plain',
  status: 'plain',
  email: 'plain',
  phone: 'plain',
  bio: 'plain-multiline',
  description: 'plain-multiline',
  companyName: 'plain',
  siret: 'plain',
};

// Médias : seules les descriptions (alt) des photos et vidéos sont du texte libre.
export const LISTING_MEDIAS_TEXT_RULES: TextFieldRules = {
  'images.*.alt': 'plain',
  'videos.*.alt': 'plain',
};

const LISTING_SECTION_TEXT_RULES: Record<string, TextFieldRules | undefined> = {
  core: LISTING_CORE_TEXT_RULES,
  arrival: LISTING_ARRIVAL_TEXT_RULES,
  comments: LISTING_COMMENTS_TEXT_RULES,
  notes: LISTING_NOTES_TEXT_RULES,
  host: LISTING_HOST_TEXT_RULES,
  medias: LISTING_MEDIAS_TEXT_RULES,
};

/** Nettoie une section d'annonce (`core`, `arrival`, `comments`, `notes`, `host`) ; les autres passent telles quelles. */
export function sanitizeListingSection<T extends Record<string, unknown>>(section: string, value: T): T {
  const rules = LISTING_SECTION_TEXT_RULES[section];
  return rules ? sanitizeTextFields(value, rules) : value;
}
