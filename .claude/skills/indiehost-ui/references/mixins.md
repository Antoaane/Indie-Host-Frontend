# Mixins et tokens IndieHost — signatures exactes

Source : `frontend/src/styles/`. Ce mémo résume ; en cas de doute, ouvrir le fichier source (chemins ci-dessous).

## Imports

| Alias | Import | Contenu |
|---|---|---|
| `*` (globals) | `@use '@/styles/variables/globals' as *` | forward de `colors`, `layouts`, `texts`, `effects` |
| `borders` | `@use '@/styles/variables/borders' as borders` | `$rounded-*`, `squircle()` |
| `animations` | `@use '@/styles/variables/animations' as animations` | `transition()` — **non forwardé par globals** |
| `buttons` | `@use '@/styles/components/buttons' as buttons` | `primary()`, `secondary()`, `low-btn()`, `link()`, `checkbox()` |
| `inputs` | `@use '@/styles/components/inputs' as inputs` | `field()`, `select()`, `textarea()`, `search()`, `action()`, `stepper()`… |
| `overlays` | `@use '@/styles/components/overlays' as overlays` | `%overlay-panel` |

## Couleurs — `variables/_colors.scss` (via globals)

- Principales : `$accent` #fcfafa · `$secondary` #111117 · `$tertiary` #ece8e8 · `$quaternary` #e2dede · `$quinary` #343339 · `$dark` #000 · `$translucent` rgba(255,255,255,0).
- Alias : `$secondary-text` = `$secondary` · `$secondary-button-reference` = `$secondary` · `$background` = `$accent-surface-3`.
- Surfaces : `$accent-surface-0..4` (dérivées de `$tertiary`, +2.5 % à −15 %) · `$secondary-surface-0..3` (encre éclaircie +90 % à +70 %) · `$translucent-surface-0..3` (`rgba(#111117, .1 / .15 / .2 / .3)`).
- Dégradés : `$primary_gradiant_first` rgb(163,153,255) · `$primary_gradiant_second` rgb(223,153,255) · `$primary_gradiant_third` rgb(255,196,197) · `$secondary_gradiant_first` rgb(254,251,153) · `$secondary_gradiant_second` rgb(153,255,226).
- Texte dégradé : `$accent_text_gradiant_first/second`, `$secondary_text_gradiant_first/second` (opacité 1 → .75).
- Statuts : `$airbnb` rgb(255,82,82) · `$bad` rgb(255,82,82) · `$good` rgb(0,255,166) · `$progressing` rgb(255,216,119).
- CSS vars @nuxt/ui : `--ui-primary: var(--secondary)`, `--ui-text-inverted: var(--accent)`.

## Typographie — `variables/_texts.scss` (via globals)

Fontes (`typography/_fonts.scss`, auto-hébergées `/assets/fonts/`) : **Fustat** variable 200–800 (titres), **Outfit** variable 100–900 (texte).

- `base-text($color: $secondary-text, $bold: false, $underline: false, $italic: false, $thin: true, $bigger: false)` — Outfit 1rem / 1.25rem ; weight 200 (`$thin`), 300 (`$thin: false`), 500 (`$bold`) ; `$bigger` → 1.125rem / 1.5rem ; `b, strong` → 800.
- `little-text($color: $secondary-text, $bold: false, $underline: false, $italic: false, $thin: true)` — Outfit 0.875rem / 1.125rem ; weight 200 / 300 / 700 (`$bold`).
- `base-title($size: 1.5rem, $weight: 700, $color: $secondary-text, $bigger: true, $colorful: true)` — Fustat ; `<strong>` en dégradé si `$colorful`, 1.15× la taille.
- `main-title($color: $secondary-text, $bigger: true, $colorful: true, $gradiant: false)` — Fustat 700, 1.75rem → 2rem → 3rem par breakpoint.
- `h1-title(...)` 26px → 30px · `h2-title(...)` 24px → 28px · `h3-title(...)` 600, 20px → 26px · `h4-title(...)`. Paramètres communs : `$color: $secondary-text, $bigger: true, $colorful: true, $layout-gap: false, $gradiant: false`.
- `lp-h2-title($color, $bigger, $colorful, $layout-gap: true)` · `lp-h3-title($color, $bigger, $colorful)` · `lp-h4-title(...)` — variantes landing.

## Layout — `variables/_layouts.scss` (via globals)

- Breakpoints `$max-widths` : `xxs` 360 · `xs` 450 · `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `xxl` 1536 · `xxxl` 1920 · `xxxxl` 2560 (px). Variables `$xxs`… `$xxxxl`.
- `@include min-width($bp) { … }` — media query `min-width: bp + 1px` (mobile-first).
- `@include container($max: xxl, $additional-width: 0rem)` — width 100 % puis max-width par palier (ignore xs/xxs).
- `responsive-grid-track($min)` / `@include responsive-grid-columns($min-card-width, $fit-mode: auto-fit)` — `repeat(auto-fit, minmax(min(100%, X), 1fr))`. Alias `adaptive-grid-*`.
- CSS vars `:root` : `--layout-gap` (1rem → 1.125rem md → 1.25rem lg → 1.5rem xxl) et multiples `--layout-gap-2xs` ×0.15 · `-xs` ×0.25 · `-sm` ×0.5 · `-md` ×0.75 · `-xl` ×1.25 · `-2xl` ×1.5 · `-3xl` ×1.75 · `-4xl` ×2 ; `--container-size`.
- `$nav-height` : `calc(70px + (var(--layout-gap) + (var(--layout-gap) * 0.667)))`.
- Classe `.scrollbar` (scrollbar fine) définie ici.
- Côté TypeScript : `import { vp } from '@/utils/viewport'` → `vp.md.value` (vrai au-dessus de 768 px), `vp.lg`, etc. (`@vueuse/core` `useBreakpoints`).

## Bordures — `variables/_borders.scss` (alias `borders`)

`$rounded-xs` 0.25rem · `$rounded-sm` 0.5rem · `$rounded-md` 0.75rem · `$rounded-lg` 1.25rem · `$rounded-xl` 1.5rem · `$rounded-xxl` 2rem · `$rounded` 9999px · `@include squircle($smooth: .24)` (clip-path super-ellipse).

## Effets — `variables/_effects.scss` (via globals ou alias `effects`)

- `soft-shadow($color: rgba(0,0,0,.1), $blur: 10px, $spread: 0px)` → `0 4px $blur $spread $color`
- `big-shadow($color: rgba(0,0,0,.15), $blur: 20px, $spread: -5px)` → `0 10px $blur $spread $color`
- `text-shadow($color: rgba(0,0,0,.5), $blur: 5px)`
- `halo($size: md, $filter: false, $color: $accent, $opacity: .15)` — tailles `txt | xs | sm | md | lg` ; `$filter: true` → `drop-shadow` (SVG, images) sinon `box-shadow`.

## Animations — `variables/_animations.scss` (alias `animations`, import séparé)

- `transition($duration: $duration-base, $timing-function: $ease-out, $properties: $default-properties)` → longhands `transition-property/duration/timing-function`. Par défaut : couleurs, `opacity`, `visibility`, `transform`/`translate`/`scale`/`rotate`, `box-shadow`, `filter` (jamais `all`). Hauteur ou largeur animée : `@include animations.transition(animations.$duration-menu, animations.$ease-out, (grid-template-rows, opacity))`.
- Courbes : `$ease-out` `cubic-bezier(0.23, 1, 0.32, 1)` · `$ease-in-out` `cubic-bezier(0.77, 0, 0.175, 1)` · `$ease-drawer` `cubic-bezier(0.32, 0.72, 0, 1)`.
- Durées : `$duration-press` 140ms · `$duration-fast` 160ms · `$duration-base` 200ms · `$duration-menu` 220ms · `$duration-overlay` 280ms · `$duration-exit` 180ms.
- `press($scale: 0.97)` → `&:active:not(:disabled)` en `scale()`, opacité 0.85 si mouvement réduit.
- `reduced-motion { }` → `@media (prefers-reduced-motion: reduce)`.

Survol (dans `variables/_layouts.scss`, via globals) : `can-hover { }` → `@media (hover: hover) and (pointer: fine)` ; `on-hover($suffix: '') { }` → `&:hover#{$suffix}` derrière la même requête.

## Boutons — `components/_buttons.scss` (alias `buttons`)

Thèmes `$button-themes` : `white`, `light`, `black`, `dark`, `secondary` (clés `text-color`, `bg-color`, `outline-opacity`, `outline-color`, `icon-color`, `hover-*`).

- `primary($cta: false, $theme: black, $padding: true, $fullwidth: false, $deep: false, $icon-only: false, $little: false)` — s'applique au **wrapper** (`div > button`) et style l'enfant direct : inline-flex, gap 0.5rem, padding 0.6rem 1rem (`$little` : 0.5rem 0.8rem ; `$padding: false` : 0.4rem ; `$icon-only` : carré), radius `$rounded-sm`, outline 3px, ombre `0 1px 3px 2px rgba(0,0,0,.1)`, inversion au survol.
- `secondary($theme: white, $padding: true)` — inline-block, padding 0.6rem 1rem, sans ombre.
- `low-btn($color: $accent, $hover: $secondary, $text-color: $secondary, $text-hover-color: $accent, $padding: true, $fullwidth: false, $deep: false, $icon-only: false, $little: true, $fill: false, $stroke: true, $borders: false)` — bouton discret.
- `link($theme: white, $underline: true)` — lien texte, couleur `hover-text-color` du thème.
- `checkbox($theme: white)` · `checkbox-label($theme: white)`.
- Classes globales (`layouts/_global.scss`) : `.btn-primary`, `.btn-primary__full`, `.btn-primary__<theme>`, `.btn-primary__<theme>__full`.

## Champs — `components/_inputs.scss` (alias `inputs`)

Thèmes `$input-themes` : `base` (fond `$tertiary`) et `accent` (fond `$accent`) ; tokens `bg`, `text`, `placeholder` (.45), `border` (.1 / .08), `hover` (.18 / .16), `focus` (.35 / .3), `icon`, `shadow`. Tailles `$input-sizes` : `default` (min-height 2.75rem, padding .55rem .9rem, gap .5rem) / `compact` (2.4rem, .45rem .75rem, gap .4rem).

- `field($theme: base, $compact: false)` — shell flex + `> input | textarea | select` ; radius `$rounded-md`, ombre `0 2px 6px shadow`, hover bordure, focus bordure + `halo(xs, …, .35)`, placeholder, disabled.
- `search($theme: base, $compact: false)` · `select($theme: base, $compact: false)` · `textarea($theme: base, $compact: false)`
- `action($theme: base, $action-theme: black, $compact: false)` — champ avec bouton intégré (thème bouton = `$action-theme`).
- `stepper($theme: base, $compact: false)` · `stepper-input($theme: base, $compact: false, $value-font-size: 1.75rem, $suffix-font-size: 1rem)`
- `inline($theme: base, $compact: false)` · `richtext($theme: base)` (Quill)
- Helpers : `input-token($theme, $token)`, `input-size($compact, $token)` ; placeholders `%input-shell`, `%input-control`, `%input-icon`.

## Overlays — `components/_overlays.scss` (alias `overlays`)

`%overlay-panel` — colonne flex plein hauteur, fond `$accent`, coins hauts `$rounded-lg` (complets dès lg), `container($max: md)`, padding `--layout-gap-4xl` (gauche, droite, haut). Composants Vue : `components/overlays/AbsoluteOverlay.vue`, `RelativeOverlay.vue`, `ConfirmationDialog.vue` (props `open`, `level`, `title`, `message`, `subject`, `actionLabel`, `confirmLabel`, `cancelLabel`, `tone`, `confirmWord`, `typingHint`, `typingLabel`), `scrollLock.ts`.

## Classes globales — `layouts/_global.scss`

`.wrapper`, `.wrapper__<bp>` (conteneurs centrés avec padding `--layout-gap`), `.btn-primary*`, `.fallback-warning`, `.in-dev` / `.in-dev-hide` (utilitaires dev, actifs via `html.in-dev-utilities-enabled`), `main#landing-page [class$="-section"]` (rythme vertical des sections landing). Classes d'environnement sur `html`/`body` : `is-ios`, `ios-landing-surface`, `ios-landing-lite`, `force-scroll`.

## Utilitaires TypeScript

- `sr(targets, { x, y, opacity, duration, delay, stagger, ease, start, end, once, toggle, resetOnLeave })` — `@/utils/scrollReveal` ; respecte `prefers-reduced-motion` et désactive sur iOS ; attributs `data-sr-x`, `data-sr-y`, `data-sr-dur`, `data-sr-delay`, `data-sr-once`…
- `vp` — `@/utils/viewport` (breakpoints réactifs).
- `formatICUMessage(template, values)` — `@/utils/i18n` (pluriels `{n, plural, one {…} other {…}}`).
- `components/overlays/scrollLock.ts` — `forceReleaseScrollLock()` et verrouillage du scroll.
