import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

/*
 * Pré-rendu des documents légaux : pour chaque entrée de src/views/Legal/legalPages.json, écrit
 * dist/legal/<slug>/index.html avec le document déjà présent dans #app, son titre, sa description
 * et son URL canonique. Robots et agents IA lisent ainsi la page sans exécuter de JavaScript ;
 * au chargement, Vue monte l'application à la place de ce contenu.
 */

type LegalRegistry = {
  updatedAtLabel: string
  canonicalOrigin: string
  pages: Array<{ slug: string; title: string; navLabel: string; description: string }>
}

const LEGAL_DIR = path.join('src', 'views', 'Legal')

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function replaceOnce(html: string, pattern: RegExp, replacement: string, label: string): string {
  if (!pattern.test(html)) throw new Error(`[legal-prerender] balise introuvable dans index.html : ${label}`)
  return html.replace(pattern, replacement)
}

function buildPageMarkup(registry: LegalRegistry, page: LegalRegistry['pages'][number], content: string): string {
  const navItems = registry.pages
    .map((item) => {
      const current = item.slug === page.slug ? ' aria-current="page"' : ''
      return `<li><a href="/legal/${item.slug}"${current}>${escapeHtml(item.navLabel)}</a></li>`
    })
    .join('')

  return [
    '<main><div class="legal-page"><div class="wrapper__md legal-page__inner">',
    '<div class="legal-page__header">',
    `<h1 class="legal-page__title">${escapeHtml(page.title)}</h1>`,
    `<p class="legal-page__updated">Dernière mise à jour : ${escapeHtml(registry.updatedAtLabel)}</p>`,
    '</div>',
    `<article class="legal-page__content">${content}</article>`,
    `<nav class="legal-page__nav" aria-label="Informations légales"><ul>${navItems}</ul></nav>`,
    '</div></div></main>',
  ].join('')
}

export default function legalPrerender(): Plugin {
  let config: ResolvedConfig

  return {
    name: 'indiehost-legal-prerender',
    apply: 'build',
    configResolved(resolvedConfig) {
      config = resolvedConfig
    },
    closeBundle() {
      const outDir = path.resolve(config.root, config.build.outDir)
      const template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf-8')
      const registry = JSON.parse(
        fs.readFileSync(path.resolve(config.root, LEGAL_DIR, 'legalPages.json'), 'utf-8'),
      ) as LegalRegistry

      for (const page of registry.pages) {
        const rawContent = fs.readFileSync(path.resolve(config.root, LEGAL_DIR, 'content', `${page.slug}.html`), 'utf-8')
        const content = rawContent.replace(/^\s*<!--[\s\S]*?-->\s*/, '')
        const title = escapeHtml(`${page.title} | IndieHost`)
        const description = escapeHtml(page.description)
        const canonical = `${registry.canonicalOrigin}/legal/${page.slug}`

        let html = template
        html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, 'title')
        html = replaceOnce(html, /<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${description}" />`, 'description')
        html = replaceOnce(html, /<meta\s+property="og:title"[\s\S]*?\/>/, `<meta property="og:title" content="${title}" />`, 'og:title')
        html = replaceOnce(html, /<meta\s+property="og:description"[\s\S]*?\/>/, `<meta property="og:description" content="${description}" />`, 'og:description')
        html = replaceOnce(html, /<meta\s+property="og:url"[\s\S]*?\/>/, `<meta property="og:url" content="${canonical}" />`, 'og:url')
        html = replaceOnce(html, /<meta\s+name="twitter:title"[\s\S]*?\/>/, `<meta name="twitter:title" content="${title}" />`, 'twitter:title')
        html = replaceOnce(html, /<meta\s+name="twitter:description"[\s\S]*?\/>/, `<meta name="twitter:description" content="${description}" />`, 'twitter:description')
        html = replaceOnce(html, /<\/head>/, `  <link rel="canonical" href="${canonical}" />\n  </head>`, 'head')
        html = replaceOnce(
          html,
          /<div\s+id="app"([^>]*)>\s*<\/div>/,
          `<div id="app"$1>${buildPageMarkup(registry, page, content)}</div>`,
          '#app',
        )

        const pageDir = path.join(outDir, 'legal', page.slug)
        fs.mkdirSync(pageDir, { recursive: true })
        fs.writeFileSync(path.join(pageDir, 'index.html'), html)
      }
    },
  }
}
