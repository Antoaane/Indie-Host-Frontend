// File: src/views/Admin/dev/devAdminData.ts

// Données inventées pour la route de développement `/dev/admin` : aucun compte, aucune API.
// `?etat=panne` simule une panne de la base et un calendrier en erreur.

import type {
  AdminOverview,
  AdminPayments,
  AdminUserAccess,
  FloorplanTicket,
  HealthBucket,
  ServiceHealth,
  ServiceId,
  ServiceStatus,
  SystemHealth,
} from '@/domain/api/admin'
import type { AdminUserOverview } from '@/domain/api/users'
import type { AdminDataSource } from '@/views/Admin/adminDataSource'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

function wait<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms))
}

// --- Santé des services --------------------------------------------------------------------

type ServiceSeed = {
  id: ServiceId
  group: ServiceHealth['group']
  label: string
  role: string
  everyMs: number
  status: ServiceStatus
  latencyMs: number | null
  summary: string
  facts?: ServiceHealth['facts']
  /** Demi-heures (en partant de la fin) où le service a eu un souci. */
  incidents?: Array<{ index: number; status: ServiceStatus }>
}

function buildHistory(seed: ServiceSeed): HealthBucket[] {
  const end = Math.ceil(Date.now() / (30 * MINUTE)) * 30 * MINUTE
  const start = end - DAY
  return Array.from({ length: 48 }, (_, index) => {
    // Le suivi a démarré il y a 20 heures (dernier déploiement) : rien avant.
    const isBeforeStart = index < 8
    const special = seed.incidents?.find((entry) => entry.index === index)
    const status: HealthBucket['status'] = isBeforeStart
      ? 'none'
      : special?.status ?? (seed.status === 'disabled' ? 'disabled' : index === 47 ? seed.status : 'up')
    return {
      startISO: new Date(start + index * 30 * MINUTE).toISOString(),
      status,
      samples: status === 'none' ? 0 : 60,
      avgLatencyMs: status === 'none' || seed.latencyMs === null ? null : Math.round(seed.latencyMs * (0.8 + ((index * 7) % 5) / 10)),
    }
  })
}

function uptimeOf(history: HealthBucket[]): number | null {
  const tracked = history.filter((bucket) => bucket.status === 'up' || bucket.status === 'degraded' || bucket.status === 'down')
  if (!tracked.length) return null
  return tracked.filter((bucket) => bucket.status !== 'down').length / tracked.length
}

function serviceSeeds(outage: boolean): ServiceSeed[] {
  return [
    { id: 'public', group: 'entry', label: 'Accès public', role: 'L’adresse indiehost.fr vue depuis Internet, à travers Cloudflare.', everyMs: 2 * MINUTE, status: 'up', latencyMs: 182, summary: 'Accessible depuis Internet en 182 ms.', facts: [{ label: 'Adresse contrôlée', value: 'https://indiehost.fr/api/health' }] },
    { id: 'proxy', group: 'entry', label: 'Aiguillage (nginx)', role: 'Reçoit chaque visite et l’envoie vers le site ou le serveur.', everyMs: 30_000, status: 'up', latencyMs: 2, summary: 'Aiguille les visites en 2 ms.' },
    {
      id: 'certificates',
      group: 'entry',
      label: 'Certificats HTTPS',
      role: 'Le cadenas du navigateur, pour indiehost.fr et les domaines des hôtes.',
      everyMs: 30 * MINUTE,
      status: 'degraded',
      latencyMs: null,
      summary: 'Un certificat expire bientôt ou manque encore.',
      facts: [
        { label: 'indiehost.fr et ses sous-domaines', value: 'Valide jusqu’au 9 févr. 2027 (88 j)', tone: 'good' },
        { label: 'gite-du-moulin.fr', value: 'Valide jusqu’au 21 nov. 2026 (9 j)', tone: 'warn' },
      ],
    },
    { id: 'site', group: 'core', label: 'Site', role: 'Les pages : accueil, logements, réservation, tableau de bord.', everyMs: 30_000, status: 'up', latencyMs: 3, summary: 'Pages servies en 3 ms.' },
    {
      id: 'api',
      group: 'core',
      label: 'Serveur',
      role: 'Le cœur d’IndieHost : annonces, réservations, paiements, e-mails.',
      everyMs: 30_000,
      status: 'up',
      latencyMs: null,
      summary: 'Répond normalement.',
      facts: [
        { label: 'En service depuis', value: '20 h 12' },
        { label: 'Mémoire utilisée', value: '182,4 Mo' },
        { label: 'Version de Node', value: 'v20.20.2' },
        { label: 'Plus long temps d’attente', value: '24 ms', tone: 'good' },
      ],
    },
    outage
      ? { id: 'database', group: 'data', label: 'Base de données', role: 'Garde comptes, annonces, réservations, paiements et messages.', everyMs: 30_000, status: 'down', latencyMs: null, summary: 'La base ne répond pas (connexion refusée, le service ne tourne pas).', incidents: [{ index: 47, status: 'down' }, { index: 46, status: 'down' }] }
      : { id: 'database', group: 'data', label: 'Base de données', role: 'Garde comptes, annonces, réservations, paiements et messages.', everyMs: 30_000, status: 'up', latencyMs: 1, summary: 'Répond en 1 ms.', facts: [{ label: 'Taille', value: '24,8 Mo' }, { label: 'Connexions ouvertes', value: '6' }], incidents: [{ index: 31, status: 'down' }] },
    { id: 'scraping', group: 'data', label: 'Robot d’import', role: 'Lit une annonce Airbnb ou Booking pour la reprendre.', everyMs: MINUTE, status: 'up', latencyMs: 41, summary: 'Prêt à importer (41 ms).' },
    {
      id: 'jobs',
      group: 'data',
      label: 'Tâches planifiées',
      role: 'Rappels aux hôtes et purge des données anciennes, à heure fixe.',
      everyMs: MINUTE,
      status: 'up',
      latencyMs: null,
      summary: 'Les tâches passent à l’heure.',
      facts: [
        { label: 'Purge des données anciennes', value: 'dernier passage à 03:12 (1,4 s) · prochain à 03:12', tone: 'good' },
        { label: 'Rappels par e-mail aux hôtes', value: 'dernier passage à 14:02 (2,1 s) · prochain à 15:02', tone: 'good' },
      ],
    },
    {
      id: 'calendars',
      group: 'data',
      label: 'Calendriers iCal',
      role: 'Les dates prises sur Airbnb et Booking, bloquées sur IndieHost.',
      everyMs: 2 * MINUTE,
      status: outage ? 'degraded' : 'up',
      latencyMs: null,
      summary: outage ? 'Un calendrier est en erreur.' : 'Tous les calendriers se synchronisent.',
      facts: outage
        ? [{ label: 'Calendriers importés', value: '7' }, { label: 'Booking · Gîte du Moulin', value: 'Ce calendrier est arrivé vide alors que des dates à venir étaient fermées.', tone: 'bad' }]
        : [{ label: 'Calendriers importés', value: '7' }, { label: 'Dernière synchronisation', value: 'il y a 12 min' }],
    },
    { id: 'stripe', group: 'external', label: 'Stripe', role: 'Paiement des réservations et abonnements des hôtes.', everyMs: 5 * MINUTE, status: 'up', latencyMs: 214, summary: 'Répond en 214 ms.', facts: [{ label: 'Mode', value: 'Réel (live)' }, { label: 'Nouvelles de Stripe (webhooks)', value: 'Configurées pour le compte IndieHost et les comptes des hôtes', tone: 'good' }, { label: 'Dernière nouvelle reçue', value: 'il y a 2 h (payment_intent.succeeded)' }, { label: 'Solde IndieHost disponible', value: '312,00 €' }] },
    { id: 'clerk', group: 'external', label: 'Clerk', role: 'Comptes et connexion au tableau de bord.', everyMs: 5 * MINUTE, status: 'up', latencyMs: 96, summary: 'Répond en 96 ms.', facts: [{ label: 'Vérification des connexions', value: 'Fonctionne', tone: 'good' }, { label: 'Comptes', value: '14' }] },
    { id: 'email', group: 'external', label: 'E-mails (Brevo)', role: 'Confirmations, annulations et rappels envoyés automatiquement.', everyMs: 5 * MINUTE, status: 'up', latencyMs: 131, summary: 'Répond en 131 ms.', facts: [{ label: 'Expéditeur', value: 'IndieHost <no-reply@mail.indiehost.fr>' }, { label: 'E-mails aux hôtes sur 24 h', value: '9' }, { label: 'Envois restants (offre gratuite)', value: '288' }, { label: 'Envoyés sur 24 h', value: '12' }, { label: 'Délivrés sur 24 h', value: '12' }] },
    { id: 'imagekit', group: 'external', label: 'ImageKit', role: 'Stocke et affiche les photos et vidéos des annonces.', everyMs: 5 * MINUTE, status: 'up', latencyMs: 158, summary: 'Répond en 158 ms.', facts: [{ label: 'Photos et vidéos', value: 'Envoi et affichage possibles' }] },
    { id: 'maps', group: 'external', label: 'Cartes', role: 'Le fond de carte des pages de logement (OpenFreeMap).', everyMs: 10 * MINUTE, status: 'up', latencyMs: 87, summary: 'Répond en 87 ms.' },
  ]
}

// Services extérieurs : mesurés toutes les 5 min, leur dernière mesure ne bouge pas d'une lecture à l'autre.
const externalCheckedAtISO = iso(-2 * MINUTE)

export function buildDevHealth(outage: boolean): SystemHealth {
  const services: ServiceHealth[] = serviceSeeds(outage).map((seed) => {
    const history = buildHistory(seed)
    return {
      id: seed.id,
      group: seed.group,
      label: seed.label,
      role: seed.role,
      status: seed.status,
      latencyMs: seed.latencyMs,
      summary: seed.summary,
      facts: seed.facts ?? [],
      // Les services du serveur sont remesurés à chaque lecture : leur pastille clignote une fois.
      checkedAtISO: seed.everyMs <= MINUTE ? iso(-4000) : externalCheckedAtISO,
      everyMs: seed.everyMs,
      uptime24h: uptimeOf(history),
      history,
    }
  })
  const count = (status: ServiceStatus) => services.filter((service) => service.status === status).length
  return {
    generatedAtISO: new Date().toISOString(),
    monitoringSinceISO: iso(-20 * HOUR),
    environment: 'production',
    overall: {
      status: count('down') ? 'down' : count('degraded') ? 'degraded' : 'up',
      up: count('up'),
      degraded: count('degraded'),
      down: count('down'),
      disabled: count('disabled'),
    },
    services,
    incidents: [
      ...(outage ? [{ atISO: iso(-52 * MINUTE), serviceId: 'database' as const, label: 'Base de données', from: 'up' as const, to: 'down' as const, summary: 'La base ne répond pas (connexion refusée, le service ne tourne pas).' }] : []),
      { atISO: iso(-3 * HOUR), serviceId: 'certificates', label: 'Certificats HTTPS', from: 'up', to: 'degraded', summary: 'Un certificat expire bientôt ou manque encore.' },
      { atISO: iso(-8 * HOUR + 4 * MINUTE), serviceId: 'database', label: 'Base de données', from: 'down', to: 'up', summary: 'Répond en 2 ms.' },
      { atISO: iso(-8 * HOUR), serviceId: 'database', label: 'Base de données', from: 'up', to: 'down', summary: 'La base ne répond pas (pas de réponse dans le délai).' },
    ],
    jobs: [],
  }
}

// --- Chiffres -----------------------------------------------------------------------------

export const devOverview: AdminOverview = {
  generatedAtISO: iso(0),
  subscribers: {
    source: 'stripe',
    paying: 9,
    trialing: 4,
    complimentary: 2,
    pastDue: 1,
    canceledLast30Days: 1,
    byPlan: { indiehost: 8, superhost: 6 },
    extraListings: 3,
    monthlyRevenueMinor: 52_900,
    currency: 'eur',
  },
  accounts: { total: 23, newLast30Days: 6, withPublishedListing: 12, clerkTotal: 26 },
  listings: { published: 27, paused: 2, drafts: 9, hubs: 4, customDomains: 3 },
  reservations: { last30Days: 18, upcoming: 11, collectedLast30DaysMinor: 1_284_350, currency: 'eur' },
  attention: [
    { id: 'past-due-1', tone: 'warn', title: 'Abonnement impayé', detail: 'Julien Moreau : Stripe retente le prélèvement ; sans paiement, l’abonnement s’arrête.', target: { tab: 'users', userId: 'usr_julien' } },
    { id: 'reservation-failures', tone: 'warn', title: '2 paiements de voyageurs refusés cette semaine', detail: 'Carte refusée ou 3-D Secure non validé : le voyageur n’a pas réservé.', target: { tab: 'payments' } },
    { id: 'service-certificates', tone: 'warn', title: 'Certificats HTTPS : à surveiller', detail: 'Un certificat expire bientôt ou manque encore.', target: { tab: 'services' } },
  ],
}

// --- Paiements ----------------------------------------------------------------------------

export const devPayments: AdminPayments = {
  generatedAtISO: iso(0),
  stripeAvailable: true,
  periodDays: 90,
  totals: { succeededCount: 21, succeededMinor: 1_342_150, failedCount: 3, refundedMinor: 42_000, disputedCount: 1, currency: 'eur' },
  rows: [
    { id: 'pi_dev_1', source: 'reservation', status: 'succeeded', amountMinor: 64_800, refundedMinor: 0, currency: 'eur', createdAtISO: iso(-2 * HOUR), title: 'Réservation · Gîte du Moulin', detail: 'Élise Bernard · du 20 déc. au 27 déc.', payer: 'Élise Bernard', account: { userId: 'usr_camille', label: 'Camille Durand' }, failureReason: null, stripeUrl: null },
    { id: 'pi_dev_2', source: 'subscription', status: 'failed', amountMinor: 4_900, refundedMinor: 0, currency: 'eur', createdAtISO: iso(-9 * HOUR), title: 'Abonnement SuperHost', detail: 'Renouvellement', payer: 'Julien Moreau', account: { userId: 'usr_julien', label: 'Julien Moreau' }, failureReason: 'Fonds insuffisants', stripeUrl: 'https://dashboard.stripe.com/payments/pi_dev_2' },
    { id: 'pi_dev_3', source: 'reservation', status: 'failed', amountMinor: 38_400, refundedMinor: 0, currency: 'eur', createdAtISO: iso(-26 * HOUR), title: 'Réservation · Appartement Les Voiles', detail: 'Marc Petit · du 3 janv. au 6 janv.', payer: 'Marc Petit', account: { userId: 'usr_sophie', label: 'Sophie Lefèvre' }, failureReason: 'Authentification 3-D Secure échouée', stripeUrl: null },
    { id: 'pi_dev_4', source: 'subscription', status: 'succeeded', amountMinor: 1_900, refundedMinor: 0, currency: 'eur', createdAtISO: iso(-2 * DAY), title: 'Abonnement IndieHost', detail: 'Premier paiement', payer: 'Thomas Petit', account: { userId: 'usr_thomas', label: 'Thomas Petit' }, failureReason: null, stripeUrl: 'https://dashboard.stripe.com/payments/pi_dev_4' },
    { id: 'pi_dev_5', source: 'reservation', status: 'refunded', amountMinor: 42_000, refundedMinor: 42_000, currency: 'eur', createdAtISO: iso(-4 * DAY), title: 'Réservation · Gîte du Moulin', detail: 'Laura Simon · du 14 nov. au 18 nov.', payer: 'Laura Simon', account: { userId: 'usr_camille', label: 'Camille Durand' }, failureReason: null, stripeUrl: null },
    { id: 'pi_dev_6', source: 'reservation', status: 'disputed', amountMinor: 27_500, refundedMinor: 0, currency: 'eur', createdAtISO: iso(-11 * DAY), title: 'Réservation · Studio du Port', detail: 'Kevin Roux · du 1 nov. au 3 nov.', payer: 'Kevin Roux', account: { userId: 'usr_sophie', label: 'Sophie Lefèvre' }, failureReason: null, stripeUrl: null },
    { id: 'pi_dev_7', source: 'subscription', status: 'succeeded', amountMinor: 6_100, refundedMinor: 0, currency: 'eur', createdAtISO: iso(-15 * DAY), title: 'Abonnement SuperHost', detail: 'Changement d’offre ou de logements', payer: 'Camille Durand', account: { userId: 'usr_camille', label: 'Camille Durand' }, failureReason: null, stripeUrl: 'https://dashboard.stripe.com/payments/pi_dev_7' },
    { id: 'pi_dev_8', source: 'subscription', status: 'failed', amountMinor: 1_900, refundedMinor: 0, currency: 'eur', createdAtISO: iso(-21 * DAY), title: 'Abonnement IndieHost', detail: 'Renouvellement', payer: 'Nadia Garcia', account: { userId: 'usr_nadia', label: 'Nadia Garcia' }, failureReason: 'Carte expirée', stripeUrl: 'https://dashboard.stripe.com/payments/pi_dev_8' },
  ],
}

// --- Utilisateurs -------------------------------------------------------------------------

function devUser(input: {
  id: string | null
  clerkUserId: string
  first: string
  last: string
  email: string
  plan: 'indiehost' | 'superhost' | null
  status: string | null
  complimentary?: boolean
  listings: [number, number]
  access?: Partial<AdminUserAccess>
  lastSignInDaysAgo?: number | null
}): AdminUserOverview {
  return {
    id: input.id,
    clerkUserId: input.clerkUserId,
    email: input.email,
    firstName: input.first,
    lastName: input.last,
    displayName: null,
    avatarUrl: null,
    createdAtISO: iso(-40 * DAY),
    billing: {
      planCode: input.plan,
      status: input.status,
      currentPeriodEndISO: input.status ? iso(18 * DAY) : null,
      includedListings: input.plan === 'superhost' ? 6 : input.plan === 'indiehost' ? 2 : 0,
      extraListings: 0,
      hasStripeCustomer: Boolean(input.status),
      complimentary: input.complimentary ?? false,
    },
    listings: { total: input.listings[1], active: input.listings[0] },
    access: { role: null, roleSource: null, banned: false, locked: false, known: true, ...input.access },
    lastSignInAtISO: input.lastSignInDaysAgo === null || input.lastSignInDaysAgo === undefined ? null : iso(-input.lastSignInDaysAgo * DAY),
  }
}

export const devUsers: AdminUserOverview[] = [
  devUser({ id: 'usr_admin', clerkUserId: 'user_devadmin01', first: 'IndieHost', last: 'Contact', email: 'contact@indiehost.fr', plan: null, status: null, listings: [0, 0], access: { role: 'super_admin', roleSource: 'config' }, lastSignInDaysAgo: 0 }),
  devUser({ id: 'usr_camille', clerkUserId: 'user_devcamille1', first: 'Camille', last: 'Durand', email: 'camille.durand@exemple.fr', plan: 'superhost', status: 'active', listings: [4, 5], lastSignInDaysAgo: 1 }),
  devUser({ id: 'usr_julien', clerkUserId: 'user_devjulien1', first: 'Julien', last: 'Moreau', email: 'julien.moreau@exemple.fr', plan: 'superhost', status: 'past_due', listings: [3, 3], lastSignInDaysAgo: 6 }),
  devUser({ id: 'usr_sophie', clerkUserId: 'user_devsophie1', first: 'Sophie', last: 'Lefèvre', email: 'sophie.lefevre@exemple.fr', plan: 'indiehost', status: 'trialing', listings: [2, 2], lastSignInDaysAgo: 2 }),
  devUser({ id: 'usr_thomas', clerkUserId: 'user_devthomas1', first: 'Thomas', last: 'Petit', email: 'thomas.petit@exemple.fr', plan: 'indiehost', status: 'active', listings: [1, 2], access: { role: 'admin', roleSource: 'clerk' }, lastSignInDaysAgo: 3 }),
  devUser({ id: 'usr_nadia', clerkUserId: 'user_devnadia1', first: 'Nadia', last: 'Garcia', email: 'nadia.garcia@exemple.fr', plan: 'indiehost', status: 'canceled', listings: [0, 1], lastSignInDaysAgo: 30 }),
  devUser({ id: 'usr_lucas', clerkUserId: 'user_devlucas1', first: 'Lucas', last: 'Fontaine', email: 'lucas.fontaine@exemple.fr', plan: 'superhost', status: null, complimentary: true, listings: [2, 2], lastSignInDaysAgo: 4 }),
  devUser({ id: null, clerkUserId: 'user_devines01', first: 'Inès', last: 'Robert', email: 'ines.robert@exemple.fr', plan: null, status: null, listings: [0, 0], lastSignInDaysAgo: null }),
  devUser({ id: 'usr_spam', clerkUserId: 'user_devspam01', first: 'Compte', last: 'Suspect', email: 'promo-vacances@exemple.fr', plan: null, status: null, listings: [0, 1], access: { banned: true }, lastSignInDaysAgo: 12 }),
]

// --- Source de données en mémoire ------------------------------------------------------------

// Jeton de développement non signé (refusé en production) : sert à ouvrir la vraie carte du
// code sur l'API locale, si elle tourne avec le code de l'administration.
function devAdminToken(): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: 'user_devadmin01', private_metadata: { role: 'admin' }, exp: 9_999_999_999 })}.`
}

async function openLocalFloorplan(): Promise<FloorplanTicket> {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/+$/, '')
  try {
    const response = await fetch(`${base}/admin/floorplan/ticket`, { method: 'POST', headers: { Authorization: `Bearer ${devAdminToken()}` } })
    if (!response.ok) throw new Error(String(response.status))
    const data = await response.json() as { available: boolean; updatedAtISO: string | null; sizeBytes: number | null; token: string | null }
    return { available: data.available, updatedAtISO: data.updatedAtISO, sizeBytes: data.sizeBytes, url: data.token ? `${base}/admin/floorplan/view?token=${encodeURIComponent(data.token)}` : null }
  } catch {
    return { available: false, updatedAtISO: null, sizeBytes: null, url: null }
  }
}

export function createDevAdminDataSource(options: { outage: boolean }): AdminDataSource {
  const users = structuredClone(devUsers)

  function updateAccess(clerkUserId: string, patch: Partial<AdminUserAccess>): AdminUserAccess {
    const user = users.find((entry) => entry.clerkUserId === clerkUserId)
    if (!user) throw new Error('Ce compte n’existe pas chez Clerk, ou Clerk ne répond pas.')
    user.access = { ...user.access, ...patch }
    return { ...user.access }
  }

  return {
    loadOverview: () => wait(devOverview, 500),
    loadPayments: () => wait(devPayments, 500),
    loadHealth: () => wait(buildDevHealth(options.outage), 250),
    refreshHealth: async () => ({ refreshed: true, snapshot: await wait(buildDevHealth(options.outage), 900) }),
    loadUsers: () => wait(users, 400),
    setUserRole: async (clerkUserId, role) => {
      await wait(null, 400)
      return updateAccess(clerkUserId, role === 'admin' ? { role: 'admin', roleSource: 'clerk' } : { role: null, roleSource: null })
    },
    setUserBlocked: async (clerkUserId, blocked) => {
      await wait(null, 400)
      return updateAccess(clerkUserId, { banned: blocked })
    },
    openFloorplan: openLocalFloorplan,
    healthPollMs: 15_000,
  }
}
