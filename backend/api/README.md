# IndieHost API (NestJS)

Backend REST API en **NestJS + Prisma + PostgreSQL** alignée avec le frontend Vue existant.

## Domaines couverts

- `users`
- `listings` (ressources séparées: `core`, `bookings`, `medias`, `arrival`, `notes`, `comments`, `host`)
- `bookings` / `reservations`
- `messaging` (hôte + voyageur non inscrit via `guestIdentifier`)
- `payments` (Stripe Connect, payment intents)
- `calendar` (export/import iCal)

## Endpoints frontend déjà compatibles

- `GET /v1/user/:userId/listings`
- `POST /v1/listings`
- `GET /v1/listings/core/:listingId`
- `PATCH /v1/listings/core/:listingId`
- `GET /v1/listings/bookings/:listingId`
- `PATCH /v1/listings/bookings/:listingId`
- `GET /v1/listings/medias/:listingId`
- `PATCH /v1/listings/medias/:listingId`
- `GET /v1/listings/arrival/:listingId`
- `PATCH /v1/listings/arrival/:listingId`
- `GET /v1/listings/notes/:listingId`
- `PATCH /v1/listings/notes/:listingId`
- `GET /v1/listings/comments/:listingId`
- `PATCH /v1/listings/comments/:listingId`
- `POST /v1/payments/stripe/payment-intents`

## Endpoints additionnels (MVP extensible)

- `GET/PATCH /v1/users/me`
- `GET/POST /v1/messaging/conversations`
- `GET/POST /v1/messaging/conversations/:conversationId/messages`
- `PATCH /v1/messaging/conversations/:conversationId/messages/:messageId/state`
- `GET /v1/calendar/listings/:listingId/ical`
- `GET /v1/calendar/listings/:listingId/events`
- `GET/POST /v1/calendar/listings/:listingId/syncs`
- `POST /v1/calendar/syncs/:syncId/pull`
- `POST /v1/payments/stripe/connect/accounts/:accountId/onboarding-link`
- `GET /v1/payments/stripe/connect/accounts/:accountId/status`

## Démarrage local

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run start:dev
```

API: `http://localhost:4000/v1`

## Docker

Le service `backend-api` est prêt dans `docker/docker-compose.yml`.

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Auth Clerk

- JWT Bearer validé via JWKS (`CLERK_JWKS_URL`, `CLERK_ISSUER`, `CLERK_AUDIENCE`)
- routes publiques: listing public, checkout, iCal export
- routes privées: édition listing, user listings, sync calendrier, profil user

## Message invité (sans compte)

Passer `x-guest-id` (ou `guestIdentifier` dans payload) pour identifier un voyageur non inscrit.
