# IndieHost — Contexte projet complet pour Claude

## Vue d'ensemble

IndieHost est une plateforme SaaS de location saisonnière à **0% de commission**. Les hôtes créent leur propre page de réservation directe avec paiement Stripe intégré, calendrier synchronisé depuis Airbnb/Booking, messagerie, et gestion de domaines personnalisés.

**Stack résumée :** Vue 3 + Fastify (Node.js) + PostgreSQL + Docker Compose + Clerk + Stripe

---

## Suivi des tâches : `TODO.md` (règle permanente)

`TODO.md`, à la racine, est la liste unique de ce qui reste à faire, par l'utilisateur ou par Claude. Il sert à ne jamais perdre le fil d'une session à l'autre.

**Structure imposée par l'utilisateur, toujours deux parties** : `## Ce que vous devez faire` (actions et décisions de l'utilisateur) puis `## À faire par Claude` (chacune découpée en sous-sections thématiques `###`), et enfin `## Fait`. Ne jamais mélanger les deux types dans une même liste : une tâche qui dépend des deux est coupée en deux entrées, et celle de Claude précise « (après …) ». Le même découpage s'applique aux récapitulatifs de fin de tâche donnés à l'utilisateur.

1. **Avant toute tâche**, lire `TODO.md`. Si la demande y figure déjà, partir de cette entrée ; sinon, l'ajouter dans la bonne partie et la bonne section.
2. **Tout ce qui est remis à plus tard** va dans `TODO.md`, avec son contexte (fichiers, raison, qui doit agir) : point découvert en chemin, hors périmètre, en attente d'une décision ou d'une information de l'utilisateur. Ne pas le laisser seulement dans la conversation.
3. **À la fin d'une tâche**, cocher l'entrée et la déplacer dans « Fait », avec la date et le commit.
4. **Sessions parallèles** : le fichier est partagé. Ne modifier que ses propres entrées, et ne committer que ses propres lignes.

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
/*           → frontend Vite (port 5179 en dev, nginx static en prod)
```
Le microservice de scraping n'est **pas** exposé en prod (seul le nginx de dev garde `/scraping/*`) : l'API l'appelle sur le réseau Docker (`SCRAPING_SERVICE_URL`, défaut `http://scraping:8000`).

nginx restaure l'IP réelle derrière Cloudflare (`set_real_ip_from` + `CF-Connecting-IP` dans `nginx.conf.template` ; mettre à jour les plages si Cloudflare en publie de nouvelles) et écrase `X-Real-IP` / `X-Forwarded-Host` : l'API s'appuie sur `X-Real-IP` pour ses limites de débit (`lib/rateLimit.ts`).

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

FastAPI Python, stateless, **interne** (ni CORS ni documentation Swagger). Endpoint `POST /scrape` :
- Input : `{ url, currency?, check_in?, check_out?, proxy_url? }`
- Output : données brutes listing (title, photos, équipements, prix, avis)
- Scrapers : Airbnb (`airbnb_scraper.py`), Booking.com (`booking_scraper.py`)
- Appelé uniquement par l'API via `POST /api/v1/imports/scrape` (`domains/imports/`) : route publique (import depuis la landing sans compte), URL Airbnb/Booking **reconstruite** côté serveur à partir de l'identifiant (jamais l'URL fournie), `proxy_url` jamais transmis, 6 imports / 10 min / IP, 3 imports simultanés max, erreurs techniques du scraper gardées dans les logs

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
| `/dashboard/admin` | AdminRoute (super admin uniquement : clients, invitations Clerk, abonnement/logements supplémentaires d'un client, lien de paiement Stripe à lui envoyer) |

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
- **RawMedias** : `{ images: [{ src, alt, position }], videos: [{ src, type, poster, alt }] }`
  - Vidéos : max 3 par annonce, MP4/WebM/MOV ≤ 150 Mo (`validation.listing.videos` dans `locales/editor/fr.json`). Toujours hébergées sur ImageKit dès l'envoi (jamais en data URL) via `POST /api/v1/medias/imagekit/upload-video` (corps binaire `application/octet-stream` + en-têtes `X-File-Name`/`X-File-Type`/`X-Listing-Id`, client `uploadListingVideoToImageKit` avec progression). Poster = `<url>/ik-thumbnail.jpg`. Affichées sous la description sur l'annonce publique (`ListingView/components/Gallery/ListingVideos.vue`). nginx `/api/` : `client_max_body_size 160m` + timeouts 300 s.
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
2. Import optionnel Airbnb/Booking via `POST /api/v1/imports/scrape` (relais vers le microservice Python)
3. Sauvegarde brouillon : `PATCH /api/v1/listings/:id/draft`
4. Publication : `POST /api/v1/listings/publish` (vérifie abonnement Stripe)

### Réservation
1. Visiteur → page `/:slug` → sélection dates → paiement Stripe
2. Acompte ou intégralité selon config `payment.mode`
3. Backend : création `Reservation` + `CalendarEvent`
4. Guest : confirmation + lien guide d'arrivée `/listing/guide/:id`

Le serveur ne fait pas confiance au navigateur :
- `POST /payments/stripe/payment-intents` recalcule le total (`domains/payments/reservationPricing.ts`) et refuse les dates déjà prises. **Ce calcul est une copie de `frontend/src/domain/listings/pricing.ts` + `reservationRules.ts` (`computeReservationPricing`) : toute évolution de la tarification doit être faite des deux côtés**, sinon les réservations sont refusées (`INVALID_RESERVATION_TOTAL`).
- `POST /bookings` d'un voyageur (ni propriétaire ni admin) exige un PaymentIntent émis par l'API pour cette annonce et ces dates, réglé chez Stripe et jamais rattaché à une autre réservation (`PaymentsService.verifyReservationPayment`) ; montants et statut du paiement sont réécrits depuis la ligne `Payment`, l'id de réservation est choisi par le serveur, `internalNote` / `messaging` sont ignorés.
- Une annulation ne rembourse qu'un PaymentIntent lié à la réservation dans la table `Payment` (et dont la metadata `listingId` correspond).

### Synchronisation calendrier
- Sources iCal externes (Airbnb, Booking) configurées dans Management
- Sync périodique → `CalendarEvent` créés automatiquement

---

## Sécurité — règles importantes

- `CLERK_SECRET_KEY` et `STRIPE_SECRET_KEY` **jamais** dans le code ni dans les logs
- En prod : toutes les clés secrètes passent par `secrets/*.txt` (Docker secrets)
- `.env` racine est dans `.gitignore` — ne pas committer
- Le microservice scraping n'est joignable que sur le réseau Docker (voir « Microservice scraping »)
- Backend valide chaque requête via JWT Clerk (pas de bypass possible)
- Rôle admin : lu uniquement dans `private_metadata` / `public_metadata` Clerk (jamais `unsafe_metadata`, modifiable par l'utilisateur) ou via `SUPER_ADMIN_EMAILS`
- Tout `v-html` de contenu hôte, voyageur ou importé passe par `sanitizeHtml()` (`frontend/src/utils/sanitizeHtml.ts`, DOMPurify, classes `ql-*` uniquement)
- URL distantes récupérées par le serveur (sources iCal) : `lib/safeRemoteFetch.ts` (https, IP publiques uniquement, redirections revalidées, taille plafonnée)
- Gel admin : un admin qui passe une annonce en `blocked` pose `core.blockedBy = 'admin'` ; le propriétaire ne peut alors plus changer le statut (ni réactiver une annonce `deleted`), ni modifier `kind`

---

## MCP configurés (Claude Code — `~/.claude/settings.json`)

| MCP | Transport | Rôle |
|-----|-----------|------|
| **vercel** | stdio (npx) | Gestion déploiements Vercel |
| **clerk** | HTTP — `https://mcp.clerk.com/mcp` | Snippets code Clerk officiels |

---

## Skills UI/UX (Claude Code — `.claude/skills/`)

Installés le 2026-10-21 et versionnés dans le repo. Claude les charge selon la tâche ; ils s'invoquent aussi à la main.

| Skill | Source | Usage |
|-------|--------|-------|
| **indiehost-ui** | maison | Règles du repo pour toute UI : tokens SCSS, mixins (`references/mixins.md`), copie FR vouvoyée, a11y, checklist avant livraison. À charger en premier pour tout travail dans `frontend/`. |
| **frontend-design** | `anthropics/skills` | Direction visuelle pour une nouvelle surface ou une refonte (typo, palette, anti-« template »). Les tokens IndieHost priment sur ses interdits génériques. |
| **impeccable** | `pbakaus/impeccable` (Apache-2.0) | `/impeccable shape\|critique\|audit\|polish\|harden\|animate\|clarify… <cible>`. Lit `PRODUCT.md` et `DESIGN.md` à la racine. Cibler un chemin dans `frontend/`. |
| **web-design-guidelines** | `vercel-labs/agent-skills` | Audit a11y / UX / perf de fichiers contre les Web Interface Guidelines de Vercel (récupère les règles sur GitHub à chaque run). |
| **emil-design-eng** + 10 skills animation | `emilkowalski/skills` (installés le 2026-10-22) | Craft UI et motion d'Emil Kowalski (Vercel/Linear) : `emil-design-eng` (philosophie générale, revue en tableau Avant/Après), `animate` (construire une animation : propriété, courbe, durée), `review-animations`, `improve-animations` (audit + plans), `find-animation-opportunities`, `animation-performance` (frame budget, propriétés composite), `animation-vocabulary` (glossaire), `apple-design` (springs, gestes, sheets), `prototype` (plusieurs variantes derrière un switcher, invocation explicite), `mobile-native` (100vh, tap highlight, safe areas), `break-ui` (données extrêmes). Non installés car hors stack : `animate-expo` (React Native), `write-swift`, `ask-sonner` et `pick-ui-library` (bibliothèques React). Les tokens IndieHost priment : durées/easings via `animations.transition()`, jamais de `transition` brute. |

- `PRODUCT.md` (contexte produit) et `DESIGN.md` (design system, format DESIGN.md spec) à la racine sont la source de vérité pour ces skills : les mettre à jour quand les tokens ou le produit changent.
- `skills-lock.json` suit les versions. Mise à jour : `npx skills update` (frontend-design, web-design-guidelines, skills emilkowalski) et `npx impeccable update` (impeccable). Ajout d'un skill de ce dépôt : `npx skills@latest add emilkowalski/skills -a claude-code -s <nom> --copy -y` (un `-s` par skill, la liste séparée par des virgules n'est pas acceptée).
- Le binaire moteur impeccable (`.claude/skills/impeccable/scripts/bin/`, ~16 Mo) est gitignoré : le launcher le retélécharge au premier `impeccable context` sur chaque machine. Le hook automatique n'est pas installé (`--no-hooks`) ; pour l'activer : `npx impeccable install --providers=claude --scope=project --force`.
- Sous-agents impeccable dans `.claude/agents/impeccable-*.md`. Détecteur manuel : `.claude/skills/impeccable/scripts/impeccable detect --json <fichiers>` (l'anti-pattern `gradient-text` est ignoré : signature de marque).

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
| `_animations.scss` | `@use '@/styles/variables/animations' as animations` | `@include animations.transition($duration, $timing, $properties)` (jamais `all`), `animations.press()`, `animations.reduced-motion {}`, courbes `$ease-out/$ease-in-out/$ease-drawer`, durées `$duration-press/fast/base/menu/overlay/exit` — **non forwardé par globals, import séparé requis** |
| `_layouts.scss` (survol) | via globals | `@include on-hover { }` / `@include can-hover { }` : tout `:hover` derrière `(hover: hover) and (pointer: fine)` |
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
@include animations.transition(animations.$duration-menu, animations.$ease-out, (grid-template-rows, opacity)); // hauteur animée explicitement
@include animations.press();          // scale(0.97) à l'appui, déjà dans buttons.*
@include on-hover { color: $accent; } // jamais de &:hover nu (reste collé au tap)

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

Après un changement de `nginx/nginx.conf.template` ou `nginx/proxy-locations.conf` : ces fichiers sont montés **fichier par fichier** (bind mount) et `git pull` remplace l'inode → le conteneur en cours (et `nginx -s reload`) garde l'ancienne version. Il faut recréer le conteneur : `docker compose up -d --force-recreate --wait nginx`, puis vérifier avec `docker compose exec -T nginx grep <directive> /etc/nginx/snippets/proxy-locations.conf`.

### Rôles et plans (offre 2026-10)

| Compte | Droits |
|--------|--------|
| **Super admin** (`SUPER_ADMIN_EMAILS=dev@indiehost.fr`, ou rôle `admin`/`super_admin` en métadonnée Clerk) | Voit toutes les annonces (`/users/admin/listings`), édite tout, publie à la place d'un client (aucune condition de facturation ni de limite), gèle (`blocked`), supprime (`deleted`), transfère la propriété. Résolu côté API par `plugins/auth.ts` (email principal Clerk) → `hasAdminAccess()`, exposé au front par `/users/me` → `isAdmin`. |
| **IndieHost** — 19 € TTC/mois | 2 logements en ligne inclus |
| **SuperHost** — 49 € TTC/mois | 6 logements en ligne inclus |
| **Logement supplémentaire** — 12 € TTC/mois/logement | Item add-on sur l'abonnement Stripe (quantité), ajouté/retiré depuis le dashboard (`POST /payments/stripe/subscriptions/extra-listings`) |
| **Plan offert** (admin) | `POST/DELETE /payments/stripe/admin/users/:userId/complimentary-plan` : compte actif sans Stripe (`billing.complimentary`), illimité ou jusqu'à une date, logements supplémentaires sans facturation. Un abonnement Stripe réel le remplace. L'admin crée les annonces du client directement à son nom depuis `/dashboard/editor/:userId` (`ownerId` à la création). |

- Source de vérité : le catalogue Stripe live, produits avec métadonnées `indiehost_plan_code` (`indiehost` / `superhost` / `extra_listing`) et `indiehost_max_active_listings`. La résolution est **stricte** (métadonnée ou nom exact, produits/prix archivés ignorés) — plus jamais de correspondance par préfixe de nom. Valeurs de secours dans `backend/api/src/domains/payments/plans.catalog.ts`.
- Limite « logements en gestion » = inclus + supplémentaires, **appliquée côté API** à la publication (`assertCanPublishListing`, statuts comptés : `published`, `paused`, `blocked` ; brouillons illimités). Erreur 403 `LISTING_PUBLICATION_REQUIREMENTS_NOT_MET` avec `listing_limit_reached`. Le front lit `listingAllowance` dans `GET /payments/stripe/subscriptions/me`.
- Essai gratuit 30 jours sur les deux plans ; offres annuelles archivées ; MegaHost supprimé.

### Pages principales (annonces mères)

Un hôte qui a plusieurs logements sous un même domaine crée une **page principale** (`Listing.kind = 'hub'`, bouton « Créer une page principale » dans Mes annonces) : elle répond à la racine de son sous-domaine / domaine personnalisé et présente les logements rattachés (`Listing.parentListingId`). Chaque logement reste accessible sous le même hôte via `https://<hôte>/<slug>`.

- Éditeur : une page principale n'a que titre, domaine(s), photos, description, visibilité et le panneau « Logements présentés » ; une annonce classique a le panneau « Page principale » (`PUT /listings/:id/parent`).
- Public : `_Listing.vue` rend `ListingHub/_ListingHub.vue` quand `core.kind === 'hub'` (enfants via `GET /listings/:id/children`, annonces `published`/`blocked` uniquement). Résolution par hôte : la page principale répond sans slug, un enfant répond avec son slug (sous-domaine géré ou domaine personnalisé).
- Les pages principales ne comptent pas dans la limite de logements du plan.
- Galerie (éditeur et assistant de création) : glisser-déposer de fichiers image sur tout le panneau.

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
- Vérifications post-déploiement : `https://indiehost.fr`, `/api/health`, `docker compose ps scraping` (healthy ; `/scraping/*` n'est plus routé publiquement), un sous-domaine `*.indiehost.fr`, `http://` → 301 ; `docker compose logs migrate` doit afficher « All migrations have been successfully applied ».

---

## Dernières modifications (mis à jour 2026-10-22)

- **Écran de chargement du tableau de bord** (`components/layouts/BootLoader.vue`, `composables/useBootLoader.ts`) : actif seulement quand la page chargée est sous `/dashboard`, il reste jusqu'à ce que la route soit résolue, Clerk chargé et l'API silencieuse 220 ms (intercepteurs axios, plafond 5 s), puis le contenu monte d'un bloc. Un script en ligne de `index.html` pose `html.is-booting` avant le premier affichage : à garder (et à autoriser par hash si une CSP `script-src` est ajoutée). Une nouvelle vue du tableau de bord qui appelle l'API autrement qu'avec axios ne sera pas attendue.

- **Pages légales, traceurs, remboursements** (`94d6974`) :
  - **Pages légales** : documents dans `frontend/src/views/Legal/` (registre `legalPages.json`, un fragment HTML par document dans `content/`), route `/legal/:page`, pré-rendus en HTML statique au build (`frontend/plugins/legal-prerender/`).
  - **Traceurs** : aucun avant consentement (pas de GTM ni GA4 ; hCaptcha, Stripe.js et Google Maps chargés seulement à la demande), donc pas de bandeau cookies. Toute nouvelle balise tierce doit garder cette règle ou ajouter un consentement.
  - **Remboursements voyageurs** : seulement si l'hôte active `bookings.pricing.cancellation.refundsEnabled` (désactivé par défaut, sinon réservation non remboursable). Une annulation par l'hôte (`POST /bookings/:id/host-cancel`) rembourse intégralement. Les remboursements font `reverse_transfer` (repris sur le compte Stripe de l'hôte).
  - **Abonnements** : résiliation et reprise depuis Mon profil (`POST /payments/stripe/subscriptions/cancellation`), fin de période sans remboursement ; remboursement uniquement en cas de rétractation dans les 14 jours, sur demande par e-mail.
  - **Restes à faire** : voir `TODO.md`.

- **Passe Emil Kowalski sur tout le front (mobile + desktop)** : `_animations.scss` réécrit (courbes `$ease-out/$ease-in-out/$ease-drawer`, durées `$duration-*`, `transition()` sans `all`, `press()`, `reduced-motion`) ; survol derrière `on-hover`/`can-hover` ; `scale(0.97)` à l'appui dans `buttons.*` et sur les contrôles maison ; overlays en sheet `translateY(100%)` sous lg et modale `scale(0.96)` au-delà, popovers ancrés au déclencheur ; base mobile globale (tap highlight, `touch-action`, champs 16 px, safe areas toujours actives, `touchstart` passif pour `:active` sur iOS) ; `100vh` → `dvh`/`svh` ; `sr()` en `power3.out` 0.6 s sans délai. Règles reportées dans `DESIGN.md` (Motion) et le skill `indiehost-ui`.

- **Vidéos d'annonce** : upload binaire vers ImageKit (`POST /medias/imagekit/upload-video`), section « Vidéos » du panneau galerie de l'éditeur (progression, suppression, drag & drop), lecture sous la description de l'annonce publique (voir « RawMedias »)

- **Skills UI/UX** ajoutés dans `.claude/skills/` (indiehost-ui, frontend-design, impeccable, web-design-guidelines) + `PRODUCT.md` et `DESIGN.md` à la racine (voir section « Skills UI/UX »)

- **Mise en production** sur VPS Hostinger + Cloudflare (voir section « Déploiement production »)
- `frontend/vite.config.ts` : `server.allowedHosts: true` (Vite 6.4 n'accepte plus `'all'`, cassait le type-check donc le build)
- `frontend/src/locales/editor/fr.json` : ajout du `subtitle` du panneau import de l'éditeur
- `.gitignore` : `/secrets.production` ignoré
- `CLERK_SECRET_KEY` ajouté comme placeholder dans `.env` racine (à remplacer après rotation de clé)
- Commentaire CORS ajouté dans `.env` pour accès réseau via IP
- MCP Clerk (`https://mcp.clerk.com/mcp`) ajouté dans `~/.claude/settings.json`
- `CLAUDE.md` créé et enrichi avec analyse complète du projet
