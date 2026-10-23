import fs from 'node:fs'
import path from 'node:path'
import { transformWithEsbuild, type Plugin, type ResolvedConfig } from 'vite'

/*
 * Pré-rendu statique de la page d'accueil (`/`) et de la page des tarifs (`/pricing`), sur le modèle
 * de `legal-prerender` : le contenu marketing français (titres, paragraphes, étapes, offres, FAQ) est
 * écrit dans `#app` de `dist/index.html` et de `dist/pricing/index.html`, à partir des mêmes sources
 * que l'application (`src/locales/landing/fr.json`, `src/domain/payments/pricingPlanCatalog.ts`).
 *
 * - Robots et agents IA sans JavaScript lisent la page ; les navigateurs chargent le même shell
 *   (balises `<script type="module">` et CSS construites par Vite) et Vue remplace ce contenu au montage.
 * - Le bloc est masqué visuellement (`[data-prerender]`, style en ligne de ce document uniquement) pour
 *   éviter un flash de texte brut avant le montage, et redevient lisible quand le script est désactivé
 *   (`@media (scripting: none)`).
 * - Une clé de locale absente fait sauter la section concernée, jamais échouer le build.
 * - JSON-LD ajouté dans la version statique seulement : `FAQPage` sur `/`, `Product`/`Offer` sur `/pricing`.
 *
 * Ordre des plugins : à déclarer APRÈS `legalPrerender()` dans vite.config.ts, car ce plugin réécrit
 * `dist/index.html` alors que le pré-rendu légal a besoin du shell vierge (`#app` vide).
 */

const LANDING_LOCALE = path.join('src', 'locales', 'landing', 'fr.json')
const PRICING_CATALOG = path.join('src', 'domain', 'payments', 'pricingPlanCatalog.ts')
const FALLBACK_ORIGIN = 'https://indiehost.fr'
const LOG_PREFIX = '[marketing-prerender]'

type Dict = Record<string, unknown>

type CtaLink = { label: string; href: string }

type MarketingPlan = {
  id: string
  name: string
  displayPrice: string
  summary: string
  includes: string[]
  options?: string[]
  positioning?: string
  cta?: string
  helper?: string
  highlight?: string
}

type ExtraListing = { name: string; displayPrice: string; summary: string }

type PricingCatalog = { plans: MarketingPlan[]; extraListing: ExtraListing | null }

// ---------------------------------------------------------------------------------------------------
// Accès tolérant au JSON de locale
// ---------------------------------------------------------------------------------------------------

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function dict(value: unknown): Dict | null {
  return isDict(value) ? value : null
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function cta(value: unknown): CtaLink | null {
  const entry = dict(value)
  const label = str(entry?.label)
  const href = str(entry?.href)
  return label && href ? { label, href } : null
}

// ---------------------------------------------------------------------------------------------------
// Texte et HTML
// ---------------------------------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Texte brut d'un fragment HTML de locale (JSON-LD, meta description). */
function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Les CTA de l'application mènent au tableau de bord (connexion requise) : la version statique renvoie vers l'inscription. */
function resolveCtaHref(href: string): string {
  if (/^\/dashboard(\/|$)/.test(href) || /^\/(editor|create-listing)(\/|$)/.test(href)) return '/sign-up'
  return href
}

function linkHtml(link: CtaLink | null, className?: string): string {
  if (!link) return ''
  const cls = className ? ` class="${className}"` : ''
  return `<a${cls} href="${escapeHtml(resolveCtaHref(link.href))}">${link.label}</a>`
}

function imageHtml(value: unknown): string {
  const image = dict(value)
  const src = str(image?.webp) ?? str(image?.png)
  if (!src) return ''
  const alt = str(image?.alt) ?? ''
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />`
}

function tag(name: string, content: string | null | undefined, attrs = ''): string {
  if (!content) return ''
  return `<${name}${attrs ? ` ${attrs}` : ''}>${content}</${name}>`
}

/** Liste `<ul>` de chaînes de la locale (ou du catalogue), texte échappé. */
function ulHtml(items: unknown, className?: string): string {
  const entries = list(items).map(str).filter((item): item is string => Boolean(item))
  if (!entries.length) return ''
  const cls = className ? ` class="${className}"` : ''
  return `<ul${cls}>${entries.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function jsonLdScript(data: unknown): string {
  // `</script` ne doit pas apparaître dans le bloc, même échappé par JSON.stringify.
  const json = JSON.stringify(data, null, 2).replace(/<\//g, '<\\/')
  return `<script type="application/ld+json">\n${json}\n</script>`
}

// ---------------------------------------------------------------------------------------------------
// Sections de la page d'accueil
// ---------------------------------------------------------------------------------------------------

function heroSection(content: Dict): string {
  const hero = dict(content.hero)
  const title = str(hero?.title)
  if (!hero || !title) return ''
  const description = str(hero.descriptionDesktop) ?? str(hero.description)
  const primary = cta(hero.primaryCta)
  const secondary = cta(hero.secondaryCta)
  const secondaryHref = secondary ? { ...secondary, href: '#intro-section' } : null
  return [
    '<section id="hero-section">',
    `<h1>${title}</h1>`,
    tag('p', description, 'class="hero-desc"'),
    primary || secondaryHref ? `<p class="cta">${linkHtml(primary)} ${linkHtml(secondaryHref)}</p>` : '',
    imageHtml(list(hero.images)[0]),
    '</section>',
  ].join('')
}

function introSection(content: Dict): string {
  const intro = dict(content.introSection)
  const title = str(intro?.title)
  if (!intro || !title) return ''
  return [
    '<section id="intro-section">',
    `<h2>${title}</h2>`,
    tag('p', str(intro.body)),
    tag('p', str(intro.createAccountCtaHint)),
    tag('p', linkHtml(cta(intro.primaryCta))),
    '</section>',
  ].join('')
}

function featuresSection(content: Dict): string {
  const items = list(dict(content.features)?.items)
    .map((item) => {
      const feature = dict(item)
      const title = str(feature?.title)
      if (!feature || !title) return ''
      return `<article>${tag('h2', title)}${tag('p', str(feature.description))}${imageHtml(list(feature.images)[0])}</article>`
    })
    .filter(Boolean)
  if (!items.length) return ''
  return `<section id="features-section">${items.join('')}</section>`
}

function howSection(content: Dict): string {
  const how = dict(content.how)
  const title = str(how?.title)
  if (!how || !title) return ''
  return `<section id="how-section">${tag('h2', title)}${tag('p', str(how.body))}</section>`
}

function usageSection(content: Dict): string {
  const steps = list(dict(content.usage)?.steps)
    .map((entry) => {
      const step = dict(entry)
      const title = str(step?.title)
      if (!step || !title) return ''
      return `<li>${tag('h2', title)}${tag('p', str(step.description))}${imageHtml(list(step.images)[0])}</li>`
    })
    .filter(Boolean)
  if (!steps.length) return ''
  return `<section id="usage-section" aria-label="Comment utiliser IndieHost"><ol>${steps.join('')}</ol></section>`
}

function proofSection(content: Dict): string {
  const proof = dict(content.proofSection)
  const title = str(proof?.title)
  if (!proof || !title) return ''
  const metrics = list(proof.metrics)
    .map((entry) => {
      const metric = dict(entry)
      const value = str(metric?.value)
      const label = str(metric?.label)
      if (!metric || !value || !label) return ''
      return `<div>${tag('dt', escapeHtml(value))}${tag('dd', escapeHtml(label))}${tag('dd', str(metric.detail) ? escapeHtml(str(metric.detail) as string) : null, 'class="detail"')}</div>`
    })
    .filter(Boolean)
  const cards = list(proof.cards)
    .map((entry) => {
      const card = dict(entry)
      const cardTitle = str(card?.title)
      if (!card || !cardTitle) return ''
      return `<article>${tag('h3', escapeHtml(cardTitle))}${tag('p', str(card.description) ? escapeHtml(str(card.description) as string) : null)}</article>`
    })
    .filter(Boolean)
  return [
    '<section id="proof-section">',
    tag('p', str(proof.eyebrow) ? escapeHtml(str(proof.eyebrow) as string) : null, 'class="eyebrow"'),
    `<h2>${title}</h2>`,
    tag('p', str(proof.subtitle) ? escapeHtml(str(proof.subtitle) as string) : null),
    metrics.length ? `<dl class="metrics">${metrics.join('')}</dl>` : '',
    cards.join(''),
    '</section>',
  ].join('')
}

function strengthsSection(content: Dict): string {
  const strengths = dict(content.strengths)
  const title = str(strengths?.title)
  if (!strengths || !title) return ''
  const pillars = list(strengths.pillars)
    .map((entry) => {
      const pillar = dict(entry)
      const pillarTitle = str(pillar?.title)
      if (!pillar || !pillarTitle) return ''
      return `<article>${tag('h3', pillarTitle)}${tag('p', str(pillar.description))}</article>`
    })
    .filter(Boolean)
  return `<section id="strengths-section"><h2>${title}</h2>${tag('p', str(strengths.subtitle))}${pillars.join('')}</section>`
}

function planHtml(plan: MarketingPlan, headingLevel: 'h2' | 'h3'): string {
  return [
    `<article class="plan" id="${escapeHtml(plan.id)}">`,
    tag('p', plan.highlight ? escapeHtml(plan.highlight) : null, 'class="plan-highlight"'),
    `<${headingLevel}>${escapeHtml(plan.name)}</${headingLevel}>`,
    `<p class="price">${escapeHtml(plan.displayPrice)}</p>`,
    tag('p', escapeHtml(plan.summary), 'class="summary"'),
    plan.includes.length ? `<p class="block-label">Inclus</p>${ulHtml(plan.includes)}` : '',
    plan.options?.length ? `<p class="block-label">Options</p>${ulHtml(plan.options)}` : '',
    tag('p', plan.positioning ? escapeHtml(plan.positioning) : null, 'class="positioning"'),
    plan.cta ? `<p><a class="plan-cta" href="/sign-up">${escapeHtml(plan.cta)}</a></p>` : '',
    tag('p', plan.helper ? escapeHtml(plan.helper) : null, 'class="plan-helper"'),
    '</article>',
  ].join('')
}

function extraListingHtml(extra: ExtraListing | null): string {
  if (!extra) return ''
  return `<aside class="extra-listing"><h3>${escapeHtml(extra.name)}</h3><p class="price">${escapeHtml(extra.displayPrice)}</p><p>${escapeHtml(extra.summary)}</p></aside>`
}

/** Bloc tarifs commun à `/` (h2) et `/pricing` (h1). */
function pricingBlock(content: Dict, catalog: PricingCatalog, headingTag: 'h1' | 'h2'): string {
  const pricing = dict(content.pricingSection)
  const title = str(pricing?.title)
  if (!pricing || !title) return ''
  const planHeading = headingTag === 'h1' ? 'h2' : 'h3'
  const accountPrefix = str(pricing.accountPrefix)
  const accountLabel = str(pricing.accountLinkLabel)
  return [
    tag('p', str(pricing.eyebrow) ? escapeHtml(str(pricing.eyebrow) as string) : null, 'class="pricing-eyebrow"'),
    `<${headingTag}>${title}</${headingTag}>`,
    tag('p', str(pricing.subtitle) ? escapeHtml(str(pricing.subtitle) as string) : null, 'class="pricing-subtitle"'),
    catalog.plans.length ? `<div class="plans">${catalog.plans.map((plan) => planHtml(plan, planHeading)).join('')}</div>` : '',
    extraListingHtml(catalog.extraListing),
    accountLabel
      ? `<p class="account-link">${accountPrefix ? `${escapeHtml(accountPrefix)} ` : ''}<a href="/sign-in">${escapeHtml(accountLabel)}</a></p>`
      : '',
  ].join('')
}

function pricingSection(content: Dict, catalog: PricingCatalog): string {
  const block = pricingBlock(content, catalog, 'h2')
  if (!block) return ''
  return `<section id="pricing-section">${block}<p><a href="/pricing">Voir la page des tarifs</a></p></section>`
}

function joinSection(content: Dict): string {
  const join = dict(content.join)
  const title = str(join?.title)
  if (!join || !title) return ''
  const form = dict(join.form)
  return [
    '<section id="join-section">',
    `<h2>${title}</h2>`,
    tag('p', str(join.description)),
    tag('h3', str(form?.title)),
    tag('p', str(form?.description)),
    '</section>',
  ].join('')
}

type FaqLeaf = { question: string; answer: string }

function collectFaqLeaves(nodes: unknown[], out: FaqLeaf[] = []): FaqLeaf[] {
  for (const entry of nodes) {
    const node = dict(entry)
    if (!node) continue
    const children = list(node.children)
    if (children.length) {
      collectFaqLeaves(children, out)
      continue
    }
    const question = str(node.question)
    const answer = str(node.answer)
    if (question && answer) out.push({ question, answer })
  }
  return out
}

function faqNodeHtml(entry: unknown): string {
  const node = dict(entry)
  if (!node) return ''
  const children = list(node.children)
  if (children.length) {
    const inner = children.map(faqNodeHtml).filter(Boolean).join('')
    if (!inner) return ''
    return `<li>${tag('h3', str(node.title) ? escapeHtml(str(node.title) as string) : null)}<ul>${inner}</ul></li>`
  }
  const question = str(node.question)
  const answer = str(node.answer)
  if (!question || !answer) return ''
  return `<li><details><summary><h4>${question}</h4></summary><p>${answer}</p></details></li>`
}

function faqSection(content: Dict): string {
  const faq = dict(content.faq)
  const title = str(faq?.title)
  if (!faq || !title) return ''
  const nodes = list(faq.nodes).map(faqNodeHtml).filter(Boolean)
  if (!nodes.length) return ''
  return `<section id="faq-section"><h2>${title}</h2><ul class="faq-list">${nodes.join('')}</ul></section>`
}

function faqJsonLd(content: Dict): string {
  const leaves = collectFaqLeaves(list(dict(content.faq)?.nodes))
  if (!leaves.length) return ''
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: leaves.map((leaf) => ({
      '@type': 'Question',
      name: toPlainText(leaf.question),
      acceptedAnswer: { '@type': 'Answer', text: toPlainText(leaf.answer) },
    })),
  })
}

function finalCtaSection(content: Dict): string {
  const final = dict(content.finalCtaSection)
  const title = str(final?.title)
  if (!final || !title) return ''
  const primary = cta(final.primaryCta)
  const secondary = cta(final.secondaryCta)
  return [
    '<section id="final-cta-section">',
    tag('p', str(final.eyebrow) ? escapeHtml(str(final.eyebrow) as string) : null, 'class="eyebrow"'),
    `<h2>${title}</h2>`,
    tag('p', str(final.body) ? escapeHtml(str(final.body) as string) : null),
    primary || secondary ? `<p class="actions">${linkHtml(primary)} ${linkHtml(secondary)}</p>` : '',
    tag('p', str(final.note) ? escapeHtml(str(final.note) as string) : null, 'class="note"'),
    '</section>',
  ].join('')
}

function footerLinks(): string {
  return [
    '<nav aria-label="Pages du site"><ul>',
    '<li><a href="/">Accueil</a></li>',
    '<li><a href="/pricing">Tarifs</a></li>',
    '<li><a href="/sign-up">Créer un compte</a></li>',
    '<li><a href="/sign-in">Se connecter</a></li>',
    '<li><a href="/legal/mentions-legales">Mentions légales</a></li>',
    '<li><a href="/legal/confidentialite">Confidentialité</a></li>',
    '<li><a href="/legal/cgv">Conditions générales hôtes</a></li>',
    '<li><a href="/legal/cgu-voyageurs">Conditions voyageurs</a></li>',
    '</ul></nav>',
  ].join('')
}

function buildLandingMarkup(content: Dict, catalog: PricingCatalog): string {
  const sections = [
    heroSection(content),
    introSection(content),
    featuresSection(content),
    howSection(content),
    usageSection(content),
    proofSection(content),
    strengthsSection(content),
    pricingSection(content, catalog),
    joinSection(content),
    faqSection(content),
    finalCtaSection(content),
  ].filter(Boolean)
  return `<main id="landing-page" data-prerender>${sections.join('')}${footerLinks()}</main>`
}

function buildPricingMarkup(content: Dict, catalog: PricingCatalog): string {
  const block = pricingBlock(content, catalog, 'h1') || '<h1>Tarifs IndieHost</h1>'
  return `<main data-prerender><section id="pricing-page" class="pricing-unified app-pricing">${block}</section>${footerLinks()}</main>`
}

function parseEuroAmount(displayPrice: string): string | null {
  const match = displayPrice.match(/(\d+(?:[.,]\d{1,2})?)\s*€/)
  return match ? match[1].replace(',', '.') : null
}

function pricingJsonLd(catalog: PricingCatalog, canonical: string): string {
  const products = catalog.plans
    .map((plan) => {
      const price = parseEuroAmount(plan.displayPrice)
      if (!price) return null
      return {
        '@type': 'Product',
        name: `Abonnement ${plan.name}`,
        description: plan.summary,
        brand: { '@type': 'Brand', name: 'IndieHost' },
        category: 'Logiciel de gestion de location saisonnière',
        offers: {
          '@type': 'Offer',
          url: `${canonical}#${plan.id}`,
          price,
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price,
            priceCurrency: 'EUR',
            valueAddedTaxIncluded: true,
            billingDuration: 1,
            unitCode: 'MON',
          },
        },
      }
    })
    .filter(Boolean)
  if (!products.length) return ''
  return jsonLdScript({ '@context': 'https://schema.org', '@graph': products })
}

// ---------------------------------------------------------------------------------------------------
// Sources : locale et catalogue des offres
// ---------------------------------------------------------------------------------------------------

function readLandingLocale(root: string, warn: (message: string) => void): Dict {
  const file = path.resolve(root, LANDING_LOCALE)
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'))
    if (isDict(parsed)) return parsed
    warn(`${LOG_PREFIX} ${LANDING_LOCALE} n'est pas un objet : page d'accueil pré-rendue sans contenu.`)
  } catch (error) {
    warn(`${LOG_PREFIX} impossible de lire ${LANDING_LOCALE} (${(error as Error).message}) : page d'accueil pré-rendue sans contenu.`)
  }
  return {}
}

function toMarketingPlan(value: unknown): MarketingPlan | null {
  const plan = dict(value)
  const id = str(plan?.id)
  const name = str(plan?.name)
  const displayPrice = str(plan?.displayPrice)
  if (!plan || !id || !name || !displayPrice) return null
  const strings = (items: unknown) => list(items).map(str).filter((item): item is string => Boolean(item))
  return {
    id,
    name,
    displayPrice,
    summary: str(plan.summary) ?? '',
    includes: strings(plan.includes),
    options: strings(plan.options),
    positioning: str(plan.positioning) ?? undefined,
    cta: str(plan.cta) ?? undefined,
    helper: str(plan.helper) ?? undefined,
    highlight: str(plan.highlight) ?? undefined,
  }
}

/**
 * Charge `pricingPlanCatalog.ts` tel quel (source de vérité des offres côté front). Le module n'a que des
 * imports de types : esbuild les retire, le JavaScript obtenu est importé via une URL `data:`. Si un import
 * d'exécution y apparaît un jour, le build échoue avec un message explicite plutôt que de publier une page
 * de tarifs sans offres.
 */
async function loadPricingCatalog(root: string): Promise<PricingCatalog> {
  const file = path.resolve(root, PRICING_CATALOG)
  const source = fs.readFileSync(file, 'utf-8')
  const { code } = await transformWithEsbuild(source, file, { loader: 'ts', format: 'esm', target: 'node18', sourcemap: false })
  if (/^\s*import\s[^;]*\sfrom\s/m.test(code) || /^\s*import\s*['"]/m.test(code)) {
    throw new Error(
      `${LOG_PREFIX} ${PRICING_CATALOG} contient un import d'exécution : ce plugin ne charge que des modules autonomes. `
      + 'Déplacer les données marketing dans un module sans dépendance ou adapter loadPricingCatalog().',
    )
  }
  const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`
  const loaded: unknown = await import(/* @vite-ignore */ moduleUrl)
  const exports = dict(loaded) ?? {}
  const plans = list(exports.MARKETING_PRICING_PLANS).map(toMarketingPlan).filter((plan): plan is MarketingPlan => Boolean(plan))
  if (!plans.length) {
    throw new Error(`${LOG_PREFIX} aucune offre lisible dans MARKETING_PRICING_PLANS (${PRICING_CATALOG}).`)
  }
  const extra = dict(exports.EXTRA_LISTING_MARKETING)
  const extraName = str(extra?.name)
  const extraPrice = str(extra?.displayPrice)
  const extraListing = extraName && extraPrice
    ? { name: extraName, displayPrice: extraPrice, summary: str(extra?.summary) ?? '' }
    : null
  return { plans, extraListing }
}

// ---------------------------------------------------------------------------------------------------
// Assemblage des documents
// ---------------------------------------------------------------------------------------------------

/*
 * Masqué par défaut (le shell charge le CSS avant que Vue monte : sans cela le texte brut apparaîtrait un
 * instant), lisible quand le script est désactivé. Style propre à ces documents statiques, remplacé avec
 * le contenu au montage de l'application.
 */
const PRERENDER_STYLE = [
  '<style data-prerender>',
  '[data-prerender]{position:absolute;top:0;left:0;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
  '@media (scripting:none){[data-prerender]{position:static;width:auto;max-width:48rem;height:auto;margin:0 auto;padding:2rem 1rem;overflow:visible;clip-path:none;white-space:normal;font-family:system-ui,sans-serif;line-height:1.5}[data-prerender] img{max-width:100%;height:auto}}',
  '</style>',
].join('')

function readOrigin(template: string): string {
  const match = template.match(/<meta\s+property="og:url"\s+content="([^"]+)"/)
  if (!match) return FALLBACK_ORIGIN
  try {
    return new URL(match[1]).origin
  } catch {
    return FALLBACK_ORIGIN
  }
}

function replaceOnce(html: string, pattern: RegExp, replacement: string, label: string, warn: (message: string) => void): string {
  if (!pattern.test(html)) {
    warn(`${LOG_PREFIX} balise introuvable dans index.html : ${label} (laissée telle quelle).`)
    return html
  }
  return html.replace(pattern, replacement)
}

function injectApp(html: string, markup: string): string {
  const pattern = /<div\s+id="app"([^>]*)>\s*<\/div>/
  if (!pattern.test(html)) {
    throw new Error(`${LOG_PREFIX} <div id="app"> vide introuvable dans dist/index.html : le plugin doit s'exécuter après legal-prerender et avant tout autre pré-rendu.`)
  }
  return html.replace(pattern, `<div id="app"$1>${markup}</div>`)
}

function injectHead(html: string, extra: string, warn: (message: string) => void): string {
  return replaceOnce(html, /<\/head>/, `  ${extra}\n  </head>`, 'head', warn)
}

type PageMeta = { title: string; description: string; canonical: string }

function applyMeta(html: string, meta: PageMeta, warn: (message: string) => void): string {
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)
  let out = html
  out = replaceOnce(out, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, 'title', warn)
  out = replaceOnce(out, /<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${description}" />`, 'description', warn)
  out = replaceOnce(out, /<meta\s+property="og:title"[\s\S]*?\/>/, `<meta property="og:title" content="${title}" />`, 'og:title', warn)
  out = replaceOnce(out, /<meta\s+property="og:description"[\s\S]*?\/>/, `<meta property="og:description" content="${description}" />`, 'og:description', warn)
  out = replaceOnce(out, /<meta\s+property="og:url"[\s\S]*?\/>/, `<meta property="og:url" content="${meta.canonical}" />`, 'og:url', warn)
  out = replaceOnce(out, /<meta\s+name="twitter:title"[\s\S]*?\/>/, `<meta name="twitter:title" content="${title}" />`, 'twitter:title', warn)
  out = replaceOnce(out, /<meta\s+name="twitter:description"[\s\S]*?\/>/, `<meta name="twitter:description" content="${description}" />`, 'twitter:description', warn)
  return out
}

export default function marketingPrerender(): Plugin {
  let config: ResolvedConfig

  return {
    name: 'indiehost-marketing-prerender',
    apply: 'build',
    configResolved(resolvedConfig) {
      config = resolvedConfig
    },
    async closeBundle() {
      const warn = (message: string) => config.logger.warn(message)
      const outDir = path.resolve(config.root, config.build.outDir)
      const templatePath = path.join(outDir, 'index.html')
      if (!fs.existsSync(templatePath)) {
        warn(`${LOG_PREFIX} ${templatePath} absent : pré-rendu ignoré.`)
        return
      }
      const template = fs.readFileSync(templatePath, 'utf-8')
      const origin = readOrigin(template)
      const content = readLandingLocale(config.root, warn)
      const catalog = await loadPricingCatalog(config.root)

      // `/` : shell d'origine (titre et metas de index.html) + contenu de la page d'accueil + FAQPage.
      const landingHead = [`<link rel="canonical" href="${origin}/" />`, PRERENDER_STYLE, faqJsonLd(content)].filter(Boolean).join('\n  ')
      let landing = injectHead(template, landingHead, warn)
      landing = injectApp(landing, buildLandingMarkup(content, catalog))
      fs.writeFileSync(templatePath, landing)

      // `/pricing` : dist/pricing/index.html, servi par nginx via `try_files $uri $uri/index.html /index.html`.
      const pricingCanonical = `${origin}/pricing`
      const pricingContent = dict(content.pricingSection)
      const pricingTitle = str(pricingContent?.title)
      const pricingDescription = str(pricingContent?.subtitle)
        ?? 'Offres IndieHost et SuperHost sans commission sur vos réservations, avec 30 jours d’essai gratuit.'
      let pricing = applyMeta(template, {
        title: `${pricingTitle ? toPlainText(pricingTitle) : 'Tarifs'} | IndieHost`,
        description: toPlainText(pricingDescription),
        canonical: pricingCanonical,
      }, warn)
      const pricingHead = [`<link rel="canonical" href="${pricingCanonical}" />`, PRERENDER_STYLE, pricingJsonLd(catalog, pricingCanonical)]
        .filter(Boolean)
        .join('\n  ')
      pricing = injectHead(pricing, pricingHead, warn)
      pricing = injectApp(pricing, buildPricingMarkup(content, catalog))
      const pricingDir = path.join(outDir, 'pricing')
      fs.mkdirSync(pricingDir, { recursive: true })
      fs.writeFileSync(path.join(pricingDir, 'index.html'), pricing)

      config.logger.info(`${LOG_PREFIX} index.html (accueil) et pricing/index.html pré-rendus (${catalog.plans.length} offres, FAQ ${collectFaqLeaves(list(dict(content.faq)?.nodes)).length} questions).`)
    },
  }
}
