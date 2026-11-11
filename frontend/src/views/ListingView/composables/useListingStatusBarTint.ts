// File: src/views/ListingView/composables/useListingStatusBarTint.ts

import { onBeforeUnmount, watch, type Ref } from 'vue'

// Bande de la barre d'état d'un iPhone, en haut de la page d'un logement.
//
// Sous iOS 26, Safari ne laisse pas une page dessiner sous la barre d'état (en portrait, dans un
// onglet) et colore cette bande avec le fond du `body` ; la balise `theme-color` n'y sert plus qu'aux
// applications installées. Le `body` était noir sur cette page : bande noire au-dessus de la photo.
// On lui donne la couleur du bord haut visible de la première photo, qui semble ainsi monter jusqu'en
// haut de l'écran. Chrome sur Android lit `theme-color` : même couleur.
//
// La couleur est lue sur une miniature (48 px de large) : ImageKit envoie
// `Access-Control-Allow-Origin: *`, ce qui permet de lire ses pixels. Une photo hébergée ailleurs, sans
// cet en-tête, laisse simplement le fond clair de la page.

const PHOTO_FRAME_RATIO = 3 / 2 // cadre de la photo sur téléphone (`gallery.scss`)
const SAMPLE_WIDTH = 48

function toThumbnailUrl(src: string): string {
  try {
    const url = new URL(src, window.location.href)
    if (url.hostname.endsWith('imagekit.io')) url.searchParams.set('tr', `w-${SAMPLE_WIDTH}`)
    return url.toString()
  } catch {
    return src
  }
}

async function readTopEdgeColor(src: string): Promise<string | null> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.decoding = 'async'
  image.src = toThumbnailUrl(src)
  await image.decode()

  const width = SAMPLE_WIDTH
  const height = Math.max(1, Math.round((image.naturalHeight * width) / Math.max(1, image.naturalWidth)))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(image, 0, 0, width, height)

  // Partie visible dans le cadre 3:2 (photo recadrée au centre, comme `object-fit: cover`).
  const visibleHeight = Math.min(height, width / PHOTO_FRAME_RATIO)
  const visibleWidth = Math.min(width, height * PHOTO_FRAME_RATIO)
  const top = Math.floor((height - visibleHeight) / 2)
  const left = Math.floor((width - visibleWidth) / 2)
  const rows = Math.max(1, Math.round(visibleHeight * 0.05))
  const pixels = context.getImageData(left, top, Math.max(1, Math.round(visibleWidth)), rows).data

  let red = 0
  let green = 0
  let blue = 0
  let count = 0
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 200) continue
    red += pixels[index]
    green += pixels[index + 1]
    blue += pixels[index + 2]
    count += 1
  }
  if (!count) return null
  return `rgb(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)})`
}

// Couleur déjà lue pour une photo : la teinte revient aussitôt quand on remonte vers la photo.
const colorCache = new Map<string, string | null>()

async function topEdgeColor(src: string): Promise<string | null> {
  if (colorCache.has(src)) return colorCache.get(src) ?? null
  // Photo illisible (hébergée sans en-tête CORS, introuvable) : retenue aussi, sans nouvel essai.
  const color = await readTopEdgeColor(src).catch(() => null)
  colorCache.set(src, color)
  return color
}

export function useListingStatusBarTint(src: Ref<string | null>, enabled: Ref<boolean>) {
  if (typeof window === 'undefined') return

  let applied = false
  let previousBodyBackground = ''
  let themeMeta: HTMLMetaElement | null = null
  let createdThemeMeta = false
  let previousThemeColor: string | null = null
  let requestId = 0

  function apply(color: string) {
    if (!applied) {
      previousBodyBackground = document.body.style.backgroundColor
      themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      createdThemeMeta = !themeMeta
      if (!themeMeta) {
        themeMeta = document.createElement('meta')
        themeMeta.name = 'theme-color'
        document.head.appendChild(themeMeta)
      }
      previousThemeColor = themeMeta.getAttribute('content')
      applied = true
    }
    document.body.style.backgroundColor = color
    themeMeta?.setAttribute('content', color)
  }

  function restore() {
    requestId += 1
    if (!applied) return
    document.body.style.backgroundColor = previousBodyBackground
    if (createdThemeMeta) themeMeta?.remove()
    else if (previousThemeColor !== null) themeMeta?.setAttribute('content', previousThemeColor)
    themeMeta = null
    applied = false
  }

  watch(
    [src, enabled],
    async ([nextSrc, isEnabled]) => {
      // Seulement sur la page publique : l'aperçu de l'éditeur n'a pas à teinter le tableau de bord.
      if (!isEnabled || !nextSrc || !document.querySelector('main#listing-page')) {
        restore()
        return
      }

      const currentRequest = ++requestId
      try {
        const color = await topEdgeColor(nextSrc)
        if (currentRequest !== requestId) return
        if (color) apply(color)
      } catch {
        // Photo illisible (hébergée sans en-tête CORS, introuvable) : fond clair de la page.
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(restore)
}
