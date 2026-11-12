// Adresse e-mail des comptes, lue chez Clerk.
//
// Le jeton de session Clerk ne contient pas l'e-mail : c'est le réglage par défaut de Clerk, et rien
// n'y est ajouté sur l'instance de production (vérifié le 2026-11-12). `upsertUserFromAuth` ne
// recevait donc jamais d'adresse : `User.email` restait vide, et aucun e-mail aux hôtes ne partait
// (`canEmailHost`), ni les rappels planifiés (qui ne retiennent que les comptes avec une adresse).
//
// `User.email` sert désormais de copie de l'adresse principale chez Clerk :
// - complétée quand elle manque, à la visite d'un compte (`upsertUserFromAuth`, sans attendre) et au
//   début de chaque passage des rappels (`backfillMissingUserEmails`) ;
// - relue juste avant un e-mail à un hôte, au plus une fois par heure et par compte, et remplacée si
//   l'hôte a changé d'adresse chez Clerk (`resolveEmailForSending`) ; Clerk injoignable : la copie sert.
// Ces écritures ne touchent pas `updatedAt`, qui mesure l'inactivité d'un compte pour la purge RGPD
// (`jobs/retention.ts`). L'adresse n'est jamais montrée aux voyageurs : seul ce que l'hôte saisit
// dans son annonce l'est.

import type { PrismaClient } from '@prisma/client';

import { fetchClerkUserById, type ClerkUserProfile } from '../../lib/clerkUsers.js';

/** Après un échec, pas de nouvel essai automatique avant ce délai (un envoi, lui, réessaie toujours). */
const FAILURE_RETRY_MS = 10 * 60 * 1000;
/** Avant un envoi, l'adresse est relue chez Clerk au plus une fois par heure et par compte. */
const VERIFIED_FOR_MS = 60 * 60 * 1000;
const CLERK_TIMEOUT_MS = 5000;

const failedAt = new Map<string, number>();
const verifiedAt = new Map<string, number>();
const inFlight = new Map<string, Promise<ClerkUserProfile | null>>();

export type UserEmailTarget = {
  id: string;
  clerkUserId: string | null;
  email: string | null;
  deletedAt?: Date | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Une seule lecture à la fois par compte ; abandonnée au bout de `CLERK_TIMEOUT_MS`. */
function readClerkProfile(clerkUserId: string): Promise<ClerkUserProfile | null> {
  const pending = inFlight.get(clerkUserId);
  if (pending) return pending;
  const request = fetchClerkUserById(clerkUserId, { timeoutMs: CLERK_TIMEOUT_MS })
    .catch(() => null)
    .finally(() => inFlight.delete(clerkUserId));
  inFlight.set(clerkUserId, request);
  return request;
}

/** Adresse complétée (sans en écraser une arrivée entre-temps), prénom et nom repris s'ils manquent. */
async function fillEmail(prisma: PrismaClient, userId: string, profile: ClerkUserProfile, email: string): Promise<void> {
  // SQL direct : Prisma mettrait `updatedAt` à jour, et la purge RGPD lit l'inactivité d'un compte dans cette colonne.
  await prisma.$executeRaw`
    UPDATE "User"
    SET "email" = ${email},
        "firstName" = COALESCE(NULLIF("firstName", ''), ${clean(profile.firstName)}),
        "lastName" = COALESCE(NULLIF("lastName", ''), ${clean(profile.lastName)})
    WHERE "id" = ${userId} AND "deletedAt" IS NULL AND ("email" IS NULL OR "email" = '')`;
}

async function replaceEmail(prisma: PrismaClient, userId: string, email: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "User" SET "email" = ${email}
    WHERE "id" = ${userId} AND "deletedAt" IS NULL AND "email" IS DISTINCT FROM ${email}`;
}

/**
 * Adresse du compte : celle en base, sinon l'adresse principale chez Clerk, enregistrée au passage.
 * Null si le compte est clos, n'est pas un compte Clerk, ou si Clerk n'a pas répondu (nouvel essai
 * automatique après `FAILURE_RETRY_MS`).
 */
export async function ensureUserEmail(prisma: PrismaClient, user: UserEmailTarget): Promise<string | null> {
  const known = clean(user.email);
  if (known) return known;
  const clerkUserId = clean(user.clerkUserId);
  if (!clerkUserId || user.deletedAt) return null;
  if (Date.now() - (failedAt.get(user.id) ?? 0) < FAILURE_RETRY_MS) return null;
  return fetchAndStore(prisma, user, clerkUserId, null);
}

/**
 * Adresse à utiliser pour un e-mail à un hôte : relue chez Clerk si elle n'a pas été vérifiée depuis
 * une heure (et remplacée si elle a changé), sinon celle en base. Aucun délai après un échec : un
 * e-mail d'événement (réservation, annulation…) n'est jamais renvoyé plus tard.
 */
export async function resolveEmailForSending(prisma: PrismaClient, user: UserEmailTarget): Promise<string | null> {
  const known = clean(user.email);
  const clerkUserId = clean(user.clerkUserId);
  if (!clerkUserId || user.deletedAt) return user.deletedAt ? null : known;
  if (known && Date.now() - (verifiedAt.get(user.id) ?? 0) < VERIFIED_FOR_MS) return known;
  return (await fetchAndStore(prisma, user, clerkUserId, known)) ?? known;
}

async function fetchAndStore(prisma: PrismaClient, user: UserEmailTarget, clerkUserId: string, known: string | null): Promise<string | null> {
  const profile = await readClerkProfile(clerkUserId);
  const email = clean(profile?.email);
  if (!profile || !email) {
    failedAt.set(user.id, Date.now());
    return null;
  }
  failedAt.delete(user.id);
  verifiedAt.set(user.id, Date.now());
  if (email === known) return email;
  try {
    if (known) await replaceEmail(prisma, user.id, email);
    else await fillEmail(prisma, user.id, profile, email);
  } catch (error) {
    console.warn('[users] e-mail du compte non enregistré', { userId: user.id, error });
  }
  return email;
}

export const MISSING_EMAIL_WHERE = { deletedAt: null, clerkUserId: { not: null }, OR: [{ email: null }, { email: '' }] };

/**
 * Complète les comptes sans adresse (rappels planifiés : sans adresse, un compte n'est pas retenu).
 * Renvoie le nombre de comptes complétés.
 */
export async function backfillMissingUserEmails(prisma: PrismaClient, options: { limit: number }): Promise<number> {
  const users = await prisma.user.findMany({
    where: MISSING_EMAIL_WHERE,
    select: { id: true, clerkUserId: true, email: true, deletedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: options.limit,
  });
  let filled = 0;
  for (const user of users) {
    if (await ensureUserEmail(prisma, user)) filled += 1;
  }
  return filled;
}

/** Pour les contrôles (`scripts/user-email-smoke.ts`) : oublie les lectures et les échecs récents. */
export function resetUserEmailAttempts(): void {
  failedAt.clear();
  verifiedAt.clear();
  inFlight.clear();
}
