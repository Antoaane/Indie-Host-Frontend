---
name: IndieHost
description: Design system SCSS d'IndieHost — neutres chauds, dégradé signature lavande-rose, Fustat pour les titres et Outfit pour le texte.
colors:
  accent: "#fcfafa"
  secondary: "#111117"
  tertiary: "#ece8e8"
  quaternary: "#e2dede"
  quinary: "#343339"
  dark: "#000000"
  gradient-lavender: "rgb(163, 153, 255)"
  gradient-orchid: "rgb(223, 153, 255)"
  gradient-blush: "rgb(255, 196, 197)"
  gradient-lemon: "rgb(254, 251, 153)"
  gradient-mint: "rgb(153, 255, 226)"
  status-bad: "rgb(255, 82, 82)"
  status-good: "rgb(0, 255, 166)"
  status-progressing: "rgb(255, 216, 119)"
  airbnb: "rgb(255, 82, 82)"
typography:
  display:
    fontFamily: "Fustat, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
  headline:
    fontFamily: "Fustat, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
  title:
    fontFamily: "Fustat, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
  subtitle:
    fontFamily: "Fustat, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
  body:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1rem"
    fontWeight: 200
    lineHeight: "1.25rem"
  label:
    fontFamily: "Outfit, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 200
    lineHeight: "1.125rem"
rounded:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1.25rem"
  xl: "1.5rem"
  xxl: "2rem"
  pill: "9999px"
spacing:
  gap-2xs: "calc(var(--layout-gap) * 0.15)"
  gap-xs: "calc(var(--layout-gap) * 0.25)"
  gap-sm: "calc(var(--layout-gap) * 0.5)"
  gap-md: "calc(var(--layout-gap) * 0.75)"
  gap: "var(--layout-gap)"
  gap-xl: "calc(var(--layout-gap) * 1.25)"
  gap-2xl: "calc(var(--layout-gap) * 1.5)"
  gap-3xl: "calc(var(--layout-gap) * 1.75)"
  gap-4xl: "calc(var(--layout-gap) * 2)"
components:
  button-primary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "0.6rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.secondary}"
  button-primary-white:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.sm}"
    padding: "0.6rem 1rem"
  button-primary-little:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.8rem"
  input-field:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    padding: "0.65rem 0.9rem"
    height: "2.75rem"
  input-field-compact:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
    height: "2.4rem"
  input-field-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.md}"
  overlay-panel:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.lg}"
    padding: "{spacing.gap-4xl}"
---

# Design System: IndieHost

Source de vérité : `frontend/src/styles/` (variables, composants, typographie). Ce fichier décrit le système en place pour que toute nouvelle UI reste cohérente ; les tokens du frontmatter sont normatifs, la prose explique comment les appliquer. Signatures exactes des mixins : `.claude/skills/indiehost-ui/references/mixins.md`. Rédigé le 2026-10-21 par extraction du code ; le vocabulaire qualitatif (North Star, noms de couleurs) est une proposition à confirmer.

## Overview

**North Star (proposé) : « La maison d'hôtes lumineuse ».** Des surfaces claires et chaudes, une encre presque noire très lisible, et un seul geste de couleur, le dégradé lavande-rose, posé comme une touche de décoration sur le mot qui compte. Le produit doit inspirer autant confiance qu'une fiche Airbnb tout en paraissant plus personnel et plus calme.

Humeur : lumineux, net, chaleureux, posé. Le texte courant est volontairement léger (Outfit 200) ; la hiérarchie se fait par les titres Fustat et par l'espace, pas par les encadrés.

Anti-références : dashboards SaaS gris-bleu, cartes imbriquées, violets néon saturés, bordures décoratives partout, « dark mode » improvisé. Les deux mondes du produit partagent le même système : **landing et page annonce** (mode Persuade, aérées, dégradé et halos autorisés) et **dashboard hôte** (mode Operate, compact, presque sans couleur).

## Colors

Toutes les couleurs viennent de `variables/_colors.scss` (import `@use '@/styles/variables/globals' as *`). Aucun hex ni `rgba()` brut dans un composant.

### Primary
- **Encre chaude** (`#111117`, `$secondary` / `$secondary-text`) : texte, icônes, boutons pleins (thème `black`). Tous les gris de l'interface en dérivent : `rgba($secondary, 0.08)` bordures, `0.1`–`0.3` surfaces translucides (`$translucent-surface-0..3`), `0.45` placeholders, `0.6`–`0.7` texte secondaire.

### Secondary (dégradé signature)
- **Lavande → Orchidée → Rose** (`rgb(163,153,255)` → `rgb(223,153,255)` → `rgb(255,196,197)`, `$primary_gradiant_first/second/third`) : `background-clip: text` sur le `<strong>` des titres (`$colorful: true` dans les mixins de titre), halos et lueurs de la landing. Jamais en fond de bouton, de badge ou de carte.
- **Citron → Menthe** (`rgb(254,251,153)` → `rgb(153,255,226)`, `$secondary_gradiant_first/second`) : accent secondaire rare, réservé à la landing.

### Neutral
- **Blanc chaud** (`#fcfafa`, `$accent`) : fond des cartes, panneaux, overlays, boutons thème `white`, texte sur fond sombre.
- **Lin** (`#ece8e8`, `$tertiary`) : fond des champs (thème `base`) et base des surfaces `$accent-surface-0..4` (de +2,5 % à −15 % de luminosité). `$background` = `$accent-surface-3`.
- **Lin foncé** (`#e2dede`, `$quaternary`), **Ardoise** (`#343339`, `$quinary`), **Noir** (`#000000`, `$dark`, calques de contraste uniquement).
- `$secondary-surface-0..3` : éclaircissements de l'encre (+90 % à +70 %) pour fonds très clairs légèrement froids.

### Status
- **Bad** (`rgb(255,82,82)`, `$bad`), **Good** (`rgb(0,255,166)`, `$good`), **Progressing** (`rgb(255,216,119)`, `$progressing`) : fond en `rgba($x, 0.1)`, texte ou icône en pleine opacité, toujours doublé d'un libellé ou d'une icône (jamais la couleur seule).
- `$airbnb` (`rgb(255,82,82)`) existe pour des accents de comparaison ; le logo Airbnb passe par `AirbnbLogo.vue`, Booking par `BookingLogo.vue`.

### Named Rules
**La règle de l'alpha unique.** Pas de nouveau gris : toute nuance dérive de `rgba($secondary, α)` ou d'une surface `$accent-surface-*`.
**La règle du dégradé réservé.** Le dégradé signature est un accent typographique et lumineux, pas une couleur de remplissage d'interface.
**La règle du blanc chaud.** `#fff` et `#000` purs sont interdits : `$accent` et `$secondary` (ou `$dark` pour un calque de contraste).

## Typography

Deux familles variables auto-hébergées (`typography/_fonts.scss`, `/assets/fonts/*.woff2`) : **Fustat** (200–800) pour tout ce qui titre, **Outfit** (100–900) pour tout ce qui se lit. Le corps est léger (200) sur fond clair ; le gras passe à 500 (`base-text($bold: true)`) ou 700 (`little-text($bold: true)`), les `<strong>` inline à 800. Aucun `font-size`, `font-weight` ou `line-height` brut : toujours un mixin de `variables/_texts.scss`.

### Hierarchy
- **Display** (`main-title`, Fustat 700, 1.75rem → 2rem à md → 3rem à lg) : titre héro de la landing et des pages marketing.
- **Headline** (`h1-title`, Fustat 700, 1.625rem → 1.875rem) : titre de page du dashboard et de la page annonce.
- **Title** (`h2-title` Fustat 700, 1.5rem → 1.75rem ; `h3-title` 600, 1.25rem → 1.625rem ; `h4-title`) : sections, panneaux, cartes.
- **Body** (`base-text`, Outfit 200, 1rem / 1.25rem ; `$bigger` → 1.125rem / 1.5rem) : paragraphes et descriptions, largeur de lecture ≤ 70ch.
- **Label** (`little-text`, Outfit 200, 0.875rem / 1.125rem ; `$bold` → 700) : métadonnées, aides de champ, badges, nav mobile.
- Variantes landing : `lp-h2-title`, `lp-h3-title`, `lp-h4-title`.

### Named Rules
**La règle du mot en couleur.** Dans un titre, un seul groupe de mots en `<strong>` reçoit le dégradé : c'est la signature de marque, voulue et documentée, pas un « AI tell ». Pas de capitales, pas de letter-spacing large, pas d'étiquettes en majuscules au-dessus du contenu.
**La règle de la gravité.** Un seul titre par surface porte le poids maximal ; les niveaux suivants descendent d'un cran, jamais deux titres de même niveau côte à côte sans contenu entre eux.

## Layout

Mobile-first. Breakpoints (`$max-widths`, `variables/_layouts.scss`) : xxs 360, xs 450, sm 640, md 768, lg 1024, xl 1280, xxl 1536, xxxl 1920, xxxxl 2560 px, exposés via `@include min-width(bp)` (déclenche à bp + 1 px) et côté TypeScript via `vp.md`, `vp.lg`… (`@/utils/viewport`).

- **Conteneurs** : `.wrapper` (largeur 100 %, `padding-inline: var(--layout-gap)`, max-width par palier via `container()`), déclinaisons `.wrapper__md`, `.wrapper__lg`… ; en SCSS `@include container($max: md)`.
- **Rythme** : une seule échelle d'espacement, `--layout-gap` (1rem → 1.125rem à md → 1.25rem à lg → 1.5rem à xxl) et ses multiples `--layout-gap-2xs` (×0.15), `-xs` (×0.25), `-sm` (×0.5), `-md` (×0.75), `-xl` (×1.25), `-2xl` (×1.5), `-3xl` (×1.75), `-4xl` (×2). Sections landing : `padding-block: calc(var(--layout-gap) * 4)`.
- **Grilles** : `@include responsive-grid-columns($min-card-width)` → `repeat(auto-fit, minmax(min(100%, X), 1fr))` ; jamais de nombre de colonnes figé par breakpoint.
- **Navigation** : barre de `$nav-bar-height` (3.75rem, source unique de tous les décalages d'en-tête), bloc `$nav-height` ; barre mobile fixe `BottomNav` avec `env(safe-area-inset-bottom)` ; hauteurs plein écran en `100dvh`.
- **Densité** : tailles en rem ; sur desktop à la souris (`lg` + `can-hover`) la racine passe à 93,75 % (15 px) et les gaps sont plafonnés à leur valeur `lg` : l'interface ne grossit plus sur grand écran. Dashboard compact (`$compact: true` sur les champs, `$little: true` sur les boutons, gaps `-sm`/`-md`) ; landing et page annonce aérées (gaps `-2xl`/`-4xl`).
- **Media queries** : un `@media` ne sert qu'à changer un comportement (row → column, grille qui déborde, cible tactile trop petite, sticky). `clamp()`, `min()` et les grilles fluides remplacent les ajustements cosmétiques.

## Elevation & Depth

Système hybride : surfaces plates et superposition tonale par défaut (`$accent` posé sur `$background`, bordures `rgba($secondary, 0.08)`), ombres douces réservées à ce qui flotte ou se manipule (champs, boutons pleins, panneaux, barre mobile). Les blocs de contenu au repos n'ont pas d'ombre.

### Shadow Vocabulary
- **Champ** (`box-shadow: 0 2px 6px rgba($secondary, 0.08)`) : au repos ; au focus `halo(xs)` à 0.35 sur la couleur de focus.
- **Bouton primaire** (`0px 1px 3px 2px rgba(0,0,0,0.1)` + `outline: 3px` translucide) : relief tactile constant.
- **soft-shadow** (`0 4px 10px rgba(0,0,0,0.1)`) : cartes cliquables au survol, popovers.
- **big-shadow** (`0 10px 20px -5px rgba(0,0,0,0.15)`) : panneaux, modales, menus.
- **halo($size, $filter, $color, $opacity)** (tailles `txt | xs | sm | md | lg`) : lueur colorée pour focus et accents landing ; `$filter: true` pour SVG et images.
- **Barre mobile** (`0 -6px 18px rgba($secondary, 0.1)`) : seule ombre dirigée vers le haut.

### Named Rules
**La règle de l'ombre méritée.** Une ombre signale une surface interactive ou flottante ; elle n'habille jamais un bloc statique.

## Shapes

Coins arrondis graduels (`variables/_borders.scss`, alias `borders`) : `$rounded-sm` (0.5rem) boutons ; `$rounded-md` (0.75rem) champs et steppers ; `$rounded-lg` (1.25rem) cartes, panneaux, items de nav ; `$rounded-xl` (1.5rem) et `$rounded-xxl` (2rem) grandes cartes et médias ; `$rounded` (9999px) pills, chips, avatars ; `$rounded-xs` (0.25rem) coches et micro-éléments. Un squircle (`@include squircle()`) est disponible pour icônes et médias héro. Bordures 1px `rgba($secondary, 0.08)`, séparateurs à 0.1. Les angles vifs n'existent qu'en plein écran mobile (coins hauts seuls arrondis dans `%overlay-panel`).

## Components

### Buttons
Franc et tactile : fond plein, outline translucide, inversion complète fond/texte au survol.
- **Shape :** `borders.$rounded-sm`, inline-flex, gap 0.5rem, ombre `0 1px 3px 2px`, outline 3px.
- **Primary (`buttons.primary($theme: black)`) :** fond `$secondary`, texte `$accent`, padding 0.6rem 1rem (`$little: true` → 0.5rem 0.8rem) ; options `$fullwidth`, `$icon-only` (carré 1:1), `$cta`, `$deep`. Thèmes : `black` (défaut), `white`, `light`, `dark`, `secondary`. Le mixin s'applique au **wrapper** et style l'enfant direct (`<div class="cta"><button>…</button></div>`). Classes globales prêtes : `.btn-primary`, `.btn-primary__white`, `.btn-primary__black__full`.
- **Hover / Focus / Active :** inversion fond/texte au survol (souris uniquement), outline à 0.75, `animations.transition()` 200ms ; `scale(0.97)` à l'appui ; `:focus-visible` toujours visible.
- **Secondary (`buttons.secondary($theme: white)`) :** même padding, sans ombre, inline-block. **Low (`buttons.low-btn()`) :** bouton discret paramétrable (`$stroke`, `$fill`, `$borders`, `$little: true` par défaut). **Link (`buttons.link($theme, $underline)`) :** texte souligné. **Checkbox :** `buttons.checkbox()` + `buttons.checkbox-label()`.

### Inputs / Fields
- **Style :** `inputs.field($theme: base|accent, $compact)` : fond `$tertiary` (base) ou `$accent`, bordure 1px `rgba($secondary, 0.1)`, radius `$rounded-md`, min-height 2.75rem (compact 2.4rem), placeholder à 0.45, icônes 1.1rem, texte Outfit 1rem.
- **Focus :** bordure à 0.35 + `halo(xs)` ; survol bordure à 0.18.
- **Error / Disabled :** erreur signalée par un message sous le champ (`little-text`, `$bad`) et `aria-invalid` ; désactivé texte à 0.5, `cursor: not-allowed`.
- **Variantes :** `search`, `select`, `textarea`, `action` (champ + bouton intégré, `$action-theme`), `stepper` et `stepper-input` (valeur Outfit 600, `tabular-nums`), `inline`, `richtext` (Quill). Composants prêts : `NumberStepper.vue`, `StepperInput.vue`, `DatePicker/`.

### Cards / Containers
- **Corner Style :** `$rounded-lg` ; `$rounded-xl` ou `$rounded-xxl` pour médias et grandes cartes.
- **Background :** `$accent` sur `$background` ; état sélectionné `$accent-surface-2` + `inset 0 0 0 1px rgba($secondary, 0.08)`.
- **Shadow Strategy :** aucune au repos ; `soft-shadow` au survol uniquement si la carte est cliquable.
- **Border :** 1px `rgba($secondary, 0.08)`.
- **Internal Padding :** `var(--layout-gap)` à `var(--layout-gap-2xl)`.
- Pas de carte dans une carte : une liste à l'intérieur d'une carte se structure par séparateurs et espacement.

### Overlays / Dialogs
`AbsoluteOverlay.vue` (plein écran), `RelativeOverlay.vue` (ancré au parent), `ConfirmationDialog.vue` (titre, message, `level`, `tone`, libellés, mot de confirmation optionnel pour les actions destructives). Panneau `%overlay-panel` : fond `$accent`, coins hauts `$rounded-lg` sur mobile et complets dès lg, padding `--layout-gap-4xl`, `container($max: md)`. Verrouillage du scroll uniquement via `scrollLock.ts`.

### Navigation
`Header.vue` avec variantes landing / public / host (`components/navs/`), `BottomNav` mobile fixe (items `$rounded-lg`, actif sur `$accent-surface-2`, icône 22px, libellé `little-text`).

### Icons & Logos
Lucide (`lucide-vue-next`), 1.1rem dans les champs, 22px en navigation, couleur héritée du texte. Logos : `LogoFullLight/Dark`, `LogoIconLight/Dark`, `AirbnbLogo`, `BookingLogo`, drapeaux et pictos dans `components/svgs/icons/`. Jamais de badge texte coloré à la place d'un logo OTA.

### Motion
Principes d'Emil Kowalski (`.claude/skills/emil-design-eng`) appliqués au système :
- **Transition :** `@include animations.transition($duration, $timing-function, $properties)` (200ms, `$ease-out`) pour tout changement d'état. Elle n'anime jamais `all` : par défaut couleurs, opacité, transform, ombres et filtres seulement ; une hauteur d'accordéon ou une barre de progression passe ses propriétés explicitement (ou mieux, `transform: scaleX()`).
- **Courbes :** `$ease-out` `cubic-bezier(0.23, 1, 0.32, 1)` (entrées, survol, pression), `$ease-in-out` `cubic-bezier(0.77, 0, 0.175, 1)` (déplacement à l'écran), `$ease-drawer` `cubic-bezier(0.32, 0.72, 0, 1)` (sheets, drawers). Jamais d'`ease-in`.
- **Durées :** pression `$duration-press` 140ms, survol `$duration-fast` 160ms, état `$duration-base` 200ms, menus/accordéons `$duration-menu` 220ms, overlays `$duration-overlay` 280ms, sorties `$duration-exit` 180ms. L'UI reste sous 300ms ; seul le marketing explicatif peut durer plus.
- **Pression :** `@include animations.press()` → `scale(0.97)` sur `:active` (0.98–0.99 pour les grandes cartes) ; déjà intégré à `buttons.*`.
- **Survol :** toujours derrière `@include on-hover { }` / `@include can-hover { }` (`(hover: hover) and (pointer: fine)`) : sur mobile le `:hover` simulé reste collé après un tap.
- **Entrées :** jamais depuis `scale(0)` (partir de `scale(0.95)` + opacité) ; popovers ancrés à leur déclencheur (`transform-origin`), modales centrées ; sheets mobiles en `translateY(100%)`.
- **Fréquence :** rien d'animé sur une action clavier ou répétée des centaines de fois ; le dashboard (Operate) reste vif, la landing (Persuade) peut raconter.
- **Mobile :** `100dvh` pour les coquilles d'app, `100svh` pour les héros, `env(safe-area-inset-*)` sur les barres fixes, `overscroll-behavior: contain` sur les zones scrollables internes, champs à 16px minimum sur écran tactile.

Révélations au scroll via `sr()` (`@/utils/scrollReveal`, GSAP ScrollTrigger, `power3.out`, 0.6s, sans délai, y + opacité, attributs `data-sr-*`), qui respecte déjà `prefers-reduced-motion` et désactive sur iOS. ScrollSmoother seulement sur la landing. Confettis (`canvas-confetti`) réservés aux succès majeurs (publication, paiement). Une ou deux séquences orchestrées par page, jamais un fade-up par section.

## Do's and Don'ts

**Do**
- Importer les tokens (`globals`, `borders`, `animations`, `buttons`, `inputs`) et ne composer qu'avec eux.
- Un `<strong>` en dégradé par titre, titres Fustat, corps Outfit léger, labels `little-text`.
- Mobile-first avec `min-width()`, `clamp()` et grilles fluides ; cibles tactiles d'au moins 44 px ; `100dvh` et safe areas.
- Réutiliser `ConfirmationDialog`, `StepperInput`, `BottomNav`, les overlays et les mixins avant de créer un composant.
- Copie française vouvoyée, verbes d'action sur les boutons, prix TTC explicites, erreurs qui disent quoi faire.

**Don't**
- Couleurs hex ou `rgba()` brutes, `#fff`, `#000`, radius, ombres ou transitions en dur, `font-size` sans mixin.
- Dégradé en fond de bouton, de badge ou de carte ; violets saturés ; mode sombre improvisé (aucun token dark n'existe).
- Cartes imbriquées, bordures décoratives, étiquettes en capitales, Inter / Roboto / Arial.
- Fade-up sur chaque section, hover sur chaque carte, animation sans `prefers-reduced-motion`.
- Nouveaux composants `U*` de @nuxt/ui hors `UApp` et `UCalendar` ; badges texte « Airbnb » / « Booking » à la place des logos.
- `@media` cosmétique qui duplique des valeurs quasi identiques entre mobile et desktop.
