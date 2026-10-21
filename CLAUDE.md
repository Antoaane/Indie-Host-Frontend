# IndieHost — Contexte projet complet pour Claude

## Vue d'ensemble

IndieHost est une plateforme SaaS de location saisonnière à **0% de commission**. Les hôtes créent leur propre page de réservation directe avec paiement Stripe intégré, calendrier synchronisé depuis Airbnb/Booking, messagerie, et gestion de domaines personnalisés.

**Stack résumée :** Vue 3 + Fastify (Node.js) + PostgreSQL + Docker Compose + Clerk + Stripe

---

## Architecture générale

Monorepo avec 3 services + reverse proxy, orchestrés via Docker Compose :

```
/
├── frontend/           Vue 3 + Vite (port interne 5179)
├── backend/api/        Node.js + Fastify + Prisma (port interne 4000)
├── backend/microservices/microservice-scraping-py/   FastAPI Python (port interne 8000)
├── nginx/              Reverse proxy (80 dev / 80+443 prod)
├── .env                Variables d'env racine — partagées par tous les services
├── docker-compose.yml
├── docker-compose.dev.yml
├── init-indiehost.sh/.ps1
├── start-indiehost.sh/.ps1
└── start-indiehost-dev.sh/.ps1
```

### Routing nginx (dev et prod)
```
/api/*       → backend Fastify  (port 4000)
/scraping/*  → microservice Python (port 8000)
/*           → frontend Vite (port 5179 en dev, nginx static en prod)
```

### Docker Compose services
| Service | Rôle | Dépendances |
|---------|------|-------------|
| **preflight** | Valide .env et secrets avant démarrage | — |
| **postgres** | Base PostgreSQL 16 | preflight |
| **migrate** | Exécute migrations Prisma | preflight + postgres |
| **api** | API Fastify | preflight + migrate + postgres |
| **scraping** | Scraper Python | preflight |
| **frontend** | App Vue (+ nginx static en prod) | preflight |
| **nginx** | Reverse proxy SSL | frontend + api + scraping |
| **certbot** | Renouvellement SSL Cloudflare DNS-01 | — |

---

## Commandes de développement

```bash
# Lancer tout le projet (recommandé)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Frontend seul hors Docker
cd frontend && npm run dev          # port 5179

# Backend seul hors Docker (nécessite DATABASE_URL dans backend/api/.env)
cd backend/api && npm run dev

# Migrations Prisma
cd backend/api && npm run prisma:push    # dev (sans migrations)
cd backend/api && npm run prisma:studio  # UI Prisma
```

---

## Stack technique détaillée

### Frontend (`frontend/`)

| Couche | Technologie |
|--------|-------------|
| Framework | Vue 3.5 (Composition API, `<script setup>`) |
| Build | Vite 6.2 + TypeScript |
| UI | @nuxt/ui 4 (composants) + Tailwind CSS |
| Auth | @clerk/vue 1.17 |
| State | Pinia 3 |
| Router | Vue Router 4 (createWebHistory) |
| Animations | GSAP 3.12 (ScrollTrigger, ScrollSmoother) + Lenis |
| Paiements | @stripe/stripe-js 8.8 |
| Médias | ImageKit |
| Rich text | Quill 2.0 |
| Carrousels | Swiper 12, Keen Slider, Splide |
| Icônes | Lucide Vue Next |
| CSS | Sass 1.87 |
| HTTP | Axios |

### Backend (`backend/api/`)

| Couche | Technologie |
|--------|-------------|
| Framework | Fastify 5.2 + TypeScript 5.8 |
| ORM | Prisma 6.6 + PostgreSQL |
| Auth | Clerk JWT via `jose` 6 (JWKS) |
| Validation | Zod 3.24 |
| Paiements | stripe 17.7 |
| Dates | date-fns 4.1 |
| Calendrier | ical-generator + node-ical |
| Dev runtime | tsx 4.19 (watch mode) |

### Microservice scraping (`backend/microservices/microservice-scraping-py/`)

FastAPI Python, stateless. Endpoint `POST /scrape` :
- Input : `{ url, currency?, check_in?, check_out?, proxy_url? }`
- Output : données brutes listing (title, photos, équipements, prix, avis)
- Scrapers : Airbnb (`airbnb_scraper.py`), Booking.com (`booking_scraper.py`)
- CORS ouvert (`allow_origins=["*"]`) — interne uniquement

---

## Configuration d'environnement

Toutes les variables sont dans `.env` à la racine. Docker les injecte dans chaque service. **Ce fichier n'est pas committé.**

### Variables Clerk
```
CLERK_JWKS_URL=https://possible-hagfish-82.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://possible-hagfish-82.clerk.accounts.dev
CLERK_AUDIENCE=          # Laisser vide
CLERK_SECRET_KEY=sk_test_...  # Clé secrète backend — secrets/ en prod
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cG9zc2libGUtaGFnZmlzaC04Mi5jbGVyay5hY2NvdW50cy5kZXYk
```
Instance Clerk dev : `possible-hagfish-82.clerk.accounts.dev`

### Variables Stripe
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
# STRIPE_SECRET_KEY → secrets/stripe_secret_key.txt en prod
```

### Variables infrastructure
```
NODE_ENV=development
BASE_URL=http://localhost
SSL_DOMAIN=localhost
STRICT_EXTERNAL_CONFIG=true   # false en dev → validation allégée
PUBLIC_LISTING_ROOT_DOMAIN=localhost
VITE_PUBLIC_LISTING_ROOT_DOMAIN=localhost
CORS_ORIGINS=http://localhost,http://localhost:5179,http://*.localhost:5179
```

### Secrets (prod uniquement, non-versionnés)
```
secrets/database_url.txt         → DATABASE_URL PostgreSQL
secrets/stripe_secret_key.txt    → sk_live_...
secrets/clerk_secret_key.txt     → sk_live_...
secrets/imagekit_api_key.txt     → clé privée ImageKit
secrets/cloudflare.ini           → Credentials Cloudflare DNS-01
```

---

## Base de données (Prisma Schema)

### Modèles principaux

| Modèle | Rôle | Champs clés |
|--------|------|-------------|
| **User** | Utilisateurs Clerk | `clerkUserId` (unique), `stripeConnectAccountId` |
| **Listing** | Annonces (données en JSON flexible) | `subdomainSlug`, `ownerId`, `status`, `core/bookings/medias/arrival/notes/comments/host` (JSON) |
| **Reservation** | Réservations | `listingId`, `startDate`, `endDate`, `guestClerkUserId` |
| **Conversation** | Threads messages | `listingId`, `reservationId` (unique) |
| **Message** | Messages individuels | `conversationId`, `authorRole`, `sentAt` |
| **Payment** | Paiements Stripe | `listingId`, `stripePaymentIntentId` (unique) |
| **CalendarSync** | Sources iCal externes | `listingId`, `sourceUrl` |
| **CalendarEvent** | Événements (sync + résa) | `listingId`, `reservationId` |

**Note architecturale :** Les annonces stockent leurs données (`core`, `bookings`, `medias`, `arrival`, `notes`, `comments`, `host`) en colonnes JSON → extensibilité sans migrations.

---

## Routing frontend (Vue Router)

### Routes publiques
| Path | Component | Notes |
|------|-----------|-------|
| `/` | Landing ou Listing | Dynamique selon hostname |
| `/sign-in`, `/sign-up` | Clerk auth | |
| `/pricing` | PricingView | |
| `/pricing/callback` | PricingChecklistCallbackView | Retour après auth/checkout/connect |
| `/:slug([a-z0-9-]+)` | Listing | Annonce publique |
| `/listing/guide/:id` | ListingGuide | Guide arrivée guest |
| `/booking/confirmation/:reservationId` | BookingConfirmationView | |
| `/donation` | DonationPage | |

### Routes protégées (nécessitent Clerk auth)
| Path | Component |
|------|-----------|
| `/dashboard/editor` | EditorRoute |
| `/dashboard/editor/:userId` | EditorRoute |
| `/dashboard/editor/:userId/create` | CreateListingRoute |
| `/dashboard/management` | ManagementRoute |
| `/dashboard/messages` | MessagingRoute |
| `/dashboard/domains` | DomainsRoute |

**Guards :** Les routes `/dashboard/*` sans `userId` attendent Clerk (2500ms max) puis redirigent vers variante `*-user` avec l'userId, ou vers `sign-in`.

**Détection hostname :** Si le hostname est un sous-domaine géré (`slug.indiehost.fr`), seules les routes listing/guide/confirmation sont accessibles — les autres redirigent vers `home`.

---

## Structure frontend détaillée

```
frontend/src/
├── views/
│   ├── Landing/_LandingPage.vue       # Page marketing (Hero, Features, Pricing, FAQ...)
│   ├── Editor/                        # Dashboard CRUD annonce complète
│   │   ├── EditorRoute.vue
│   │   ├── composables/               # useEditorController, useEditorDraftLifecycle...
│   │   └── components/EditorSidebar/panels/  # Panneaux par section (media, perks, etc.)
│   ├── CreateListing/                 # Wizard création (15+ étapes)
│   │   ├── CreateListingRoute.vue     # Variante auth
│   │   ├── CreateListingPublicRoute.vue  # Variante publique
│   │   └── wizard/                   # Machine à états, routing wizard
│   ├── Management/ManagementRoute.vue # Réservations, pricing rules
│   ├── Messaging/MessagingRoute.vue   # Conversations guest/host
│   ├── Domains/DomainsRoute.vue       # Domaines personnalisés
│   ├── Listing/_Listing.vue           # Annonce publique
│   ├── ListingView/                   # Détail + réservation
│   └── PricingView.vue               # Plans tarifaires
│
├── components/
│   ├── layouts/Header.vue, Footer.vue
│   ├── navs/                         # Navigation (variants: landing, public, host)
│   ├── DatePicker/                   # Sélecteur dates custom
│   ├── inputs/                       # Champs formulaires
│   ├── overlays/                     # Modales, drawers
│   └── svgs/                         # Icônes SVG
│
├── domain/
│   ├── listings/                     # Logique métier listings
│   │   ├── types.ts                  # Types RawListingBundle (tout le modèle de données)
│   │   ├── publicDomain.ts           # Détection sous-domaine géré
│   │   ├── controller.ts             # Interface abstraite ListingsController
│   │   ├── bookings.ts, pricing.ts, slug.ts, status.ts...
│   ├── api/                          # Appels REST vers backend
│   │   ├── listingsController.ts     # fetch/patch/publish listings
│   │   ├── stripePayments.ts, stripeSubscriptions.ts
│   │   ├── listingDomains.ts, listingCalendar.ts
│   │   └── bookings.ts, imagekit.ts, users.ts
│   ├── payments/
│   │   ├── pricingPlanCatalog.ts     # Plans: IndieHost 29€, SuperHost 39€, MegaHost 99€/mois
│   │   └── stripeClient.ts, checkoutPayment.ts
│   ├── user/
│   │   ├── subscription.ts           # Limites (max 6 annonces actives)
│   │   └── stripeConnect.ts
│   └── onboarding/listingOnboarding.ts  # Machine à états wizard
│
├── router/
│   ├── index.ts                      # Routes + guards Clerk
│   └── backOfficeUser.ts             # Résolution userId runtime
│
├── stores/
│   └── theme.ts                      # useThemeStore — 'light' | 'dark'
│
├── composables/
│   ├── useAdminAccess.ts
│   └── useImportLoadingFeedback.ts
│
├── utils/
│   ├── clerkToken.ts                 # getToken() pour Authorization header
│   ├── clerkRole.ts                  # Rôles admin
│   ├── viewport.ts                   # Breakpoints réactifs
│   ├── scrollReveal.ts               # GSAP animations entrée
│   ├── sectionScroller.ts
│   ├── i18n.ts, amenitiesCatalog.ts, amenitiesIcons.ts
│   └── medias/order.ts, swiper/listingMedia.ts
│
├── locales/clerk/                    # Traductions Clerk en français
├── App.vue                           # Root : Header + RouterView + Footer
└── main.ts                           # Entry point (Clerk, Pinia, Router, @nuxt/ui)
```

---

## Modèle de données listing (types.ts)

Le bundle listing est divisé en sections JSON stockées séparément :

### RawCore — Métadonnées
```typescript
{
  id?, slug?, status?,          // "draft" | "published" | "paused"
  title?, description?, type?,  // "apartment" | "house" | "gite" | ...
  city?, country?, region?, precise_address?,
  latitude?, longitude?, zoom?,
  guest_capacity?, rooms?, amenities?, perkSettings?,
  "reviews-display"?: { indiehost, airbnb, booking }
}
```

### RawBookings — Réservations et disponibilités
```typescript
{
  price?, fees?,
  "booked-days"?: RawBookedDay[],
  "external-booked-days"?: [],
  reservations?, pricing?: RawPricingSettings
}
```

### RawPricingSettings — Tarification avancée
```typescript
{
  stay?: { minNights, maxNights, weeklyDiscount, monthlyDiscount, durationDiscounts, bookingWindowDiscounts },
  weekend?: { enabled, price, percent },
  cancellation?: { policy, custom? },
  extraGuests?: { price, threshold },
  taxes?: { enabled, mode, amount, display },
  payment?: {
    methods?: { card, sepa, cash },
    mode?: "full" | "deposit",
    depositPercent?,
    balance?: { type: "arrival" | "before", days? }
  },
  occupancy?: { adultsMin, childrenMax, babiesMax, ... }
}
```

### RawMedias, RawArrival, RawNotes, RawComments
- **RawMedias** : `{ images: [{ src, alt, position }], videos: [{ src, type, poster }] }`
- **RawArrival** : Guide d'arrivée (intro, règles maison, accès, services, commerces)
- **RawNotes/RawComments** : Avis multi-OTA (IndieHost, Airbnb, Booking)

---

## Plans tarifaires (pricingPlanCatalog.ts)

| Plan | Prix TTC/mois | Stripe Product |
|------|-------------|----------------|
| IndieHost | 29 € | — |
| SuperHost | 39 € | — |
| MegaHost | 99 € | — |

Limites abonnement : max **6 annonces actives** par défaut.

---

## Auth Clerk — points critiques

- **main.ts** : Si `VITE_CLERK_PUBLISHABLE_KEY` manquant → `throw new Error` → app ne monte pas → **page grise**
- **Guards router** : Attente Clerk jusqu'à 2500ms (pollInterval 75ms) avant redirect
- **Token injection** : `utils/clerkToken.ts` → `getToken()` → header `Authorization: Bearer`
- **Rôles admin** : `utils/clerkRole.ts` + `composables/useAdminAccess.ts`
- **JWKS** : Backend vérifie JWT via `CLERK_JWKS_URL`

### Problème connu — page grise sur accès par IP

**Cause réelle (deux sources) :**
1. `frontend/.env` n'existe pas → Vite (hors Docker) ne trouve pas `VITE_CLERK_PUBLISHABLE_KEY` → `main.ts` throw → app ne monte pas
2. Clerk utilise des cookies sur `*.clerk.accounts.dev` avec restriction SameSite → bloqués quand l'origine est une IP brute

**Fix appliqué — `vite.config.ts`** : Le config remonte maintenant automatiquement au `.env` racine si `frontend/.env` est absent. `cd frontend && npm run dev` fonctionne sans `frontend/.env`.

**Pour accès depuis un autre appareil (téléphone, autre PC) :**
Clerk ne fonctionne pas avec une IP brute. Utiliser un hostname :
1. Trouver l'IP de la machine de dev (ex: `192.168.1.42`)
2. Sur l'appareil client, ajouter dans le fichier `hosts` :
   - Windows : `C:\Windows\System32\drivers\etc\hosts`
   - Mac/Linux : `/etc/hosts`
   - Ligne : `192.168.1.42  indiehost.local`
3. Dans Clerk Dashboard → Developers → Paths → "Fallback development host" → `http://indiehost.local`
4. Accéder via `http://indiehost.local` au lieu de l'IP

### Configuration Clerk Dashboard (dev)

Dans Clerk Dashboard → Developers → Paths :
- `<SignIn />` : Cocher **"Sign-in page on development host"** → `/sign-in`
- `<SignUp />` : Cocher **"Sign-in page on development host"** → `/sign-up`
- Ne pas laisser sur "Account Portal" (redirige vers `possible-hagfish-82.accounts.dev/sign-in`)

---

## Flux métier principaux

### Création d'annonce
1. Wizard `CreateListing` (15+ étapes : titre, description, localisation, capacité, chambres, galerie, équipements, tarification, remises, règles, import)
2. Import optionnel Airbnb/Booking via microservice Python `/scraping/scrape`
3. Sauvegarde brouillon : `PATCH /api/v1/listings/:id/draft`
4. Publication : `POST /api/v1/listings/publish` (vérifie abonnement Stripe)

### Réservation
1. Visiteur → page `/:slug` → sélection dates → paiement Stripe
2. Acompte ou intégralité selon config `payment.mode`
3. Backend : création `Reservation` + `CalendarEvent`
4. Guest : confirmation + lien guide d'arrivée `/listing/guide/:id`

### Synchronisation calendrier
- Sources iCal externes (Airbnb, Booking) configurées dans Management
- Sync périodique → `CalendarEvent` créés automatiquement

---

## Sécurité — règles importantes

- `CLERK_SECRET_KEY` et `STRIPE_SECRET_KEY` **jamais** dans le code ni dans les logs
- En prod : toutes les clés secrètes passent par `secrets/*.txt` (Docker secrets)
- `.env` racine est dans `.gitignore` — ne pas committer
- Le microservice scraping a CORS ouvert (`*`) — accessible uniquement en interne Docker
- Backend valide chaque requête via JWT Clerk (pas de bypass possible)

---

## MCP configurés (Claude Code — `~/.claude/settings.json`)

| MCP | Transport | Rôle |
|-----|-----------|------|
| **vercel** | stdio (npx) | Gestion déploiements Vercel |
| **clerk** | HTTP — `https://mcp.clerk.com/mcp` | Snippets code Clerk officiels |

---

## Scripts utilitaires

| Script | Rôle |
|--------|------|
| `init-indiehost.sh` | Initialisation one-shot (copie .env.example, secrets) |
| `start-indiehost.sh` | Démarrage prod (SSL + migrations + docker up) |
| `start-indiehost-dev.sh` | Démarrage dev (hot reload) |
| `scripts/docker/preflight.sh` | Validation config avant démarrage |

**Preflight (mode strict prod)** vérifie : `NODE_ENV=production`, domaines non-localhost, toutes clés API présentes, cohérence Clerk, certificats SSL.

---

## Intégrations externes

| Service | Usage | Clés |
|---------|-------|------|
| **Clerk** | Auth utilisateurs + JWT backend | `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| **Stripe** | Paiements réservations + abonnements SaaS | `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` |
| **Stripe Connect** | Reversements hôtes | `stripeConnectAccountId` par User |
| **ImageKit** | CDN + upload images | `IMAGEKIT_ENDPOINT`, `IMAGEKIT_API_KEY` |
| **Cloudflare** | DNS-01 pour SSL wildcard `*.indiehost.fr` | `cloudflare.ini` |
| **Let's Encrypt** | Certificats SSL auto-renewing | via Certbot |
| **Airbnb / Booking.com** | Import listings (scraping) | Aucune clé (HTML scraping) |
| **Gandi** | Gestion domaines personnalisés hôtes | `GANDI_API_BASE_URL` |
| **PostgreSQL 16** | Persistence principale | `DATABASE_URL` |

---

## Conventions SCSS — design tokens obligatoires

**Règle absolue : zéro valeur hardcodée dans les fichiers SCSS/style.** Tout doit provenir des fichiers de variables du design system.

### Fichiers de variables

| Fichier | Import | Contenu |
|---------|--------|---------|
| `_colors.scss` | `@use '@/styles/variables/globals' as *` | `$accent`, `$secondary`, `$secondary-text`, `$primary_gradiant_first/second/third`, `$airbnb`, `$bad`, `$good`, surfaces… |
| `_borders.scss` | `@use '@/styles/variables/borders' as borders` | `borders.$rounded-xs/sm/md/lg/xl/xxl/rounded` |
| `_texts.scss` | via globals | mixins `@include little-text()`, `@include base-text()`, `@include h1/h2/h3/h4-title()` |
| `_layouts.scss` | via globals | CSS vars `--layout-gap`, `--layout-gap-sm/md/xl/2xl/4xl` |
| `_animations.scss` | `@use '@/styles/variables/animations' as animations` | `@include animations.transition()` — **non forwardé par globals, import séparé requis** |
| `_effects.scss` | via globals | `@include halo()`, `@include big-shadow()` |
| `_buttons.scss` | `@use '@/styles/components/buttons' as buttons` | mixins `buttons.primary()`, `buttons.secondary()`, `buttons.low-btn()` |
| `_inputs.scss` | `@use '@/styles/components/inputs' as inputs` | mixin `inputs.action()` |

### Ce qui est interdit

```scss
// ❌ Couleurs hex brutes
color: #111117;
background: rgba(255, 82, 82, 0.1);
border: 1px solid rgba(0, 99, 201, 0.18);

// ❌ border-radius px/rem hardcodé
border-radius: 8px;
border-radius: 12px;
border-radius: 9999px;

// ❌ transition hardcodée
transition: all 200ms ease;

// ❌ font-size/font-weight bruts quand un mixin existe
font-size: 0.875rem;
font-weight: 700;
```

```scss
// ✅ Toujours utiliser les tokens
color: $secondary;
background: rgba($airbnb, 0.1);       // $airbnb = rgb(255, 82, 82)
border: 1px solid rgba($secondary, 0.08);

border-radius: borders.$rounded-sm;   // 0.5rem
border-radius: borders.$rounded-md;   // 0.75rem
border-radius: borders.$rounded;      // 9999px (pill)

@include animations.transition();     // import séparé requis

@include little-text($thin: false);   // remplace font-size + line-height + weight
```

### Media queries — responsive légitime uniquement

**Règle :** n'ajouter un `@media` que si le comportement diffère réellement entre mobile et desktop pour une raison fonctionnelle ou visuelle justifiée. Ne pas dupliquer des valeurs quasi-identiques juste pour "adapter au mobile".

**Critères pour un `@media` légitime :**
- Zone de tap trop petite sur mobile (boutons < 44px → agrandir)
- Rupture de layout réelle (flex row → column, grille qui déborde)
- Taille de police illisible sur petit écran (`clamp()` est souvent préférable au media query)
- Comportement UX différent selon le contexte (ex : sticky nav, overflow scroll)

**Ce qui est interdit :**
```scss
// ❌ Ajustement cosmétique marginal sans raison fonctionnelle
@media (max-width: 768px) {
  gap: var(--layout-gap-sm); // était --layout-gap, différence insignifiante
  font-size: 0.9rem;         // utiliser clamp() à la place
}

// ❌ Répéter les mêmes valeurs dans desktop et mobile
.element { padding: 1rem; }
@media (max-width: 768px) { .element { padding: 0.9rem; } }
```

```scss
// ✅ Rupture de layout réelle
@media (max-width: 768px) {
  .card { flex-direction: column; } // était row, déborde sur mobile
}

// ✅ Zone de tap (mobile-first UX)
@media (max-width: 768px) {
  .counter-btn { width: 60px; height: 60px; } // augmente la cible tactile
}

// ✅ clamp() plutôt qu'un media query pour la typographie
font-size: clamp(1rem, 4vw, 1.5rem); // s'adapte sans media query
```

Si `clamp()`, `min()`, `max()`, ou un CSS Grid/Flex fluide peut résoudre le problème, **préférer ces approches** à un media query.

### Logos OTA (Airbnb, Booking.com)

Toujours utiliser les composants Vue existants — ils embarquent fond, couleur et accessibilité :

```ts
import AirbnbLogo from '@/components/svgs/icons/AirbnbLogo.vue'
import BookingLogo from '@/components/svgs/icons/BookingLogo.vue'
```

Ne jamais recréer des badges texte colorés avec `$airbnb` ou des hex Booking.

---

## Déploiement production (indiehost.fr)

Mis en ligne le 2026-10-20. La prod tourne sur un **VPS Hostinger** (KVM 2, Ubuntu 26.04, Docker + Compose préinstallés), derrière le proxy Cloudflare.

| Élément | Valeur |
|---------|--------|
| VPS Hostinger | id `2079568` — IPv4 `45.93.139.219`, IPv6 `2a02:4780:c:128f::1` |
| Firewall Hostinger | groupe `indiehost-web` : TCP 22/80/443 uniquement |
| Code sur le serveur | `/opt/indiehost` (clone de `develop`), démarré par `./start-indiehost.sh` |
| Accès | `ssh root@45.93.139.219` (clé SSH, pas de mot de passe) |
| Cloudflare | zone `indiehost.fr` : `@` et `*` en A/AAAA proxied vers le VPS · SSL **Full (strict)** · Always HTTPS · TLS min 1.2 |
| Certificat | Let's Encrypt wildcard via certbot DNS-01 Cloudflare → `certbot/conf/live/indiehost.fr/` (renouvellement auto) |
| Clerk | instance **Production** (`clerk.indiehost.fr`), paths `/`, `/sign-in`, `/sign-up` |
| Stripe | compte live IndieHost SAS — aucun webhook utilisé par le backend |

### Secrets de prod

Préparés en local dans deux fichiers **gitignorés** puis copiés sur le VPS (`scp`, pas `rsync --chmod` qui n'existe pas sur macOS) :
- `.env.production` → `/opt/indiehost/.env`
- `secrets.production/*` → `/opt/indiehost/secrets/`

Aucun MCP ne peut lire les clés secrètes (Stripe `sk_live`, Clerk `sk_live`, ImageKit, token Cloudflare) : elles viennent toujours de l'utilisateur.

### Redéployer

```bash
ssh root@45.93.139.219
cd /opt/indiehost && git pull && docker compose up -d --build --wait
```

Après un changement de secret : recopier le fichier concerné, puis la même commande.

### Domaines personnalisés des hôtes (ex. `www.gite-belair.fr`)

Un hôte peut rattacher un domaine qu'il possède déjà depuis `/dashboard/domains` (panneau `CustomDomainPanel.vue`, guide intégré ouvert automatiquement les 3 premières fois puis via le bouton ⓘ).

| Étape | Mécanisme |
|-------|-----------|
| Rattachement | `PUT /api/v1/listings/:id/custom-domain { domain }` → `Listing.customDomain` (unique) ; plan requis, propriétaire uniquement ; `www.x.fr` et `x.fr` ne peuvent pas être rattachés à deux annonces différentes |
| Instructions DNS | sous-domaine (`www`) → **CNAME** `CUSTOM_DOMAIN_CNAME_TARGET` (`custom.indiehost.fr`, enregistrement A **DNS only** côté Cloudflare — jamais proxifié) ; domaine nu → **A** `CUSTOM_DOMAIN_TARGET_IPV4` (`45.93.139.219`) |
| Vérification | `POST …/custom-domain/verify` → `dns.resolve4(domain)` doit contenir l'IP du VPS → `customDomainVerifiedAt` |
| Certificat | l'API écrit les domaines vérifiés dans `certbot/custom-domains/domains.txt` (volume partagé) ; le conteneur `certbot` émet un certificat Let's Encrypt **HTTP-01 webroot** toutes les 2 min pour chaque domaine sans certificat, et renouvelle tout en `certbot renew` toutes les 12 h |
| Service | nginx `default_server` 443 : certificat choisi par SNI (`$ssl_server_name` filtré par un `map`), `location` communes dans `nginx/proxy-locations.conf` |
| Routage front | `publicDomain.ts` → `isListingHostname()` (sous-domaine géré **ou** domaine personnalisé) ; l'API résout le hostname via `GET /listings/domains/resolve` |

Les domaines personnalisés pointent **directement** sur le VPS (pas via Cloudflare) : pas de session Clerk sur ces hôtes (consultation + réservation uniquement, réservation en auth optionnelle).

### Pièges connus

- `frontend` : `npm run build` lance `vue-tsc --build` en parallèle de `vite build` → **toute erreur TS fait échouer l'image Docker**. Lancer `cd frontend && npm run type-check` avant de déployer.
- Le build de l'image `scraping` (Playwright + Chromium, ~2 Go) prend ~15 min sur le VPS ; les autres rebuilds sont rapides grâce au cache.
- Vérifications post-déploiement : `https://indiehost.fr`, `/api/health`, `/scraping/health`, un sous-domaine `*.indiehost.fr`, `http://` → 301 ; `docker compose logs migrate` doit afficher « All migrations have been successfully applied ».

---

## Dernières modifications (mis à jour 2026-10-20)

- **Mise en production** sur VPS Hostinger + Cloudflare (voir section « Déploiement production »)
- `frontend/vite.config.ts` : `server.allowedHosts: true` (Vite 6.4 n'accepte plus `'all'`, cassait le type-check donc le build)
- `frontend/src/locales/editor/fr.json` : ajout du `subtitle` du panneau import de l'éditeur
- `.gitignore` : `/secrets.production` ignoré
- `CLERK_SECRET_KEY` ajouté comme placeholder dans `.env` racine (à remplacer après rotation de clé)
- Commentaire CORS ajouté dans `.env` pour accès réseau via IP
- MCP Clerk (`https://mcp.clerk.com/mcp`) ajouté dans `~/.claude/settings.json`
- `CLAUDE.md` créé et enrichi avec analyse complète du projet
