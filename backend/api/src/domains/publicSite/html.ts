// HTML servi pour les sites d'hôtes : balises de tête (titre, description, canonique, aperçus de
// partage, données structurées), contenu pré-rendu dans `#app`, `robots.txt` et sitemap.
// Tout texte venu d'une annonce est échappé ici : rien n'est inséré tel quel.

import type { SiteFooter } from '../listings/hubPage.js';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value: string): string {
  return escapeHtml(value);
}

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const LINE_SEPARATORS = new RegExp(`[${LINE_SEPARATOR}${String.fromCharCode(0x2029)}]`, "g");

/** JSON dans une balise `<script>` : `</script>` ne doit pas pouvoir la refermer. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    // Séparateurs de ligne Unicode (U+2028, U+2029) : valides en JSON, pas dans un script.
    .replace(LINE_SEPARATORS, (char) => (char === LINE_SEPARATOR ? '\\u2028' : '\\u2029'));
}

export type HeadTags = {
  title: string;
  description: string;
  canonical: string;
  /** `noindex` pour une annonce en pause, en brouillon ou introuvable. */
  noindex: boolean;
  siteName: string;
  image: string | null;
  imageAlt: string;
  jsonLd: unknown[];
};

/**
 * Balises de tête. Elles portent `data-ih-ssr` : le site les retire au démarrage et les repose
 * lui-même (avec les mêmes valeurs), sauf les données structurées, qu'il ne produit pas.
 */
export function renderHead(tags: HeadTags): string {
  const meta = (attribute: 'name' | 'property', key: string, content: string) => (
    `<meta ${attribute}="${key}" content="${escapeHtml(content)}" data-ih-ssr />`
  );
  const lines = [
    `<title>${escapeHtml(tags.title)}</title>`,
    ...(tags.description ? [meta('name', 'description', tags.description)] : []),
    ...(tags.canonical ? [`<link rel="canonical" href="${escapeHtml(tags.canonical)}" data-ih-ssr />`] : []),
    ...(tags.noindex ? [meta('name', 'robots', 'noindex')] : []),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:locale', 'fr_FR'),
    meta('property', 'og:site_name', tags.siteName),
    meta('property', 'og:title', tags.title),
    ...(tags.description ? [meta('property', 'og:description', tags.description)] : []),
    ...(tags.canonical ? [meta('property', 'og:url', tags.canonical)] : []),
    ...(tags.image ? [meta('property', 'og:image', tags.image), meta('property', 'og:image:alt', tags.imageAlt)] : []),
    meta('name', 'twitter:card', tags.image ? 'summary_large_image' : 'summary'),
    meta('name', 'twitter:title', tags.title),
    ...(tags.description ? [meta('name', 'twitter:description', tags.description)] : []),
    ...(tags.image ? [meta('name', 'twitter:image', tags.image)] : []),
    meta('name', 'apple-mobile-web-app-title', tags.siteName),
    ...tags.jsonLd.map((data) => `<script type="application/ld+json" data-ih-ssr>${jsonForScript(data)}</script>`),
    PRERENDER_STYLE,
  ];
  return lines.join('\n    ');
}

/*
 * Contenu pré-rendu masqué tant que le site n'a pas démarré (sinon le texte brut apparaîtrait un
 * instant), lisible quand le script est désactivé. Vue remplace `#app` au montage. Même règle que le
 * pré-rendu de l'accueil (`frontend/plugins/marketing-prerender`).
 */
const PRERENDER_STYLE = [
  '<style data-prerender>',
  '[data-prerender]{position:absolute;top:0;left:0;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
  '@media (scripting:none){[data-prerender]{position:static;width:auto;max-width:48rem;height:auto;margin:0 auto;padding:2rem 1rem;overflow:visible;clip-path:none;white-space:normal;font-family:system-ui,sans-serif;line-height:1.5}[data-prerender] img{max-width:100%;height:auto}}',
  '</style>',
].join('');

// --- Shell du site ------------------------------------------------------------------------------

// Balises de l'accueil d'IndieHost présentes dans `index.html` : elles ne doivent jamais apparaître
// sur le site d'un hôte (titre, description, canonique, aperçus, données structurées, image préchargée).
const SHELL_SEO_PATTERNS: RegExp[] = [
  /<title>[\s\S]*?<\/title>\s*/gi,
  /<meta\b[^>]*\b(?:name|property)\s*=\s*"(?:description|keywords|robots|og:[^"]*|twitter:[^"]*|apple-mobile-web-app-title)"[^>]*>\s*/gi,
  /<link\b[^>]*\brel\s*=\s*"canonical"[^>]*>\s*/gi,
  /<script\b[^>]*\btype\s*=\s*"application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi,
  /<link\b[^>]*\bhref\s*=\s*"[^"]*hero-image[^"]*"[^>]*>\s*/gi,
  /<style\b[^>]*\bdata-prerender\b[^>]*>[\s\S]*?<\/style>\s*/gi,
];

export function stripShellSeo(shell: string): string {
  return SHELL_SEO_PATTERNS.reduce((html, pattern) => html.replace(pattern, ''), shell);
}

const APP_PATTERN = /<div\s+id="app"([^>]*)>[\s\S]*?<\/div>(\s*(?:<script|<\/body>))/i;

/** Page complète : shell du site sans les balises de l'accueil, nos balises, notre contenu dans `#app`. */
export function injectIntoShell(shell: string, head: string, body: string): string {
  const cleaned = stripShellSeo(shell);
  if (!/<\/head>/i.test(cleaned) || !APP_PATTERN.test(cleaned)) {
    throw new Error('[public-site] shell inattendu : </head> ou <div id="app"> introuvable');
  }
  return cleaned
    .replace(/<\/head>/i, `    ${head}\n  </head>`)
    .replace(APP_PATTERN, (_match, attributes: string, after: string) => `<div id="app"${attributes}>${body}</div>${after}`);
}

// --- Contenu pré-rendu ----------------------------------------------------------------------------

export type PrerenderImage = { src: string; alt: string };

export type PrerenderListingCard = {
  title: string;
  href: string;
  place: string;
  facts: string[];
  image: PrerenderImage | null;
};

export type PrerenderSection =
  | { type: 'text'; title: string; paragraphs: string[]; image: PrerenderImage | null }
  | { type: 'gallery'; title: string; images: PrerenderImage[] }
  | { type: 'rating'; title: string; summary: string }
  | { type: 'listings'; title: string; cards: PrerenderListingCard[] };

export type PrerenderPage = {
  eyebrow: string;
  title: string;
  lead: string;
  facts: string[];
  images: PrerenderImage[];
  sections: PrerenderSection[];
  backLink: { href: string; label: string } | null;
  footer: SiteFooter;
};

function paragraphs(texts: string[]): string {
  return texts.map((text) => `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`).join('');
}

function image(entry: PrerenderImage): string {
  return `<img src="${escapeHtml(entry.src)}" alt="${escapeHtml(entry.alt)}" loading="lazy">`;
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`;
}

function renderFooter(footer: SiteFooter, year: number): string {
  const contacts = [
    footer.email ? `<a href="mailto:${escapeHtml(footer.email)}">${escapeHtml(footer.email)}</a>` : '',
    footer.phone ? `<a href="${escapeHtml(telHref(footer.phone))}">${escapeHtml(footer.phone)}</a>` : '',
  ].filter(Boolean);
  return [
    '<footer>',
    footer.name ? `<p><strong>${escapeHtml(footer.name)}</strong></p>` : '',
    footer.text ? `<p>${escapeHtml(footer.text)}</p>` : '',
    contacts.length ? `<p>${contacts.join(' · ')}</p>` : '',
    `<p>© ${year} ${escapeHtml(footer.name || 'IndieHost')}</p>`,
    '</footer>',
  ].join('');
}

function renderSection(section: PrerenderSection): string {
  const heading = section.title ? `<h2>${escapeHtml(section.title)}</h2>` : '';
  if (section.type === 'text') {
    return `<section>${heading}${paragraphs(section.paragraphs)}${section.image ? image(section.image) : ''}</section>`;
  }
  if (section.type === 'gallery') {
    return `<section>${heading}${section.images.map(image).join('')}</section>`;
  }
  if (section.type === 'rating') {
    return `<section>${heading}<p>${escapeHtml(section.summary)}</p></section>`;
  }
  const cards = section.cards.map((card) => [
    '<li>',
    `<a href="${escapeHtml(card.href)}">`,
    card.image ? image(card.image) : '',
    `<h3>${escapeHtml(card.title)}</h3>`,
    '</a>',
    card.place ? `<p>${escapeHtml(card.place)}</p>` : '',
    card.facts.length ? `<p>${escapeHtml(card.facts.join(' · '))}</p>` : '',
    '</li>',
  ].join('')).join('');
  return `<section id="logements">${heading}<ul>${cards}</ul></section>`;
}

export function renderPrerender(page: PrerenderPage, year = new Date().getFullYear()): string {
  return [
    '<div data-prerender>',
    '<main>',
    '<header>',
    page.backLink ? `<p><a href="${escapeHtml(page.backLink.href)}">${escapeHtml(page.backLink.label)}</a></p>` : '',
    page.eyebrow ? `<p>${escapeHtml(page.eyebrow)}</p>` : '',
    `<h1>${escapeHtml(page.title)}</h1>`,
    page.lead ? `<p>${escapeHtml(page.lead)}</p>` : '',
    page.facts.length ? `<p>${escapeHtml(page.facts.join(' · '))}</p>` : '',
    '</header>',
    page.images.map(image).join(''),
    page.sections.map(renderSection).join(''),
    '</main>',
    renderFooter(page.footer, year),
    '</div>',
  ].join('');
}

// --- robots.txt et sitemap ------------------------------------------------------------------------

export function renderRobots(origin: string, siteName: string): string {
  return [
    `# ${siteName.replace(/[\r\n]+/g, ' ')}`,
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /dashboard/',
    'Disallow: /listing/guide/',
    'Disallow: /booking/confirmation/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export type SitemapEntry = {
  loc: string;
  lastmod: Date;
  images: string[];
};

export function renderSitemap(entries: SitemapEntry[]): string {
  const urls = entries.map((entry) => [
    '  <url>',
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    `    <lastmod>${entry.lastmod.toISOString()}</lastmod>`,
    ...entry.images.slice(0, 10).map((src) => `    <image:image><image:loc>${escapeXml(src)}</image:loc></image:image>`),
    '  </url>',
  ].join('\n'));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}
