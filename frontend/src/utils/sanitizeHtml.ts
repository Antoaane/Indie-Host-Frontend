// File: src/utils/sanitizeHtml.ts

import DOMPurify from 'dompurify'

// Tout HTML venant d'un hôte (Quill, import Airbnb / Booking) ou d'un voyageur passe par ici avant un v-html.

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
]

// Liste blanche : aucun on*, style ou id ne passe. data-list = puces des listes Quill 2.
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'data-list']

// Redondant avec ALLOWED_TAGS, gardé si la liste blanche s'élargit un jour
const FORBID_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button']

// Liens absolus http(s), mailto et tel uniquement (javascript:, data:, relatifs… retirés)
const ALLOWED_URI_REGEXP = /^(?:https?|mailto|tel):/i

// Classes Quill uniquement (ql-align-*, ql-indent-*…) : pas de classes de l'app ni Tailwind dans le contenu
const QUILL_CLASS_PATTERN = /^ql-[a-z0-9-]+$/

// Instance dédiée : les hooks ne fuient pas vers d'autres usages de DOMPurify
const purifier = DOMPurify()

purifier.addHook('afterSanitizeAttributes', (node) => {
  const classes = node.getAttribute('class')
  if (classes !== null) {
    const kept = classes.split(/\s+/).filter((name) => QUILL_CLASS_PATTERN.test(name))
    if (kept.length) node.setAttribute('class', kept.join(' '))
    else node.removeAttribute('class')
  }

  if (node.tagName === 'A' && node.hasAttribute('target')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function sanitizeHtml(html: unknown): string {
  if (typeof html === 'number') return String(html)
  if (typeof html !== 'string' || !html) return ''

  // Hors navigateur DOMPurify renverrait l'entrée telle quelle : on échappe
  if (!purifier.isSupported) return escapeHtml(html)

  return purifier.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    ALLOWED_URI_REGEXP,
    // target / rel / data-list ne sont pas des URL : sans ça la regex ci-dessus les supprimerait
    ADD_URI_SAFE_ATTR: ['target', 'rel', 'data-list'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  })
}
