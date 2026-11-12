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
| Validation | Zod 4.6 (`z.record` prend toujours deux arguments : clé puis valeur) |
| E-mails (secours SMTP) | nodemailer 10 (types fournis par le paquet) |
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
| `/dashboard/page/:listingId` | HubPageEditRoute (mode édition de la page de présentation d'une page principale) |
| `/dashboard/revenues` | RevenuesRoute (« Mes revenus » : état du compte Stripe de l'hôte, solde, virements, paiements des réservations) |
| `/dashboard/admin` | AdminRoute (super admin uniquement, onglet dans `?onglet=apercu\|utilisateurs\|paiements\|services`) : abonnés et chiffres, comptes et droits (rôle admin, connexion bloquée), invitations, abonnement d'un client, lien de paiement, paiements réussis ou refusés, santé des services en direct, carte floorplan. Voir « Administration » |

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
│   │   ├── pricingPlanCatalog.ts     # Plans: IndieHost 19 €, SuperHost 49 €, logement supplémentaire 12 €/mois
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

| Plan | Prix TTC/mois | Logements en ligne inclus |
|------|-------------|----------------|
| IndieHost | 19 € | 2 |
| SuperHost | 49 € | 6 |
| Logement supplémentaire | 12 € par logement | + 1 |

Détail (essai, plan offert, source de vérité Stripe) : « Rôles et plans (offre 2026-10) ». MegaHost n'existe plus.

---

## Auth Clerk — points critiques

- **main.ts** : Si `VITE_CLERK_PUBLISHABLE_KEY` manquant → `throw new Error` → app ne monte pas → **page grise**
- **Guards router** : Attente Clerk jusqu'à 2500ms (pollInterval 75ms) avant redirect
- **Token injection** : `utils/clerkToken.ts` → `getToken()` → header `Authorization: Bearer`
- **Rôles admin** : `utils/clerkRole.ts` + `composables/useAdminAccess.ts`
- **JWKS** : Backend vérifie JWT via `CLERK_JWKS_URL`
- **Un hôte connecté arrive sur son tableau de bord, jamais sur la landing** (2026-11-12, `utils/authEntry.ts`) :
  - Ces arrivées passent toutes par **`/dashboard`** (route `dashboard-entry`, `SIGNED_IN_ENTRY_PATH`), jamais affichée : sa garde (`resolveSignedInEntry`, `router/index.ts`) demande `isAdmin` à `/users/me` (2,5 s au plus, et dans les 4,5 s qui suivent l'ouverture de la page, que couvre l'écran de chargement) et ouvre **l'administration pour un administrateur** (dev@indiehost.fr, demande du 2026-11-12), « Mes annonces » pour tous les autres ou si l'API ne répond pas.
  - Après connexion ou inscription : `resolvePostAuthRedirect` (`SignInView.vue`, `SignUpView.vue`) garde le `redirect_url` demandé quand il sert (annonce, tarifs, `/pricing/callback`, une page précise du tableau de bord) et le remplace par `/dashboard` pour la landing, les pages légales, `/donation` et les pages de connexion. Le lien « Se connecter » de la navigation passe la page courante, donc `redirect_url=/` depuis la landing : c'est ce qui y ramenait l'hôte.
  - Ouverture de `/` sur indiehost.fr avec une session (adresse tapée, retour de Clerk, « Impersonate », invitation) : la garde du routeur lit le cookie `__client_uat` (posé par Clerk sur le domaine, > 0 avec une session), attend Clerk jusqu'à 4 s sous l'écran de chargement (`landingEntryMayBeSignedIn` dans `useBootLoader.ts`) puis ouvre `/dashboard` sans afficher la landing. Cookie périmé (session expirée) : la landing s'affiche après Clerk, environ 0,3 s plus tard. En secours, `composables/useDashboardEntryRedirect.ts` (appelé par la landing) redirige quand Clerk répond après l'attente. Un lien interne vers `/` affiche toujours la landing ; pour la voir connecté, navigation privée.
  - Un `__clerk_ticket` présent sur `/` part vers `/sign-in` (ou `/sign-up` si `__clerk_status=sign_up`) avec `redirect_url=/dashboard` (garde du routeur). Le logo de la navigation (`NavShell.vue`, variantes hôte et publique) ouvre `/dashboard/editor` (`DASHBOARD_ENTRY_PATH`) pour un utilisateur connecté, administrateur compris, et `/` sinon.
- **Le jeton de session Clerk ne porte pas l'e-mail** (réglage par défaut, rien d'ajouté sur l'instance de production : vérifié le 2026-11-12). `upsertUserFromAuth` ne recevait donc aucune adresse, `User.email` restait vide et aucun e-mail aux hôtes ne pouvait partir. L'adresse principale est maintenant lue chez Clerk et enregistrée (`domains/users/userEmail.ts`) : à la visite d'un compte qui n'en a pas (sans attendre), avant chaque e-mail à un hôte (`deliverHostEmail`) et au début des rappels planifiés.  Avant un e-mail à un hôte, l'adresse est relue chez Clerk au plus une fois par heure et remplacée si elle a changé. Ces écritures passent en SQL direct pour ne pas toucher `updatedAt` (inactivité d'un compte pour la purge RGPD). **L'adresse du compte n'est jamais montrée aux voyageurs** (confirmation, guide) : seul le contact saisi par l'hôte l'est, et un nom d'hôte n'est jamais tiré d'une adresse (« Votre hôte » sinon). Lire l'e-mail d'un compte : `User.email` après ce rattrapage, ou `fetchClerkUserById`, jamais le jeton. Contrôle : `npx tsx backend/api/scripts/user-email-smoke.ts`.

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

### Paiements des réservations (Stripe Connect, paiements directs)

Modèle aligné sur le profil plateforme Stripe validé (« les marchands encaissent directement », Stripe responsable des soldes négatifs). Ne jamais revenir aux comptes `type: express` ni aux destination charges sans refaire le profil plateforme : Stripe refuse alors la création des comptes (`STRIPE_CONNECT_PLATFORM_PROFILE_REQUIRED`).
- Compte de l'hôte : `stripe.accounts.create` avec `controller` = `fees.payer: account`, `losses.payments: stripe`, `requirement_collection: stripe`, `stripe_dashboard.type: full` (`CONNECT_DASHBOARD_TYPE` : l'hôte crée un identifiant Stripe avec mot de passe). Le Dashboard Express (validation par SMS) a été essayé le 2026-10-23 et refusé en production : en Accounts v1, Stripe l'exige avec `fees.payer: application` et des pertes portées par la plateforme. Il demande l'API Accounts v2 (voir `TODO.md`). Le type de dashboard est immuable : un compte d'un autre type et jamais soumis est remplacé au clic suivant (l'ancien n'est détaché qu'après création du nouveau), un compte soumis est conservé, inscription par Account Link hébergé par Stripe (`payments.service.ts`, `ensureStripeConnectAccount`, `createConnectOnboardingLink`).
- Inscription allégée : la page d'activation (`PricingChecklistCallbackView.vue`) demande « particulier / professionnel » (`hostStatus`) avant d'ouvrir Stripe. Le compte est pré-rempli (`buildConnectAccountPrefill`) : `business_type: individual` pour un particulier (parcours personne physique, sans SIRET ni société, comme sur Airbnb), MCC 7011 (hébergement), description de l'activité, URL publique de l'annonce si elle existe, e-mail et nom connus ; un compte déjà créé mais pas encore soumis est complété au clic suivant. L'Account Link ne demande que le nécessaire immédiat (`collection_options.fields: currently_due`, `future_requirements: omit`).
- Paiement : PaymentIntent créé **sur le compte de l'hôte** (`{ stripeAccount }`), sans `transfer_data` ; commission éventuelle par `application_fee_amount` (0 par défaut). Côté voyageur, Stripe.js est chargé avec ce compte (`loadStripeClient(stripeAccount)` dans `domain/payments/stripeClient.ts`, appelé par `Checkout.vue`).
- Vérification, annulation et remboursement d'un paiement : toujours avec `{ stripeAccount: Payment.stripeConnectedAccountId }` (`verifyReservationPayment`, `BookingsService.applyStripeCancellation`).
- Un numéro de compte `acct_…` envoyé par le navigateur n'est jamais cru : ces numéros sont publics (renvoyés au voyageur avec le paiement). Le site n'en envoie plus aucun ; synchronisation, lien d'inscription et lien de tableau de bord prennent le compte rattaché au profil et refusent tout autre numéro (403 `STRIPE_CONNECT_ACCOUNT_NOT_OWNED`, `resolveOwnedConnectAccountId`). Chaque relecture du compte chez Stripe vérifie aussi qu'il a été créé pour ce profil (`metadata.userId`, posée à la création ; `assertConnectAccountOwner`). Avant le 2026-11-12, un numéro venu du navigateur était rattaché sans contrôle : `npm run connect-audit` (prod : `docker compose exec -T api node dist/domains/payments/connectAudit.cli.js`) relit chaque compte rattaché, en lecture seule ; lancé en production le 2026-11-12, rien d'anormal. `User.stripeConnectAccountId` est unique en base depuis (migration `20261112200000_user_stripe_account_unique`). Contrôle : `npx tsx backend/api/scripts/connect-ownership-smoke.ts`.
- Tableau de bord de l'hôte : `dashboard.stripe.com` (Dashboard complet) ; lien de connexion `accounts.createLoginLink` pour un compte au Dashboard Express. L'inscription affiche l'image de marque du compte IndieHost (nom, icône, couleurs dans Stripe → Paramètres → Adaptation à votre marque).
- L'hôte est le commerçant : il paie les frais Stripe et gère ses litiges dans son Dashboard ; IndieHost ne détient jamais les fonds.

### E-mails automatiques (Brevo)

Envoi par l'API HTTP de Brevo (`BREVO_API_KEY`, gratuit jusqu'à 300 e-mails/jour) ou à défaut en SMTP (`lib/mailer.ts`) ; sans l'un ni l'autre, rien ne part et l'API continue. Expéditeur `MAIL_FROM` (par défaut `IndieHost <no-reply@mail.indiehost.fr>`), réponses des e-mails hôtes vers `contact@indiehost.fr`.
- Domaine d'envoi : le sous-domaine `mail.indiehost.fr`, authentifié chez Brevo, car la racine sert à Google Workspace. Les enregistrements sont dans Cloudflare : TXT `brevo-code` sur `mail`, CNAME `brevo1/brevo2._domainkey.mail` (DNS only), TXT `_dmarc.mail` en `p=none`. `mail`, `clerk`, `accounts`, `clkmail` et `custom` sont réservés aux sous-domaines d'annonce (`reservedSlugs`). Un expéditeur hors de ce sous-domaine serait refusé ou classé en spam.
- Brevo anonymise les ouvertures par défaut. Ses liens de suivi des clics ne se désactivent pas sur l'offre gratuite.
- Voyageurs : confirmation et annulation (`notifications.service.ts`).
- Hôtes, sur événement (`domains/notifications/hostNotifications.ts`, appelé sans attendre) : nouvelle réservation, annulation (par le voyageur ou l'hôte), message d'un voyageur (au plus un e-mail par conversation toutes les 30 min), nouvel avis, annonce en ligne (une fois par annonce, avec « dernier logement disponible » si la publication remplit l'offre), limite de l'offre atteinte, litige ouvert et remboursement échoué (webhooks Stripe des comptes connectés).
- Hôtes, rappels planifiés (`jobs/hostReminders.ts`, chaque heure de 9 h à 20 h, heure de Paris, `HOST_REMINDERS_ENABLED=false` pour couper) : arrivée demain, bienvenue, brouillon inactif (2 jours puis dernier rappel), paiements Stripe pas activés (2 jours après la bienvenue, puis 7 jours plus tard), fin d'essai / d'abonnement résilié / d'accès offert (3 jours avant), calendrier iCal en erreur (après une nouvelle tentative, une fois par semaine). `npm run host-reminders -- --dry-run` liste ce qui partirait.
- Anti-doublon : chaque e-mail pose une ligne `HostNotification` (clé unique) avant l'envoi, retirée si l'envoi échoue ; purgée après 400 jours (`jobs/retention.ts`).
- Les rappels (brouillon, paiements, limite) portent un lien de désinscription signé (`GET/POST /notifications/unsubscribe`, en-têtes `List-Unsubscribe` en un clic) → `User.emailRemindersOptOutAt` ; les e-mails liés à une réservation ou un paiement ne se refusent pas.
- Gabarits : `hostEmailKit.ts` (blocs rendus en HTML et en texte), `hostBookingEmails.ts`, `hostAccountEmails.ts`. Aperçu de tous les e-mails : `cd backend/api && npx tsx src/domains/notifications/preview.cli.ts`.

### Synchronisation calendrier
- Sources iCal externes (Airbnb, Booking) configurées dans l'éditeur (Réglages, puis iCal)
- Synchronisées à la consultation de l'annonce publique (`syncListingSourcesForPublicView`), pas par une tâche périodique ; les sources en erreur sont relancées par les rappels aux hôtes avant d'alerter → `CalendarEvent` créés automatiquement
- `bookings['external-booked-days']` (et leur part de `booked-days`) n'est écrit que par la synchronisation. Une mise à jour de `bookings` venue du site ne peut pas les remplacer (`domains/listings/syncedBookedDays.ts`, appelé par `patchListingResource` ; contrôle : `npx tsx backend/api/scripts/synced-days-smoke.ts`), et « Appliquer » de l'éditeur n'envoie plus ni jours bloqués ni réservations (`withoutServerManagedBookings`). Le 2026-11-11, un brouillon ancien renvoyé par « Appliquer » avait effacé les jours Booking du calendrier public.
- Flux exporté (`exportListingCalendar`) : une période importée y sort sous un identifiant IndieHost stable (`import-…@indiehost.fr`), jamais sous celui d'origine. Booking importe ce flux et y retrouvait ses propres événements. Les jours fermés à la main sortent toujours (`block-…@indiehost.fr`, même quand l'annonce a des réservations), les réservations annulées ne sortent plus.
- La page publique synchronise le logement **par son identifiant** (`refreshListingAvailability(core.id)`, `fetchListingRaw.ts`) : sur un domaine relié, l'hôte seul désigne la page principale, et la synchronisation partait vers elle (2026-11-11).
- Flux arrivé **vide** alors que la source fermait encore des dates à venir : il n'est pas appliqué (`domains/calendar/emptyFeedGuard.ts`), la source passe en erreur avec un message pour l'hôte (supprimer puis rajouter le calendrier s'il a vraiment rouvert ses dates). Contrôle : `npx tsx backend/api/scripts/calendar-guard-smoke.ts`. Le 2026-11-11, le flux Booking de « Raisins Clairs » était vide alors que 17 mois restaient fermés.
- `rebuildListingBookedDaysFromCalendarEvents` tourne à chaque consultation et à chaque synchronisation, même en échec : `booked-days` (lu par le calendrier public **et** par le contrôle du paiement, `isReservationRangeAvailable`) se reconstruit depuis les événements en base.

### Administration (`/dashboard/admin`, 2026-11-12)

- **Accès** : connexion Clerk, puis droits vérifiés par l'API. Administrateur = e-mail listé dans `SUPER_ADMIN_EMAILS` (`dev@indiehost.fr`, seul compte propriétaire de l'administration, décision du 2026-11-12 ; droits non modifiables depuis la page) ou `role` admin en `private_metadata` / `public_metadata` Clerk. Le site lit `isAdmin` de `/users/me` (`AdminRoute.vue`, bouton « Changer de compte ») ; chaque route `/admin/*` refuse elle-même (`requireAdmin` de `admin.plugin.ts`).
- **Site** : `views/Admin/_AdminPage.vue` (quatre onglets), `sections/` (Aperçu, Comptes = `AdminUsers.vue`, ancien `_Admin.vue`, Paiements, Services), `components/` (`ServiceDiagram.vue`, `UptimeStrip.vue`, `FloorplanMap.vue`). Données par `adminDataSource.ts` (API, ou fausses données sur `/dev/admin?onglet=…&etat=panne&acces=refuse`). Client `domain/api/admin.ts`. L'onglet « Comptes » garde l'adresse `?onglet=utilisateurs`.
- **Disposition** (2026-11-12, `admin-page.scss`) : sur ordinateur, toute la largeur sous la barre de navigation, comme « Mes annonces » : une colonne (onglets, compte connecté en bas) et le panneau de la section, dont le titre reste en haut. Seule la zone `.panel` défile (document verrouillé par `html:has(main > #admin-page)` dans `_global.scss`) ; elle repart en haut à chaque changement d'onglet. Sa hauteur est fixe : Comptes la remplit (liste et fiche défilent chacune dans sa colonne, la fiche repart en haut au choix d'un compte), la carte du code aussi (18 rem au moins). Aperçu, Comptes et Services passent sur deux colonnes à partir de `xxl` ; le schéma des services n'a ses quatre colonnes qu'à partir de `xl`. Sur téléphone, la page défile : onglets en texte seul sur une ligne, qui tiennent à 360 px (nombre de comptes masqué ; un libellé plus long doit y tenir aussi) ; toucher un compte ou suivre « Voir le compte » descend jusqu'à sa fiche. Où faire défiler se décide avec `isAdminWideLayout()` (`adminLayout.ts`) : 1 025 px comme `min-width(lg)`, alors que `vp.lg` bascule à 1 024 px. Formulaire d'invitation replié derrière « Inviter ».
- **API** (`domains/admin/`) : `GET /admin/overview` (abonnés **lus chez Stripe**, seule source à jour : aucun webhook d'abonnement n'est traité ; repli sur la base, signalé), `GET /admin/payments` (90 jours : paiements du compte IndieHost chez Stripe + table `Payment` des réservations ; un paiement jamais tenté n'est pas listé), `PUT /admin/users/:clerkUserId/role` et `/blocked` (`private_metadata.role`, bannissement Clerk ; jamais son propre compte ni un compte de `SUPER_ADMIN_EMAILS` ; un admin doit perdre son rôle avant d'être bloqué), `GET /admin/system/health` et `POST …/refresh`, `POST /admin/floorplan/ticket` + `GET /admin/floorplan/view?token=`. Contrôle : `npx tsx backend/api/scripts/admin-smoke.ts`.
- **Santé des services** (`systemHealth.ts`) : une sonde par service, dans le processus de l'API (démarrée à `onReady`, pas en test), toutes les 30 s pour le serveur (site `http://frontend/`, nginx `http://nginx/`, base, robot d'import), toutes les 5 à 10 min pour Stripe, Clerk, Brevo, ImageKit et les cartes ; accès public par Cloudflare et certificats (TLS sur `nginx:443`) **en production seulement**. Historique gardé en base (`healthStore.ts`) : une tranche de 30 min par service (`ServiceHealthBucket`, 90 jours, d'où la disponibilité sur 24 h, 7 et 30 jours ; la page dit « Depuis le … » tant que la fenêtre n'est pas pleine) et chaque changement d'état (`ServiceHealthIncident`, 180 jours ; « Au démarrage » pour un service trouvé en panne au lancement), relus au démarrage de l'API. Seules les mesures à l'heure prévue comptent pour la disponibilité (pas les mesures de confirmation ni « Tout remesurer »). Une passe à la fois : sondes, décision d'alerte, envoi de l'e-mail, puis écritures en base (5 s au plus chacune, rejouables) ; base injoignable : les mesures continuent en mémoire, sont écrites à son retour, et la page le signale. Une sonde qui a besoin de la base (calendriers, domaines des hôtes) répond « inconnu » quand elle ne répond pas : seule la base est alors en panne. L'API s'arrête proprement sur SIGTERM (`server.ts`, `app.close()`) : la dernière passe est écrite avant un redéploiement. Ajouter un service = une entrée de `SERVICES` (API), le type `ServiceId` des deux côtés et sa place dans `COLUMNS` / `EDGES` de `ServiceDiagram.vue`.
- **Alertes par e-mail** (`healthAlerts.ts`, **production seulement**, vers `HEALTH_ALERT_EMAILS`, vide : `SUPER_ADMIN_EMAILS`) : panne confirmée 30 s plus tard → un e-mail ; retour annoncé quand le service tient 5 min d'affilée (un service qui clignote n'envoie rien de plus) ; au plus un e-mail de panne par service toutes les 15 min et 6 sur 24 h (le 6e le dit) ; pannes d'un même passage réunies dans un seul e-mail ; e-mail raté retenté 15 min plus tard, retour compris. « À surveiller » n'alerte que pour les certificats et les tâches planifiées, et de nouveau quand un problème s'ajoute (les problèmes viennent de `ProbeResult.problems` : domaine, tâche). Pied de page interne, sans les liens des hôtes (`audience: 'internal'` de `mailLayout.ts`). Mémoire du planificateur en base (`ServiceHealthAlertState`) : un redémarrage ne resignale pas une panne et annonce son retour. `HEALTH_ALERTS_ENABLED=false` pour couper ; la page Services dit si les alertes partent (sinon pourquoi) et si le dernier e-mail est parti. Limite : si l'API elle-même s'arrête, ou si le service d'envoi (Brevo) est injoignable, rien ne part (surveillance extérieure : voir `TODO.md`). Contrôle : `npx tsx backend/api/scripts/health-smoke.ts`.
- **Tâches planifiées** : `lib/jobRuns.ts` (`registerScheduledJob`, `trackJobRun`) note chaque passage pour la page Services ; branché sur la purge, les rappels aux hôtes et le référencement des sites (`jobs/publicSites.ts`). Une tâche qui attrape ses erreurs élément par élément passe un bilan à `trackJobRun` (`assessPublicSitesReport` : tous les sites en échec = échec signalé, une partie = avertissement affiché sans alerte). Une nouvelle tâche planifiée s'y branche aussi (son identifiant dans `JobId` et `JOB_LABELS` de `systemHealth.ts`).
- **Carte du code (floorplan)** : plugin Claude Code installé pour le projet (`.claude/settings.json`, marketplace `haydenschmitty/floorplan`). La carte vit dans `floorplan/` (ignoré par git) : `architecture.json` et `descriptions/` en français, pour le propriétaire. Mise à jour : demander « mets à jour la carte floorplan » (le skill relit seulement ce qui a changé), puis l'exporter pour l'administration : `node floorplan/serve.mjs --export backend/api/assets/floorplan/indiehost-map.html --include flows,notes,health`, committer ce fichier et redéployer l'API (le `Dockerfile` copie `assets/`). Servie par l'API dans un bac à sable (en-tête CSP `sandbox`, `connect-src 'none'`), avec un ticket signé de deux minutes : un cadre n'envoie pas de session. nginx la sert par un bloc à part (`location = /api/v1/admin/floorplan/view`, `proxy-locations.conf`) qui ne pose pas la CSP globale du site : la carte a ses scripts en ligne, autorisés par la seule CSP de l'API. À garder quand la CSP passe en mode bloquant, sinon la carte reste blanche. `frontend/tsconfig.json` déclare l'alias `@/` pour que floorplan relie les fichiers du site. Son bilan de santé ne reconnaît pas `preHandler: fastify.authenticate` : il annonce « Anyone could change data » pour des routes qui exigent une connexion. Les alertes vérifiées sont classées « Not a problem » avec leur raison dans `floorplan/health-dismissed.json` (local, non versionné ; 9 le 2026-11-12).

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
- HTML nettoyé **aussi à l'écriture** côté API (`lib/sanitizeHtml.ts`, `sanitize-html`, même politique que `frontend/src/utils/sanitizeHtml.ts` : toute évolution se fait des deux côtés) : sections d'annonce (`core`, `arrival`, `comments`, `notes`, `host`, `medias.alt`), guide d'arrivée, messages (texte brut), import scraping, avis voyageur. Vérification rapide : `npx tsx backend/api/scripts/sanitize-smoke.ts`
- Réservation atomique (`bookings.service.ts`) : verrou consultatif Postgres par annonce (`lib/advisoryLock.ts`) + relecture des disponibilités sous verrou + rattachement conditionnel du `Payment` (`reservationId` unique) dans une seule transaction ; un voyageur qui perd la course est remboursé automatiquement (409 `RESERVATION_RANGE_UNAVAILABLE`, `refunded: true`)
- Limites de débit par IP (`lib/rateLimit.ts`) sur l'import, l'IA, `POST /payments/stripe/payment-intents`, `POST /bookings` et l'avis voyageur depuis le guide
- Annonce sans propriétaire : modifiable par un admin uniquement (plus de rattachement automatique au premier compte connecté)
- Annonce lue sans en être propriétaire ni admin (`GET /listings/core/:id`, `GET /listings/bundle/:id`, 2026-11-12) : `core` sans `precise_address` et avec une position déplacée de 60 à 150 m, stable par annonce (`redactCoreForPublic`, `listings.access.ts`, tirée de `BOOKING_GUIDE_ACCESS_SECRET`) ; la carte publique y ajoute son propre décalage et reste dans son cercle de 300 m. Le voyageur reçoit l'adresse avec sa clé, guide débloqué (`getReservationGuideAccess` → `listing.preciseAddress`, repris par `_ListingGuide.vue`). Comme `bookings` et `arrival`, la vue publique porte `redactedForPublic` et l'API refuse de l'enregistrer (409). Avant, l'adresse exacte et les coordonnées partaient vers tout visiteur alors que la carte et le guide public la cachaient. Contrôle : `npx tsx backend/api/scripts/listing-privacy-smoke.ts`
- Routes retirées le 2026-11-12, inutilisées par le site et en partie ouvertes sans compte : `/messaging/*` (clé d'invité choisie par l'appelant), `/arrival/listings/:id`, `GET|PATCH /medias/listings/:id`, `GET /bookings/listings/:id`, `PATCH /bookings/:id`. Une section d'annonce se lit et s'écrit par `/listings/:section/:id` ; le voyageur passe par `/bookings/guides/:clé`
- `BOOKING_GUIDE_ACCESS_SECRET` obligatoire et personnalisé (≥ 16 caractères) quand `NODE_ENV=production`, sinon l'API refuse de démarrer
- Logs Fastify : `?token=`, `?key=`, clés de guide `rg.…`, `Authorization` et cookies masqués (`maskSensitiveUrl` dans `app.ts`) ; journaux Docker limités à 5 × 10 Mo par conteneur (`x-logging` dans `docker-compose.yml`)
- Rôle admin : cache 60 s pour un rôle privilégié (5 min pour l'absence de rôle), `invalidateClerkRoleCache(userId)` exporté par `plugins/auth.ts`
- CSP complète en `Content-Security-Policy-Report-Only` dans `nginx/proxy-locations.conf` (Clerk, Stripe, hCaptcha, ImageKit, Google Maps, polices). Le script en ligne de `frontend/index.html` est autorisé par hash : le recalculer avec `node scripts/csp-inline-script-hash.js` à chaque modification. À passer en `Content-Security-Policy` une fois les parcours vérifiés sans violation dans la console
- RGPD (`domains/privacy/`, `jobs/retention.ts`) : `GET /users/me/export`, `DELETE /users/me` (anonymisation, refus 409 si abonnement ou séjour en cours), purge quotidienne selon `confidentialite.html` (réservations 5 ans, messages 1 an, `Payment.raw*` 90 j, `rawIcs` 7 j, comptes inactifs 3 ans ; `RETENTION_PURGE_ENABLED=false` pour couper, `npm run purge` à la main)

---

## MCP configurés

Serveurs du projet dans `.mcp.json` (versionné, tous activés par `enableAllProjectMcpServers`). Les secrets n'y figurent jamais : ils viennent de variables d'environnement de la machine.

| MCP | Transport | Rôle | Secret |
|-----|-----------|------|--------|
| **hostinger** | stdio (`npx hostinger-api-mcp`) | VPS, pare-feu | `HOSTINGER_API_TOKEN` |
| **stripe** | HTTP — `https://mcp.stripe.com` | Lecture du compte Stripe live, documentation | OAuth |
| **clerk** | HTTP — `https://mcp.clerk.com/mcp` | Configuration Clerk, snippets | OAuth |
| **cloudflare** | HTTP — `https://mcp.cloudflare.com/mcp` | DNS de `indiehost.fr` | OAuth |
| **brevo** | HTTP — `https://mcp.brevo.com/v1/brevo/mcp` | E-mails : journaux transactionnels, expéditeurs, domaines | `BREVO_MCP_TOKEN` : clé « MCP » de Brevo, accès complet en lecture et écriture au compte (distincte de `BREVO_API_KEY` du serveur) |

Hors projet (`~/.claude/settings.json`) : **vercel** (stdio, npx).

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
| **Stripe Connect** | Compte d'encaissement de chaque hôte (paiements directs) | `stripeConnectAccountId` par User |
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

### Thème clair et thème sombre (2026-11-11)

Les jetons de couleur de thème (`$accent`, `$secondary`, `$tertiary`, surfaces, `$bad-ink`, `$good-ink`, `$warn-ink`…) ne sont plus des couleurs figées : ce sont des variables CSS `--ih-*`, dont les valeurs sont posées une fois par `styles/layouts/_theme.scss` à partir des deux palettes de `_colors.scss` (`$palette-light`, `$palette-dark`).

- **Rien ne change dans les composants** : on écrit toujours `color: $secondary` et `rgba($secondary, 0.08)`. `rgba()` est redéfinie dans `_colors.scss` (chargée par `globals`) et produit un `color-mix()` pour un jeton de thème.
- **Interdit sur un jeton de thème** : `color.scale`, `color.mix`, `color.adjust`, `rgb($jeton, …)` (ce n'est pas une couleur pour Sass). Une nuance dérivée s'ajoute dans les deux palettes.
- **Texte sur un aplat de couleur fixe** (pastille jaune ou verte, bouton rouge, photo) : `$ink-static` / `$paper-static`, qui ne changent pas avec le thème. Un mixin de texte pose lui-même la couleur : la lui passer (`little-text($ink-static)`), une ligne `color:` avant lui est écrasée.
- **Thème sombre** : `html[data-theme='dark']` (plus la classe `dark` pour @nuxt/ui), uniquement sur les routes du tableau de bord (`meta.navVariant === 'host'`). Il suit le système par défaut ; l'hôte peut forcer clair ou sombre dans « Mon profil » → Apparence (`components/navs/Nav/HostAppearanceSettings.vue`), choix gardé dans `localStorage` (`indiehost:color-scheme`). Pilotage : `composables/useColorScheme.ts`, installé dans `App.vue`. Le magasin `stores/theme.ts` (logos) est tenu à jour par ce composable.
- **Îlot toujours clair** : classe `.theme-light` sur ce qui montre la page publique dans le tableau de bord (aperçu de l'éditeur, page à thème). L'accueil garde son propre mode sombre, indépendant.
- **Vérifier la lisibilité dans les deux thèmes** de tout nouvel écran du tableau de bord (texte ≥ 4,5:1). Aucune couleur en dur : elle resterait claire en mode sombre.

### Arrondis emboîtés

Un élément posé dans un autre prend l'arrondi du contenant moins la marge qui les sépare : `borders.inner(borders.$rounded-xl, var(--layout-gap-sm))`. Ne pas empiler trois boîtes arrondies : entre un panneau (`xl`) et des cartes (`lg`), il n'y a pas de place pour une boîte intermédiaire.

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
| Stripe | compte live IndieHost SAS. **Connect en modèle « logiciel »** (profil plateforme validé le 15 mars 2026) : l'hôte encaisse directement, paie ses frais Stripe, a le Dashboard Stripe complet, Stripe porte le risque des soldes négatifs. Webhook `POST /api/v1/payments/stripe/webhook` avec deux destinations et deux secrets : « Votre compte » (`STRIPE_WEBHOOK_SECRET`) et « Comptes connectés » (`STRIPE_CONNECT_WEBHOOK_SECRET`, où vivent les paiements des réservations) ; 503 tant qu'aucun secret n'est renseigné |
| Clerk webhook | `POST /api/v1/webhooks/clerk` (`CLERK_WEBHOOK_SECRET`, signature Svix vérifiée à la main) : `user.deleted` → anonymisation du compte ; 503 tant que le secret est vide |
| E-mails | Brevo (`BREVO_API_KEY`, compte « IndieHost », domaine d'envoi `mail.indiehost.fr` authentifié le 2026-10-23, expéditeur `no-reply@mail.indiehost.fr`) ou SMTP (`SMTP_*`) via `lib/mailer.ts` : e-mails voyageurs et hôtes (voir « E-mails automatiques ») ; désactivés (warn au premier envoi) tant qu'aucun des deux n'est configuré |

### Secrets de prod

Préparés en local dans deux fichiers **gitignorés** puis copiés sur le VPS (`scp`, pas `rsync --chmod` qui n'existe pas sur macOS) :
- `.env.production` → `/opt/indiehost/.env`
- `secrets.production/*` → `/opt/indiehost/secrets/`

Aucun MCP ne peut lire les clés secrètes (Stripe `sk_live`, Clerk `sk_live`, ImageKit, token Cloudflare) : elles viennent toujours de l'utilisateur.

### Redéployer

```bash
ssh root@45.93.139.219
cd /opt/indiehost && git pull && ./deploy-indiehost.sh
```

`deploy-indiehost.sh` reconstruit migrations, API et site (pas le scraping, sauf `--with-scraping`), redémarre, recrée nginx si sa configuration a changé, puis vérifie que l'API en ligne est la nouvelle : des routes récentes doivent répondre 401 sans session (404 = ancienne API ; la dernière ajoutée est `GET /api/v1/admin/system/health`). Le 2026-11-11, le site avait été mis à jour sans l'API : « Modifier la page » et « Mes revenus » répondaient « Route … not found ». Garder ces routes de contrôle à jour avec une route récente.

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
| Vérification | `POST …/custom-domain/verify` → **deux** contrôles : `dns.resolve4(domain)` doit contenir l'IP du VPS **et** un TXT `_indiehost-verification.<domaine>` (ou sur l'apex pour `www`) doit valoir `indiehost-verification=<jeton>` (`Listing.customDomainVerificationToken`, généré au rattachement) → `customDomainVerifiedAt`. Sans le TXT, le premier compte qui déclarait un domaine déjà pointé vers le VPS l'obtenait. |
| Certificat | l'API écrit les domaines vérifiés dans `certbot/custom-domains/domains.txt` (volume partagé) ; le conteneur `certbot` émet un certificat Let's Encrypt **HTTP-01 webroot** toutes les 2 min pour chaque domaine sans certificat, et renouvelle tout en `certbot renew` toutes les 12 h |
| Service | nginx `default_server` 443 : certificat choisi par SNI (`$ssl_server_name` filtré par un `map`), `location` communes dans `nginx/proxy-locations.conf` |
| Routage front | `publicDomain.ts` → `isListingHostname()` (sous-domaine géré **ou** domaine personnalisé) ; l'API résout le hostname via `GET /listings/domains/resolve` |

Les domaines personnalisés pointent **directement** sur le VPS (pas via Cloudflare) : pas de session Clerk sur ces hôtes (consultation + réservation uniquement, réservation en auth optionnelle).

### Sites des hôtes et référencement (2026-11-12)

But : qu'un domaine relié (ex. `apparts-saintfrancois.fr`) ou un sous-domaine soit indexé par Google comme le site de l'hôte, sans travail de sa part. Avant, tous les hôtes recevaient le HTML de l'accueil d'IndieHost (titre, canonique `https://indiehost.fr/`, FAQ et JSON-LD d'IndieHost).

- **HTML servi par l'API** (`backend/api/src/domains/publicSite/`) : nginx envoie chaque page d'un hôte d'annonce (chemin sans extension, `robots.txt`, `sitemap.xml`, `google….html`, clé IndexNow `.txt`) à `GET /v1/public-site/page` (en-têtes `X-Forwarded-Host`, `X-Original-URI`). L'API lit le shell vierge du build (`dist/__shell.html`, écrit par `marketing-prerender`, refusé au public par nginx ; en dev le serveur Vite, `PUBLIC_SITE_SHELL_URL`), retire les balises de l'accueil et pose titre, description, canonique, Open Graph, JSON-LD (`WebSite`, `LodgingBusiness`, `Apartment`/`House`/`Accommodation`) et le contenu dans `#app` (masqué jusqu'au montage de Vue). « Délégué » (guide, confirmation, pages légales, hôte inconnu) : `X-Accel-Redirect: /__frontend<chemin>`, nginx sert le site Vue comme avant. API injoignable ou lente (3 s / 10 s) : repli sur le site Vue (`recursive_error_pages on`, indispensable). Règles nginx : les `map` et `upstream` de `nginx.conf.template`, les `location` de `proxy-locations.conf`.
- **Une adresse par page** (`canonicalLocation`, `publicSite.service.ts`) : domaine relié vérifié, sinon sous-domaine (suivi du nom quand plusieurs annonces le partagent), sinon domaine de la page principale suivi du nom du logement, sinon `indiehost.fr/<nom>`. Toute autre adresse répond 301 (variante `www`, sous-domaine d'une annonce qui a son domaine, `indiehost.fr/<nom>` d'un logement rattaché, casse ou barre finale). Nom de logement inconnu : vraie 404 `noindex` ; annonce en pause ou en brouillon : `noindex`.
- **Titre et description** : « <nom> · <parties du lieu absentes du nom> » (« Coeur de Saint François · Guadeloupe »), description tirée du texte (160 caractères), plus jamais « | IndieHost ». Règle en double : `publicSite/siteContent.ts` ↔ `frontend/src/domain/listings/seo.ts`, **toute évolution des deux côtés**. Le site retire au démarrage les balises `data-ih-ssr` du serveur (`main.ts`) et les repose avec les mêmes valeurs (`_Listing.vue`, `_ListingHub.vue`) ; JSON-LD et `noindex` restent. Canonique côté site : origine + chemin, sans paramètres.
- **Note Booking ou Airbnb** : affichée sur la page, jamais balisée en `aggregateRating` (Google refuse les avis venus d'un autre site).
- **robots.txt et sitemap par domaine** : `https://<domaine>/robots.txt` annonce `https://<domaine>/sitemap.xml` (page principale + logements, avec photos). `indiehost.fr/api/v1/listings/sitemap.xml` (déplacé dans `publicSite.plugin.ts`) ne liste plus que les adresses d'indiehost.fr et de ses sous-domaines.
- **Pré-remplissage** (`publicSite/prefill.ts`) : une page principale avec un logement en ligne reçoit une fois (`core.page.prefilledAt`) une accroche, une présentation factuelle quand elle n'a aucun texte, et un pied de page. Seules les zones vides sont remplies ; ce que l'hôte vide ensuite reste vide. C'est la seule écriture de `core.page` hors `PUT /listings/:id/page`.
- **Pied de page du site** (`core.page.footer` : nom, une ligne, e-mail, téléphone) : modifiable dans le mode édition de la page, repris par les pages des logements (`ListingSiteFooter.vue`, `GET /listings/:id/site`) ; le © porte le nom du site et le lien « Contact » d'IndieHost disparaît quand l'hôte donne ses coordonnées.
- **Tâche horaire** (`jobs/publicSites.ts`, `PUBLIC_SITES_JOB_ENABLED`, aperçu `npm run public-sites -- --dry-run`) : pré-remplissage, fichier des certificats (variante `www` dès qu'elle pointe vers le VPS), Google Search Console (validation par fichier avec le compte de service d'IndieHost, ajout du site, propriétaires `SEARCH_CONSOLE_OWNER_EMAILS`, envoi du sitemap puis renvoi quand une page change, au plus une fois par jour), IndexNow (Bing, pages modifiées). État par site : table `PublicSite`. Search Console et IndexNow ne tournent qu'en production ; sans `GOOGLE_SERVICE_ACCOUNT_KEY`, rien n'est tenté. L'API Indexing de Google n'est pas utilisée (réservée aux offres d'emploi).
- **Déploiement** : `deploy-indiehost.sh` recrée nginx quand ses fichiers ont changé, puis contrôle `GET /api/v1/listings/deploy-check/site` (404 « Listing not found ») et `/__shell.html` (404).
- **Google Cloud** (2026-11-12) : organisation `indiehost.fr`, compte `antoine@indiehost.fr`, projet `indiehost-477314`. Compte de service `indiehost-search-console@indiehost-477314.iam.gserviceaccount.com`, sans rôle sur le projet ; sa clé est dans le `.env` du serveur (`GOOGLE_SERVICE_ACCOUNT_KEY`, base64), propriétaires `SEARCH_CONSOLE_OWNER_EMAILS=antoine@indiehost.fr,dev@indiehost.fr`. L’organisation interdit d’office les clés de compte de service (`iam.disableServiceAccountKeyCreation`) : pour en créer une, lever la règle sur le projet le temps de la création (rôle « Administration des règles de l’organisation »), puis la remettre. Ne jamais coller une clé dans une conversation : elle doit alors être supprimée et remplacée.
- Contrôle : `npx tsx backend/api/scripts/public-site-smoke.ts`. Essai local : `curl -H "X-Forwarded-Host: <hôte>" -H "X-Original-URI: /" http://localhost:4000/v1/public-site/page`.

### Pièges connus

- `frontend` : `npm run build` lance `vue-tsc --build` en parallèle de `vite build` → **toute erreur TS fait échouer l'image Docker**. Lancer `cd frontend && npm run type-check` avant de déployer.
- Paramètre d'adresse `?vue=…` : le serveur de développement de Vite le prend pour un morceau de composant Vue et répond une erreur (`ENOENT … '/dev/admin'`) au rechargement de la page. Choisir un autre nom (l'administration utilise `?onglet=`).
- Base de développement tenue par `prisma db push` (conteneur `api` de `docker-compose.dev.yml`, `.run/restart-local-dev.sh`) : une contrainte unique ajoutée au schéma fait refuser le push sans terminal (« Use the --accept-data-loss flag »), même sur une colonne vide, et l'API redémarre en boucle. Une fois par base existante : `docker exec indie-host-frontend-api-1 npx prisma db push --skip-generate --accept-data-loss` (cas du 2026-11-12, `User.stripeConnectAccountId` unique ; la base de ce PC est déjà à jour). La production passe par les migrations et n'est pas concernée.
- Le build de l'image `scraping` (Playwright + Chromium, ~2 Go) prend ~15 min sur le VPS ; les autres rebuilds sont rapides grâce au cache.
- Vérifications post-déploiement : `https://indiehost.fr`, `/api/health`, `docker compose ps scraping` (healthy ; `/scraping/*` n'est plus routé publiquement), un sous-domaine `*.indiehost.fr`, `http://` → 301 ; `docker compose logs migrate` doit afficher « All migrations have been successfully applied ».
- Ne pas nommer une classe comme un utilitaire Tailwind (`grid`, `flex`, `hidden`, `table`, `container`…) : @nuxt/ui charge Tailwind et la règle s'applique (un tableau `class="grid"` passait en `display: grid`).
- Un `:has()` placé dans un autre `:has()` est invalide : le navigateur ignore le sélecteur (ou l'élément de liste dans un `:is()`), sans erreur.
- `body` en `overflow-x: clip`, jamais `hidden` : avec `hidden` sur `html` et sur `body`, le `body` devient une zone de défilement à part. Le moindre dépassement s'y fait défiler en premier et, sur iPhone, le doigt posé sur la page bute au bout de ces quelques pixels (seuls les éléments fixes faisaient défiler la page, 2026-11-11). Contrôle : `document.body.scrollHeight === document.body.clientHeight`.
- La règle typographique globale (`styles/typography/_texts.scss`) donne la couleur du texte à chaque élément : un `<span>` dans un bouton ou une pastille colorés (onglet ouvert en noir) la garde et disparaît sur le fond. Lui poser `color: inherit` (libellés et chiffres des onglets de l'administration, 2026-11-12).
- Un mixin de texte (`base-text`, `little-text`…) pose `margin: 0` (et la couleur, la décoration) : l'inclure **avant** un `margin: 0 auto`, sinon l'élément n'est plus centré (jours du calendrier collés à gauche de leur case, 2026-11-11).
- Les mixins de titre (`h2-title`, `h3-title`, `h4-title`) posent `margin-bottom: 0.5rem` : un `margin: 0` écrit avant eux est écrasé. Pour un titre sans marge, `& { margin: 0; }` après le mixin. Sinon le titre remonte d'environ 4 px dans une ligne centrée et s'écarte de la phrase qui le suit (administration, 2026-11-12).
- Bloc `<style lang="scss">` d'un fichier `.vue` : en développement, le greffon Vue fait lire le SCSS brut par postcss avant Sass. Un commentaire `//` posé juste avant une déclaration (« Unknown word ») ou une apostrophe droite dans un commentaire (« Unclosed string ») font échouer la feuille avec `npm run dev`. Le build, lui, passe. Placer le commentaire avant un bloc imbriqué, écrire ’, ou garder les styles dans un `.scss` chargé par `@use`, qui n'est pas concerné (2026-11-12, `FloorplanMap.vue`).
- Classes de transition Vue (`*-enter-from`, `*-leave-to`) : sans effet face à une règle de base plus spécifique (sélecteur avec `#booking`, longue chaîne de classes). Poser la valeur de repos de la propriété animée dans une règle à une classe, placée avant les classes de la transition.
- Fichiers `.mjs` : absents de `mime.types` de nginx. `vite.config.ts` publie les `.mjs` en `.js` et `frontend/nginx.conf` sert quand même les `.mjs` en JavaScript. Un fichier nouveau servi par nginx se vérifie avec le build (`npx vite build`, puis le dossier `dist` monté dans `nginx:alpine` avec `frontend/nginx.conf`) : `npm run dev` ne passe pas par nginx.
- Greffon de développement `plugins/file-path-comment` : il ajoute l'en-tête « File: » aux fichiers modifiés. Il ignore désormais un fichier vide ou encore en train de changer, et les pages légales (`views/Legal/content/`) : le 2026-11-11, il avait vidé `cookies.html` en le lisant pendant son écriture. Après une écriture par script, vérifier `git diff --numstat`.

---

## Dernières modifications (mis à jour 2026-11-10)

- **Page d'un logement sur téléphone, refonte (2026-11-11)** (étude d'Airbnb, Vrbo, Booking, Baymard et NN/g ; route d'essai `/dev/listing`) :
  - La page défile avec le document (plus de cadre de la hauteur de l'écran) : Safari réduit ses barres au défilement. Barre de réservation `position: fixed` en bas, pleine largeur, opaque (Safari 26 reprend sa couleur sous sa barre d'outils) ; la page lui laisse sa hauteur (`#listing-page > .listing-view.is-mobile-layout`, `listing-view.scss`). Fond clair partout (`html:has(… .is-mobile-layout)` dans `_global.scss`). Aucune zone ne doit défiler à part dans la page : sur iPhone elle prend le doigt et bloque le défilement (le `body` en était une jusqu'au 2026-11-11, voir « Pièges connus »).
  - Barre d'état : Safari 26 ne laisse pas dessiner dessous (portrait, onglet) et la colore avec le fond du `body` (`theme-color` n'y vaut que pour les applications installées). `useListingStatusBarTint.ts` donne au `body` la couleur du bord haut de la première photo (miniature ImageKit lue sur un canvas, `Access-Control-Allow-Origin: *`) et à `theme-color` pour Android.
  - Photo en 3:2, compteur « 1 / N », photos suivantes en fondu ; barre du haut fixée à l'écran (retour vers la page principale quand la racine du domaine en est une, « Éditer » pour le propriétaire, Partager), transparente sur la photo puis blanche quand la photo est passée dessous (`is-solid`, `ListingMobileLayout.vue`) : la teinte de la barre d'état s'efface alors pour le fond de la page ; fiche blanche arrondie posée dessus ; sections séparées par un filet (`Core.vue`, `> * + *`), équipements en lignes simples, pied de page légal compact (`LegalLinksCompact.vue`, 0,75 rem, cible 2rem).
  - Barre du bas : **total du séjour** frais compris et dates (premières dates libres proposées d'office), calculé par `computeReservationPricing` avec les voyageurs gardés par la page (`ListingMobileLayout.vue`, prop `occupants` de `Booking.vue`). Plus de « Prix indicatif ».
  - Fenêtre de réservation : un cadre Arrivée | Départ / Voyageurs, compteurs de voyageurs ouverts dans le cadre (téléphone), détail du prix affiché d'emblée (`alwaysShowSummary`). Calendrier plein écran du téléphone : `StayCalendarSheet.vue` (reka `RangeCalendar`, 12 mois défilant de haut en bas, « Effacer » / « Valider »). Ne pas passer `weekStartsOn` : avec `locale="fr"`, reka compte déjà le lundi comme premier jour (`1` décalait au mardi).
  - Carte (`Map.vue`) : OpenFreeMap style « liberty » via MapLibre GL 6.16 (chargé à l'approche, `setWorkerUrl` obligatoire sous Vite ; worker publié en `.js` par `assetFileNames` dans `vite.config.ts` : en `.mjs`, nginx le servait en `application/octet-stream` et la carte restait vide en production, alors qu'elle s'affichait avec `npm run dev`), zone approximative de 300 m au centre légèrement décalé, sans geste au doigt, lien « Ouvrir dans Plans / Google Maps ». CSP : `https://tiles.openfreemap.org` en `connect-src`. Pages cookies et confidentialité mises à jour.
  - Dates « AAAA-MM-JJ » lues et affichées en UTC (`labels.ts`, `Checkout.vue`) : un voyageur aux Antilles voyait la veille.

- **Passe du 2026-11-10** (détail dans `TODO.md`, section « Fait ») :
  - Jeton Clerk : tout appel authentifié du front passe par `getFreshAuthToken()` (`frontend/src/utils/authToken.ts`), qui vérifie l’expiration du jeton gardé en mémoire (60 s de vie) et en redemande un à Clerk. Ne plus lire `clerkToken.value` directement pour un en-tête `Authorization`.
  - Navigation : masquée sur tout hôte d’annonce, sous-domaine IndieHost **et** domaine personnalisé (`isListingHostname` dans `Nav.vue`).
  - Dépendances API : zod 4 et nodemailer 10 (voir « Stack technique »). `npm audit fix` tel quel est à éviter : il rétrograde Prisma et ajoute un `undici` vulnérable au front ; mettre à jour paquet par paquet.
  - Réservations annulées : `rebuildListingBookedDaysFromCalendarEvents` (`calendar.service.ts`) ignore les réservations dont `payment.cancellation.status` vaut `canceled`.
  - **Éditeur de page à la volée et thèmes** : conception, journal et décisions dans `docs/editeur-de-page.md`, à lire avant toute reprise. Trois thèmes validés (Maison, Rivage, Nocturne) dans `frontend/src/domain/listings/pageThemes.ts`, page à thème et mode édition dans `frontend/src/views/ListingHub/themed/`, polices auto-hébergées dans `frontend/public/assets/fonts/themes/`. La page principale publique (`_ListingHub.vue`) rend la page à thème, avec le thème d’office selon le lieu des logements (`suggestPageThemeId`). **Mode édition (2026-11-11)** : l’hôte modifie sa page dessus depuis `/dashboard/page/:listingId` (bouton « Modifier ma page » du panneau « Page de présentation » de l’éditeur), chaque modification est en ligne aussitôt. Les réglages vivent dans `core.page` (thème, accroche, lieu, sections), écrit **uniquement** par `PUT /listings/:listingId/page` (`backend/api/src/domains/listings/hubPage.ts` : schéma, texte brut, limites) et, une fois, par le pré-remplissage des sites (voir « Sites des hôtes et référencement ») ; la route générique de `core` le conserve tel quel. Types et limites en miroir côté site (`pageThemes.ts`, `hubPageContent.ts`) : toute évolution se fait des deux côtés. La route de développement `/dev/page-themes` fait tourner le vrai mode édition avec un enregistrement simulé. Section « Note Booking ou Airbnb » (type `rating`, 2026-11-11) : recopiée par l'hôte, logo officiel de la plateforme, mise en scène propre à chaque thème ; contrôle `npx tsx backend/api/scripts/hub-page-rating-smoke.ts`.
  - Stripe Connect, état `verifying` (`domains/payments/connectStatus.ts`) : inscription terminée, Stripe vérifie les pièces. Il compte comme prêt pour publier (`paymentsUnderReview` dans les deux calculs de `publicationReadiness`, à garder alignés : `payments.service.ts` et `listings.service.ts`), mais Stripe refuse les paiements jusqu’à la fin de sa vérification : `createPaymentIntent` répond alors 409 `HOST_PAYMENTS_NOT_READY`. L’état d’un compte pas encore complet est relu chez Stripe à chaque synchronisation (`refreshPendingConnectState`) ; aucun webhook `account.updated` n’est traité.
  - Lieu d’un logement : `resolvePlaceSetting` (`backend/api/src/domains/listings/placeSetting.ts`) classe chaque annonce « mer » (côte à moins de 10 km) ou « terres » d’après `core.latitude` / `core.longitude` et le tracé des côtes embarqué (`lib/coastline.ts`, paquet `world-atlas`), sans service extérieur. Renvoyé dans `GET /listings/:id/children` (`setting`). Contrôle : `npx tsx backend/api/scripts/place-setting-smoke.ts`.


- **E-mails automatiques aux hôtes via Brevo** : 14 e-mails (réservations, messages, avis, litiges, annonce en ligne, limite de l'offre, rappels planifiés), anti-doublon `HostNotification`, désinscription des rappels, migration `20261023000004_host_notifications`. Détail dans « E-mails automatiques (Brevo) ».

- **Thème sombre du tableau de bord et arrondis (2026-11-11)** : voir « Thème clair et thème sombre » et « Arrondis emboîtés » dans les conventions SCSS. Il n'existait pas de thème sombre pour le tableau de bord (seulement celui de l'accueil et un magasin `theme` que rien ne pilotait). Les deux plugins de pré-rendu (`frontend/plugins/*-prerender/`) ne s'exécutent plus quand le build a échoué : ils lisaient l'ancien `dist/index.html`, plantaient et leur message cachait la vraie erreur.

- **Réservations (2026-11-11)** :
  - Une période venue d'un calendrier importé (`bookings['external-booked-days']`, tenu par l'API à chaque synchronisation iCal) n'est **jamais** une réservation : `buildReservationsForListing` l'écarte, `buildImportedBlocksForListing` la liste à part (bloc « périodes bloquées par un calendrier importé » sous la fiche). Avant, chaque fermeture Booking devenait un « Voyageur N » avec un acompte inventé. Une date bloquée sans fiche (anciennes données) reste affichée, sans rien compter comme encaissé.
  - `normalizeReservation` / `normalizePayment` (`domain/listings/bookings.ts`) conservent `internalNote`, `payment.manual.entries` et `payment.cancellation` : ils étaient effacés à chaque lecture, donc jamais enregistrés. Tout champ ajouté à une réservation doit être repris dans ces deux fonctions.
  - Une page principale n'a pas de réservations : dans la colonne elle titre le groupe de ses logements (comme dans « Mes annonces »).
  - Fiche : en-tête, Message, Séjour (quatre lignes + calendrier), Paiements (résumé, une ligne par paiement, saisie manuelle repliée), Note interne, suppression discrète. Route de développement `/dev/management` (mêmes annonces en mémoire que `/dev/editor`).
  - Calendrier (`DatePicker`, aussi celui de la réservation publique) : le milieu d'une période est un bandeau avec le texte normal ; le fond plein de Nuxt UI recevait la couleur de texte globale (jours invisibles, dans les deux thèmes).
  - « Mes revenus » ouvre le tableau de bord Stripe de l'hôte dans un onglet créé au clic (`Nav.vue`). L'API accepte l'état `verifying` (`createConnectDashboardLink`) : il affichait le lien puis répondait 500.
  - Jeton `--tap-target` (`_layouts.scss`) : côté d'un contrôle carré ou hauteur d'une ligne cliquable, 44 px au moins au doigt.

- **Icônes SVG (2026-11-11)** : la règle globale de `styles/typography/_texts.scss` (police et couleur sur chaque élément) exclut `svg` et son contenu : une icône prend la couleur de son conteneur. Avant, toute icône recevait la couleur du texte, et une icône claire sur un rond foncé disparaissait. Sur une photo ou un fond noir fixe (`$dark`), une icône s'écrit en `$paper-static`, jamais en `$accent` (qui devient foncé en thème sombre).

- **Adresse publique d'une annonce (2026-11-11)** : le lien « Ouvrir l'annonce publique » de l'éditeur passe par `resolveListingPublicUrl` (`domain/api/listingDomains.ts`) : domaine relié et vérifié de l'annonce, sinon adresse de sa page principale suivie du nom du logement, sinon adresse gérée. L'API renvoie `publicUrl: null` pour une annonce sans sous-domaine, même quand elle a un domaine relié. Pour une page principale, le lien porte `?proprietaire=1` : la page publique affiche alors « Modifier ma page » en bas à droite (retenu pour l'onglet, retiré de l'adresse). Sur indiehost.fr, le bouton apparaît aussi pour le propriétaire connecté. Sur un domaine relié la session Clerk n'existe pas : le bouton y mène à `https://indiehost.fr/dashboard/page/:id`.
  - Fenêtre « Profil » de Clerk : `.cl-rootBox` reçoit la palette claire (`_theme.scss`) et sa largeur n'est plus forcée à 26rem (`_clerk.scss`, seulement les cartes sans `.cl-navbar`). En thème sombre ses textes devenaient clairs sur fond blanc, et forcée étroite elle était rognée.

- **Mes revenus (2026-11-11)** : page `/dashboard/revenues` (`views/Revenues/`), alimentée par `GET /payments/stripe/connect/overview` (`getConnectOverview`) : état du compte d'encaissement, solde et cinq derniers virements lus sur le compte connecté (`{ stripeAccount }`), encaissé sur 30 jours et sur l'année et vingt derniers paiements depuis la table `Payment` (nets des remboursements). Si Stripe ne répond pas, `stripeAvailable` vaut faux et la page affiche quand même les paiements connus. Le bouton « Ouvrir mon tableau de bord Stripe » passe par `domain/payments/stripeDashboard.ts`. La navigation ne prépare plus de lien Stripe. Route d'essai `/dev/revenues?state=verifying|none|empty|offline`.
  - État du compte connecté : un compte pas encore complet est relu chez Stripe au plus une fois par minute, à chaque lecture de l'état d'abonnement, de la synthèse ou du lien vers le tableau de bord (`refreshPendingConnectState`). Avant, il n'était relu que sur une synchronisation demandée : un compte validé par Stripe restait « en vérification » chez IndieHost.

- **Chargement du tableau de bord (2026-11-11)** : l'écran de chargement (`useBootLoader.ts`) se réarme à chaque passage d'un écran du tableau de bord à un autre (nom de route différent) et attend, en plus du silence de l'API, que la page ne reçoive plus d'éléments (`MutationObserver` sur `#app > main`). Plafond de 3 s pour un changement d'écran, 5 s au chargement de la page.

- **Téléphone, deuxième étape (2026-11-11)** :
  - Tableau de bord bord à bord sous `lg` : mixin `dashboard-panel-radius` (`_layouts.scss`) pour le panneau principal d'un écran, plus de marge autour de la racine. Ne pas remettre de cadre arrondi avec marge sur téléphone.
  - Fond du document en thème sombre : `$background` (règle `html[data-theme='dark'] body`), sinon `$secondary` devient clair autour des panneaux.
  - Écrans en hauteur fixe (`#management-page`, `#messaging-page`, `#create-listing-page`, `#listing-page` hors page principale) : le document est verrouillé (`overflow: hidden`, `overscroll-behavior: none`) par une règle `html:has(…)` de `_global.scss`. Tout nouvel écran de ce type s'y ajoute.
  - Page d'un logement en disposition téléphone (`.is-mobile-layout`) : écart entre sections `--layout-gap-4xl`, titres de section en `h3-title`, pièces deux par ligne. Calendrier de réservation (`BookingDates.vue`) : un mois sous `md`, fond plein, résumé des dates et bouton « Valider ». Route d'essai `/dev/listing`.
  - Vérifier le thème sombre dans un cadre `iframe` : poser `color-scheme: dark` sur l'élément `iframe`, sinon `prefers-color-scheme` y suit la page qui l'héberge.

- **Passe téléphone (2026-11-11, première étape)** : la racine vaut 15 px sous `md` (`styles/layouts/_global.scss`), comme sur ordinateur à la souris ; tablette tactile à 16 px. Conséquences à respecter : une zone tactile s'écrit `var(--tap-target)` (86 occurrences de `2.75rem` remplacées) et un champ garde `font-size: max(1rem, 16px)` sous `(pointer: coarse)`. Retouches propres au téléphone : photo des cartes « Mes annonces » en 16/10 (carrée à partir de `sm`), sous-titre de l'annonce publique à la taille d'un intertitre et caractéristiques sans coupure au milieu d'un élément (`Title.vue`), libellés de la barre du bas à 0.7rem et « Ajouter » sur une ligne. Vérification à 360 et 390 px : cadre `iframe` de même origine dans Chrome (une page locale pour les routes `/dev/*`, la production avec la feuille de style injectée pour les écrans à session).
  - Serveur de développement sous Docker : `plugins/file-path-comment` ignore les fichiers `.d.ts` générés. Il réécrivait `components.d.ts` en boucle contre son générateur, et une lecture pendant une écriture arrêtait Vite (`ENODATA`).

- **Éditeur, deuxième passe UX (2026-11-11, audit de la production)** :
  - **Sections repliables** : chaque section d'un groupe est une ligne (nom, résumé d'une ligne, « À compléter ») qui s'ouvre sur son panneau, une seule à la fois. Les puces de sections et le suivi du défilement ont disparu. `EditorSection.vue` rend la ligne et ne monte le panneau qu'à sa première ouverture ; l'état et les résumés viennent de `EditorSidebar.vue` par `provide` (`EDITOR_SECTIONS_KEY`). Résumés dans `computeEditorSectionSummaries` (`editorSections.ts`, d'après le brouillon seul). Une nouvelle section = une entrée dans le registre, un résumé, un `EditorSection`.
  - **En-tête de colonne** : nom de l'annonce et sa place (« Logement de la page … », « Page principale · présente N logements », « Logement indépendant »). Pour une page principale, bouton « Modifier la page » (mode édition sur la page) toujours visible ; la section « Page » repliée a été supprimée.
  - **« Mes annonces »** : une page principale est un bandeau (`EditorSiteHeader.vue` : vignette, nom, état, « Aperçu », « Modifier la page ») suivi de ses logements, en retrait derrière un filet, et d'une barre « Ajouter un logement à cette page ». Pas de boîte autour du groupe (voir « Arrondis emboîtés ») ; les autres annonces sont sous « Logements indépendants ». Regroupement côté site d'après `UserListingCard.parentListingId`. Route du mode édition : `views/Editor/utils/pageEditorRoute.ts`.
  - **Logements d'une page** : le panneau « Logements » de la page principale (groupe Essentiel) ajoute ou retire un logement d'un clic (`HubChildrenPanel.vue`, `attachableListings`).
  - **Contrôles communs** dans `panels/panel.scss` : `%panel-option` (choix avec bouton radio du design system), `%panel-select`, `%panel-action`, `%panel-add`. Ne plus dessiner ces contrôles panneau par panneau.
  - **Photos** : la copie de l'annonce gardée dans le navigateur perd ses photos en data URL ; `useEditorDraftLifecycle.ts` prend désormais la galerie du serveur dès que la copie locale a moins de photos (sinon l'éditeur affichait 0 photo et « Appliquer » aurait vidé la galerie en ligne).
  - Le profil de l'hôte (statut particulier / professionnel) est passé à la colonne par `_Editor.vue` (`previewRawListing.host`) : le panneau « Légal » est prérempli et son résumé est juste.

- **Barre latérale de l'éditeur, première passe UX** (audit du 2026-10-23, suite dans `TODO.md`) :
  - Sommaire à deux niveaux à la place des trois onglets : cinq groupes (Essentiel, Tarifs, Guide d'arrivée, Adresses, Réglages) puis les sections du groupe en puces défilantes, avec pastille « à compléter » calculée depuis le brouillon. Registre unique dans `components/EditorSidebar/editorSections.ts` (ordre d'affichage, libellés `editor.sidebar.groups/sections`, règles de complétude) ; chaque panneau est enveloppé dans `EditorSection.vue` (`data-section`), ce qui permet le défilement vers une section et le suivi de la section visible (`EditorSidebar.vue`). Une nouvelle section = une entrée dans le registre + un `EditorSection` dans le conteneur du groupe (`ListingPanels.vue` rend essentiel / adresses / réglages selon sa prop `group`).
  - Bandeau d'état permanent en tête de colonne : « Enregistrement du brouillon… » / « Modifications non appliquées » + heure du dernier enregistrement (`lastSavedAt` exposé par `useEditorPatchQueue`) / « Version en ligne à jour », avec les boutons Annuler et Appliquer toujours visibles (le pied flottant a disparu).
  - Aide repliée : `panels/PanelHeader.vue` (titre, résumé d'une ligne, explication longue derrière ⓘ) ; utilisé par le panneau sous-domaine, le guide du domaine personnalisé ne s'ouvre plus tout seul.
  - **Route de développement `/dev/editor`** (enregistrée seulement en `import.meta.env.DEV`, `views/Editor/dev/`) : l'éditeur sur deux annonces en mémoire, sans compte ni API, pour vérifier l'interface dans le navigateur (`cd frontend && npm run dev`, puis `http://127.0.0.1:5179/dev/editor?listingId=dev-apartment`). Les panneaux qui appellent l'API (domaines, iCal, import, légal) affichent leur état d'erreur, c'est attendu.

- **Passe « TODO » du 2026-10-23** (détail dans `TODO.md`, section « Fait ») :
  - Front : titres de page par route (`meta.title`, entrée unhead patchée dans `router.afterEach`), `lang="fr"` restauré en quittant la landing, notes d'avis lisibles (`.sr-only` global), alt distincts de la landing, noms accessibles de la galerie et des vidéos, composant `Landing/components/LandingVideo/LandingVideo.vue` (bouton lecture/pause, pas d'autoplay en `prefers-reduced-motion`), pied de page sombre (`html.landing-theme-dark`), champ « Description de la photo » (éditeur + assistant, repli « <titre> — photo N », légendes Airbnb/Booking reprises), règlement intérieur avant paiement (`Checkout.vue` étape 4, section `Core/components/HouseRules`), statut de l'hôte particulier/professionnel + n° d'enregistrement meublé de tourisme (`LegalInfoPanel.vue`, `host.legalStatus`, `core.tourismRegistrationNumber`), liens légaux compacts (`components/layouts/LegalLinksCompact.vue`) sur annonce, page principale, guide et confirmation, e-mail obligatoire au checkout (`contact.email`).
  - Appels API du tableau de bord dédoublonnés : `domain/api/requestCache.ts` (`sharedRequest`, promesse partagée + TTL court + invalidation par les mutations, cache vidé au changement d'utilisateur Clerk) et `domain/api/listingsCache.ts`. Toute nouvelle mutation doit invalider les clés concernées.
  - Pré-rendu statique de `/` et `/pricing` au build (`frontend/plugins/marketing-prerender/`, après `legalPrerender()` dans `vite.config.ts`) : contenu sémantique injecté dans `#app` depuis `locales/landing/fr.json` et `pricingPlanCatalog.ts`, JSON-LD `FAQPage` / `Product`, remplacé par Vue au montage.
  - Barèmes d'annulation : un seul module miroir par côté (`frontend/src/domain/listings/cancellationPolicy.ts` ↔ `backend/api/src/domains/bookings/cancellationPolicy.ts`), consommé par l'éditeur, le checkout, la confirmation, l'API et les e-mails.
  - Avis voyageur depuis le guide : `GET/POST /listings/guides/:guideKey/review` (clé de guide, un avis par réservation, après la première nuit) ; helper partagé `lib/guideKey.ts`.
  - Nom public de l'hôte : plus jamais tiré de l'e-mail (prénom, nom, pseudo, sinon « Votre hôte ») ; plus de libellé « Host ».
  - Métadonnées Stripe sans nombre de voyageurs PMR (donnée de santé).
  - Backend : voir les nouvelles lignes de « Sécurité » (nettoyage HTML à l'écriture, réservation atomique, limites de débit, CSP, RGPD) et « Déploiement » (webhooks Stripe et Clerk, e-mails SMTP, TXT des domaines personnalisés). Quatre migrations Prisma ajoutées (`20261023000000` à `20261023000003`).

- **Écran de chargement du tableau de bord** (`components/layouts/BootLoader.vue`, `composables/useBootLoader.ts`) : actif seulement quand la page chargée est sous `/dashboard`, il reste jusqu'à ce que la route soit résolue, Clerk chargé et l'API silencieuse 220 ms (intercepteurs axios, plafond 5 s), puis le contenu monte d'un bloc. Un script en ligne de `index.html` pose `html.is-booting` avant le premier affichage : à garder (et à autoriser par hash si une CSP `script-src` est ajoutée). Une nouvelle vue du tableau de bord qui appelle l'API autrement qu'avec axios ne sera pas attendue.

- **Pages légales, traceurs, remboursements** (`94d6974`) :
  - **Pages légales** : documents dans `frontend/src/views/Legal/` (registre `legalPages.json`, un fragment HTML par document dans `content/`), route `/legal/:page`, pré-rendus en HTML statique au build (`frontend/plugins/legal-prerender/`).
  - **Traceurs** : aucun avant consentement (pas de GTM ni GA4 ; hCaptcha et Stripe.js chargés seulement à la demande), donc pas de bandeau cookies. La carte de l'annonce publique est OpenFreeMap + MapLibre (sans cookie, affichée d'emblée, voir « Page d'un logement sur téléphone ») ; Google Maps ne reste que dans les panneaux « Localisation » de l'éditeur et de l'assistant (voir `TODO.md`). Toute nouvelle balise tierce doit garder cette règle ou ajouter un consentement.
  - **Remboursements voyageurs** : seulement si l'hôte active `bookings.pricing.cancellation.refundsEnabled` (désactivé par défaut, sinon réservation non remboursable). Une annulation par l'hôte (`POST /bookings/:id/host-cancel`) rembourse intégralement. Les remboursements sont débités du compte Stripe de l'hôte (paiement direct, voir « Paiements des réservations »).
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
