# Product

IndieHost est une plateforme SaaS de réservation directe à 0 % de commission pour les hôtes de location saisonnière (gîtes, appartements, maisons, chambres d'hôtes). Chaque hôte obtient sa propre page de réservation (`slug.indiehost.fr` ou domaine personnalisé) avec paiement Stripe, calendrier synchronisé Airbnb/Booking, messagerie et guide d'arrivée.

> Rédigé le 2026-10-21 à partir de `CLAUDE.md` et du code, sans entretien produit. Les points marqués *(inféré)* sont des hypothèses à confirmer ou corriger via `/impeccable init`.

## Platform
web

## Stack
Vue 3.5 (`<script setup>`, Composition API) + Vite 6 + TypeScript · SCSS avec design tokens maison (`frontend/src/styles/`, voir `DESIGN.md`) · @nuxt/ui 4 (usage marginal : `UApp`, `UCalendar`) · Pinia · Vue Router 4 · GSAP 3 (ScrollTrigger, ScrollSmoother) · Lucide icons · Swiper / Keen Slider · Quill · Clerk (auth) · Stripe (paiements, abonnements, Connect) · ImageKit (médias). Backend Fastify + Prisma + PostgreSQL. Architecture complète dans `CLAUDE.md`.

## Users
Deux publics distincts, deux familles de surfaces :

1. **Hôtes** : propriétaires ou gestionnaires de 1 à 6 logements, souvent déjà présents sur Airbnb/Booking. Surfaces : landing `/`, pricing, wizard de création d'annonce (15+ étapes), éditeur, management (réservations, règles tarifaires), messagerie, domaines. Ils gèrent leur location en marge d'une autre activité, sur desktop comme sur mobile, et veulent reprendre la main sur leurs réservations sans payer de commission. Mode impeccable : **Operate** pour le dashboard, **Persuade** pour landing et pricing.
2. **Voyageurs** : invités de l'hôte, arrivent via un lien partagé, majoritairement sur mobile. Surfaces : page annonce publique `/:slug`, tunnel de réservation et paiement, confirmation, guide d'arrivée `/listing/guide/:id`. Ils doivent faire confiance à une page qu'ils ne connaissent pas, puis payer. Mode impeccable : **Persuade** pour la page annonce, **Operate** pour le checkout et le guide.

## Product Purpose
Permettre à un hôte de vendre ses nuits en direct, sans commission, avec une page aussi rassurante et complète qu'une fiche Airbnb, et permettre aux voyageurs de réserver et payer en quelques minutes.

## Positioning
Alternative indépendante aux OTA (Airbnb, Booking.com) : abonnement mensuel fixe (IndieHost 29 €, SuperHost 39 €, MegaHost 99 € TTC/mois) au lieu d'une commission par réservation. L'import d'annonce depuis Airbnb/Booking (scraping) réduit le coût de migration. Les OTA restent des partenaires affichés (avis multi-plateformes, logos officiels), pas des ennemis à caricaturer.

## Operating Context
- Produit français : interface en français par défaut, **vouvoiement**. La landing est traduite (fr, en, de, es, pt, ja, zh).
- Les voyageurs arrivent surtout sur mobile via un lien ; les hôtes utilisent le dashboard sur desktop et mobile.
- Sous-domaines gérés `*.indiehost.fr` et domaines personnalisés : la page annonce doit tenir seule, sans le chrome marketing du site.
- Paiement réel (Stripe live) : chaque écran de checkout engage de l'argent et doit être sans ambiguïté.
- iOS : garde-fous spécifiques (classes `is-ios`, `ios-landing-lite`) qui désactivent certaines animations lourdes.

## Capabilities and Constraints
- Données d'annonce stockées en JSON souple (core, bookings, medias, arrival, notes, comments, host) : les écrans doivent tolérer des champs absents.
- Tarification avancée (remises durée et fenêtre de réservation, week-end, acompte/solde, taxes, frais extra-voyageurs) : beaucoup d'états à rendre lisibles.
- Limite d'abonnement : 6 annonces actives par défaut.
- Pas de mode sombre implémenté côté SCSS : le store `theme` existe mais aucun token dark n'est défini *(inféré : non prioritaire)*.
- Tout style passe par les tokens SCSS décrits dans `DESIGN.md` : zéro valeur hardcodée.
- Le build de prod lance `vue-tsc` : toute erreur TypeScript casse l'image Docker.

## Brand Commitments
- Fontes : **Fustat** (titres) et **Outfit** (texte), variables, auto-hébergées.
- Palette : neutres chauds (`#fcfafa` / `#111117`), dégradé signature lavande → orchidée → rose (`rgb(163,153,255)` → `rgb(223,153,255)` → `rgb(255,196,197)`) réservé aux mots-clés des titres et aux moments forts.
- Logos IndieHost (`LogoFull*`, `LogoIcon*`) et logos OTA via composants dédiés (`AirbnbLogo.vue`, `BookingLogo.vue`).
- Ton : direct, rassurant, vouvoiement, sans jargon technique.

## Evidence on Hand
- Landing page et pricing en production sur https://indiehost.fr (mise en ligne 2026-10-20).
- Contenus landing (bénéfices, FAQ, preuves) dans `frontend/src/locales/landing/*.json`.
- Pas de données analytics ni d'études utilisateurs versionnées *(inféré)*.

## Product Principles
1. **La confiance d'abord** : une page annonce doit sembler aussi sérieuse qu'une OTA (photos, avis, conditions claires, paiement sécurisé visible).
2. **Zéro surprise sur le prix** : détail des nuits, remises, taxes, acompte et solde toujours lisibles avant paiement.
3. **L'hôte reste maître** : le dashboard privilégie clarté et rapidité sur la démonstration visuelle.
4. **Mobile-first pour les voyageurs**, desktop confortable pour les hôtes.
5. **Cohérence par les tokens** : chaque nouvelle UI réutilise les mixins et variables existants plutôt que d'en créer.

## Accessibility & Inclusion
- Cibles tactiles d'au moins 44 px sur mobile ; `focus-visible` visible sur tout élément interactif.
- `prefers-reduced-motion` respecté (déjà géré dans `sr()`), animations GSAP désactivées sur iOS bas de gamme.
- Contraste texte d'au moins 4.5:1 sur les surfaces claires (`$secondary` sur `$accent`).
- `html[lang]` synchronisé avec la locale Clerk ; libellés et messages d'erreur en français clair.
