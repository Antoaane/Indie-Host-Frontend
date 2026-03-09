# IndieHost API (Fastify + Prisma)

Backend REST TypeScript pour le frontend IndieHost.

## Stack

- Fastify (plugins modulaires)
- Prisma + PostgreSQL
- Clerk JWT (validation via JWKS)
- Stripe Connect (payment intents + onboarding)
- iCal import/export

## Démarrage local

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run dev
```

Serveur: `http://localhost:4000`

## Endpoints frontend compatibles

- `GET /v1/user/:userId/listings`
- `GET /v1/listings/:resource/:listingId`
- `PATCH /v1/listings/:resource/:listingId`
- `POST /v1/listings`
- `POST /v1/payments/stripe/payment-intents`
- `GET /v1/payments/stripe/subscriptions/plans`
- `GET /v1/payments/stripe/subscriptions/me`
- `POST /v1/payments/stripe/subscriptions/activate`
- `POST /v1/payments/stripe/subscriptions/checkout/confirm`

## Domaines supplémentaires

- `bookings`
- `medias`
- `arrival`
- `messaging`
- `users`
- `payments`
- `calendar` (inclut `GET /v1/calendar/listings/:listingId.ics`)

## Docker

Le `Dockerfile` lance:

```bash
npm run start:docker
```

Ce script fait:

1. `prisma generate`
2. `prisma db push`
3. démarrage serveur

## Auth Clerk

- Les routes privées utilisent `fastify.authenticate`.
- Le token JWT doit être envoyé en `Authorization: Bearer <token>`.
- Variables requises pour validation réelle: `CLERK_JWKS_URL`, `CLERK_ISSUER`.
