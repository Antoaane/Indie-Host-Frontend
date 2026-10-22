---
name: indiehost-ui
description: Règles UI/UX du frontend IndieHost (Vue 3 + SCSS tokens). À charger avant de créer ou modifier un composant, une vue, un style SCSS, un formulaire, une animation ou un texte d'interface dans frontend/. Impose les tokens du design system (couleurs, typo Fustat/Outfit, radius, gaps, mixins boutons/inputs), la politique de media queries, la copie en français vouvoyée et le socle accessibilité. Oriente aussi l'usage des skills frontend-design, impeccable et web-design-guidelines sur ce repo.
---

# IndieHost UI

Skill chef d'orchestre pour tout travail d'interface dans `frontend/`. Les skills génériques (frontend-design, impeccable, web-design-guidelines) donnent la méthode ; celui-ci donne les contraintes du repo. **En cas de conflit, le design system existant gagne** : `$secondary = #111117` est un choix de marque, pas un « near-black par défaut » à remplacer, et le `<strong>` en dégradé dans les titres est la signature IndieHost, pas un « AI tell ».

## Avant d'écrire une ligne

1. Lire `DESIGN.md` à la racine : tokens, typographie, composants, do/don't. `PRODUCT.md` donne le contexte produit et le mode de chaque surface (Operate pour le dashboard, Persuade pour landing et page annonce).
2. Ouvrir [references/mixins.md](references/mixins.md) pour les signatures exactes des mixins (`buttons.primary`, `inputs.field`, `h2-title`, `halo`…).
3. Chercher un composant ou un panneau voisin qui fait déjà la même chose (`frontend/src/components/`, `frontend/src/views/*/components/`) et copier ses conventions plutôt que d'en inventer.

## Conventions de code

### Bloc style
- `<style lang="scss">` **non scoped** (convention du repo) avec une classe racine unique par composant (`.domain-panel`, `.ui-stepper-input`) et des sélecteurs enfants directs `> .child`. Jamais de style global non préfixé.
- Commentaire `/* File: src/... */` en tête du bloc ou du fichier `.scss` ; les vues volumineuses gardent leur SCSS dans un fichier voisin importé via `@use`.
- Imports standard :
  ```scss
  @use '@/styles/variables/globals' as *;             // couleurs, gaps, textes, effets
  @use '@/styles/variables/borders' as borders;       // borders.$rounded-*
  @use '@/styles/variables/animations' as animations; // animations.transition()
  @use '@/styles/components/buttons' as buttons;      // si bouton
  @use '@/styles/components/inputs' as inputs;        // si champ
  ```
- Variables CSS locales au composant préfixées `--ui-<composant>-*`, définies sur la classe racine à partir des tokens SCSS (`--ui-x-text: #{$secondary-text};`).

### Tokens obligatoires (zéro valeur hardcodée)
| Besoin | Utiliser | Interdit |
|---|---|---|
| Couleur | `$accent`, `$secondary`, `$tertiary`, `rgba($secondary, 0.08)`, `$accent-surface-2`, `$good` / `$bad` / `$progressing` | `#111`, `#fff`, `rgba(0,0,0,.1)` |
| Dégradé | `$primary_gradiant_first/second/third` | tout `linear-gradient` avec hex |
| Radius | `borders.$rounded-xs/sm/md/lg/xl/xxl`, `borders.$rounded` (pill) | `border-radius: 8px` |
| Espacement | `var(--layout-gap)`, `var(--layout-gap-sm/md/xl/2xl/4xl)` | `padding: 24px` |
| Transition | `@include animations.transition()` (200ms, `$ease-out`, sans `all`) ; propriétés explicites en 3e argument pour une hauteur/largeur | `transition: all .2s ease`, `ease-in` |
| Survol | `@include on-hover { }` / `@include can-hover { }` | `&:hover` nu (reste collé au tap sur mobile) |
| Texte | `@include base-text()`, `@include little-text($bold: true)`, `@include h1-title()`… | `font-size: 0.875rem; font-weight: 700` |
| Ombre | `@include soft-shadow()`, `@include big-shadow()`, `@include halo(sm)` | `box-shadow: 0 4px 10px rgba(0,0,0,.1)` |
| Conteneur | `.wrapper`, `.wrapper__md`, `@include container($max: md)` | `max-width: 768px` |
| Breakpoint | `@include min-width(md)` (mobile-first) ou `vp.md` côté TS | `@media (max-width: 768px)` ad hoc |

Seules valeurs numériques tolérées : ratios internes (`calc(var(--layout-gap) * 4)`), tailles d'icônes (`1.1rem`, `22px`), `z-index`, et les tailles de zones tactiles.

### Media queries
Mobile-first via `@include min-width(bp)`. Un `@media` doit changer un **comportement** (row → column, grille qui déborde, cible tactile sous 44 px, sticky / overflow). Préférer `clamp()`, `min()`, `responsive-grid-columns($min-card-width)` et le flex fluide à toute adaptation cosmétique. Ne jamais dupliquer des valeurs quasi identiques entre desktop et mobile.

### Boutons, champs, overlays
- Bouton : wrapper + enfant (`<div class="cta"><button>…</button></div>`) stylé par `@include buttons.primary($theme: black)` sur le wrapper, ou classes globales `.btn-primary`, `.btn-primary__white`, `.btn-primary__black__full`. Secondaire `buttons.secondary()`, discret `buttons.low-btn()`, lien `buttons.link()`.
- Champ : `@include inputs.field($theme: base|accent, $compact: true)`, `inputs.select()`, `inputs.textarea()`, `inputs.search()`, `inputs.action()` (champ + bouton), `inputs.stepper()`. Stepper numérique : `NumberStepper.vue` / `StepperInput.vue`.
- Overlay / modale : `AbsoluteOverlay.vue`, `RelativeOverlay.vue`, `ConfirmationDialog.vue` + `scrollLock.ts`. Panneau : placeholder `%overlay-panel`.
- Icônes : `lucide-vue-next` uniquement. Logos OTA : `AirbnbLogo.vue` / `BookingLogo.vue` (jamais de badge texte coloré). Logos IndieHost : `LogoFull*`, `LogoIcon*`.
- @nuxt/ui : réservé aux usages déjà en place (`UApp`, `UCalendar`). Pas de nouveau `U*` sans demande explicite : les composants maison SCSS sont la norme.

### Animation
- Micro-interactions : `animations.transition()` ; `:hover` derrière `on-hover`, `:focus-visible` visible, `:active` via `@include animations.press()` (`scale(0.97)`, déjà intégré à `buttons.*`). Courbes `$ease-out` / `$ease-in-out` / `$ease-drawer` et durées `$duration-*` de `_animations.scss` ; principes d'Emil Kowalski (`emil-design-eng`, `mobile-native`) : jamais `scale(0)`, popovers ancrés au déclencheur, sorties plus rapides que les entrées, rien d'animé sur une action clavier.
- Révélation au scroll : `sr(targets, options)` de `@/utils/scrollReveal` (GSAP ScrollTrigger, gère `prefers-reduced-motion` et iOS) ; attributs `data-sr-*` pour ajuster élément par élément. Une ou deux séquences orchestrées par page, pas un fade-up par section.
- ScrollSmoother / Lenis uniquement sur la landing.

### Texte d'interface
- Français, **vouvoiement**, phrases courtes, verbe d'action sur les boutons (« Publier l'annonce », pas « OK »).
- Chaînes dans `frontend/src/locales/<domaine>/fr.json`, importées directement (`import editorLocale from '@/locales/editor/fr.json'`). Pluriels ICU via `formatICUMessage()` (`@/utils/i18n`). Landing multilingue via `useLandingLocale()`.
- Erreurs : dire ce qui s'est passé et quoi faire. États vides : inviter à l'action. Prix : TTC, symbole après le montant avec espace insécable (« 29 €/mois »).

## Socle accessibilité et UX (non négociable)
- Cibles tactiles d'au moins 44 px sur mobile (compteurs, nav, chips).
- `:focus-visible` visible sur tout élément interactif ; jamais `outline: none` sans remplacement.
- Contraste d'au moins 4.5:1 pour le texte ; `rgba($secondary, 0.45)` convient à un placeholder, pas à du texte à lire.
- `prefers-reduced-motion` respecté pour toute animation ajoutée hors `sr()`.
- Formulaires : `label` lié, `inputmode` adapté (`numeric`, `email`, `tel`), erreurs annoncées (`aria-live="polite"`), bouton désactivé avec état de chargement pendant la soumission.
- Images : `alt` renseigné, `loading="lazy"` hors héro, ratio réservé pour éviter le CLS.
- Mobile : `env(safe-area-inset-bottom)` sur les barres fixes, `100dvh` plutôt que `100vh`.
- Ne jamais bloquer le scroll sans `scrollLock.ts`.

## Comment combiner les autres skills
| Besoin | Skill ou commande |
|---|---|
| Nouvelle surface ou refonte visuelle | `frontend-design` pour la direction, puis ce skill pour l'implémentation. Le brief et les tokens IndieHost priment sur ses interdits génériques. |
| Planifier une feature UI avant de coder | `/impeccable shape <cible>` |
| Revue UX (hiérarchie, clarté, émotion) | `/impeccable critique <cible>` |
| Audit technique a11y / perf / responsive | `/impeccable audit <cible>` ou `/web-design-guidelines <fichiers>` |
| Passe finale avant livraison | `/impeccable polish <cible>` puis le détecteur (ci-dessous) |
| Copie peu claire, états d'erreur, i18n | `/impeccable clarify <cible>` / `/impeccable harden <cible>` |
| Animation | `/impeccable animate <cible>` en respectant la section Animation ci-dessus |

Pour impeccable, cibler un chemin dans `frontend/` (`--target frontend/src/views/...`) : le contexte racine ne voit pas le frontend seul. L'anti-pattern `gradient-text` est ignoré volontairement (signature de marque) via la config impeccable du projet.

## Avant de rendre la main
1. `cd frontend && npm run type-check` : toute erreur TypeScript casse le build Docker de prod.
2. `.claude/skills/impeccable/scripts/impeccable detect --json <fichiers modifiés>` : aucun finding nouveau.
3. Relire le diff SCSS : aucune couleur hex, aucun radius en px, aucune `transition` brute, aucun `@media` cosmétique.
4. Vérifier le rendu à 360 px et 1280 px (via `/run` ou le navigateur) pour toute vue touchée.
