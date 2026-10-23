import { Prisma, type PrismaClient, type User } from '@prisma/client';

import { env } from '../../config/env.js';
import { hasAdminAccess } from '../../lib/authRole.js';
import { asObject } from '../../lib/json.js';
import { toPrismaJson } from '../../lib/prisma.js';
import type { RequestAuth } from '../../types/auth.js';
import { upsertUserFromAuth } from '../users/users.repository.js';
import {
  DELETED_MESSAGE_BODY,
  anonymizeReservations,
  buildAnonymizedListingData,
  buildAnonymizedStripeProfile,
  isReservationCanceled,
} from './anonymization.js';

const CLERK_API_BASE_URL = 'https://api.clerk.com/v1';

// Même liste que `payments.service.ts` : un abonnement dans l'un de ces états facture encore (ou va
// facturer) le compte, il doit être résilié avant la suppression. Le service de paiement n'est pas
// appelé : la décision se prend sur la copie `billing` de la ligne User, sans appel Stripe.
const ONGOING_SUBSCRIPTION_STATUSES = new Set(['trialing', 'active', 'past_due', 'unpaid', 'incomplete']);

const ANONYMIZATION_TRANSACTION_TIMEOUT_MS = 60_000;
const ANONYMIZATION_TRANSACTION_MAX_WAIT_MS = 10_000;

const SUPER_ADMIN_EMAILS = new Set(
  env.SUPER_ADMIN_EMAILS
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

export type DeletionBlocker = 'admin_account' | 'active_subscription' | 'upcoming_host_reservations' | 'upcoming_guest_reservations';

export const DELETION_BLOCKER_MESSAGES: Record<DeletionBlocker, string> = {
  admin_account: 'Un compte administrateur ne peut pas être supprimé depuis cette fenêtre.',
  active_subscription:
    'Votre abonnement est encore actif. Résiliez-le d’abord depuis « Mon abonnement » : la suppression du compte sera possible à la fin de la période en cours.',
  upcoming_host_reservations:
    'Une ou plusieurs réservations en cours ou à venir sont rattachées à vos annonces. Attendez la fin des séjours, ou annulez-les depuis « Mes réservations », avant de supprimer votre compte.',
  upcoming_guest_reservations:
    'Vous avez un séjour en cours ou à venir. La suppression du compte sera possible une fois le séjour terminé.',
};

export class PrivacyRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export type AnonymizationCounts = {
  listings: number;
  guestReservations: number;
  messages: number;
  payments: number;
  calendarSyncs: number;
};

export type AnonymizeUserResult =
  | { status: 'anonymized'; userId: string; clerkUserId: string | null; counts: AnonymizationCounts }
  | { status: 'already_deleted'; userId: string }
  | { status: 'not_found' };

export type ClerkDeletionOutcome = 'deleted' | 'skipped' | 'failed';

export type AccountDeletionResult = {
  userId: string;
  counts: AnonymizationCounts;
  clerk: ClerkDeletionOutcome;
};

export type ClerkUserDeletedResult = AnonymizeUserResult & {
  /** Un abonnement Stripe facturait encore ce compte : rien n'est annulé ici, l'admin doit agir. */
  subscriptionWarning: boolean;
};

type UserBillingSnapshot = {
  subscriptionId: string | null;
  status: string | null;
  complimentary: boolean;
};

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readUserBilling(user: Pick<User, 'stripeConnectProfile'>): UserBillingSnapshot {
  const billing = asObject(asObject(user.stripeConnectProfile).billing);
  return {
    subscriptionId: readString(billing.subscriptionId),
    status: readString(billing.status)?.toLowerCase() ?? null,
    complimentary: billing.complimentary === true,
  };
}

/** Abonnement Stripe réel encore en cours (un plan offert n'est pas facturé : il ne bloque pas). */
export function hasOngoingStripeSubscription(user: Pick<User, 'stripeConnectProfile'>): boolean {
  const billing = readUserBilling(user);
  return Boolean(billing.subscriptionId) && !billing.complimentary && Boolean(billing.status) && ONGOING_SUBSCRIPTION_STATUSES.has(billing.status as string);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && SUPER_ADMIN_EMAILS.has((email as string).trim().toLowerCase());
}

function readAuthEmail(auth: RequestAuth): string | null {
  const payload = auth.payload as Record<string, unknown>;
  return readString(payload.email) ?? readString(payload.email_address);
}

/** Suppression de l'identifiant Clerk (le login disparaît). 404 = déjà supprimé, considéré comme réussi. */
export async function deleteClerkUser(clerkUserId: string): Promise<ClerkDeletionOutcome> {
  const secret = env.CLERK_SECRET_KEY.trim();
  if (!secret) return 'skipped';

  try {
    const response = await fetch(`${CLERK_API_BASE_URL}/users/${encodeURIComponent(clerkUserId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    });
    if (response.ok || response.status === 404) return 'deleted';
    return 'failed';
  } catch {
    return 'failed';
  }
}

export class PrivacyService {
  constructor(private readonly prisma: PrismaClient) {}

  // ---------------------------------------------------------------------------------------------
  // Export (art. 15 et 20 RGPD)
  // ---------------------------------------------------------------------------------------------

  async exportUserData(auth: RequestAuth): Promise<Record<string, unknown> | null> {
    const user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;

    const listings = await this.prisma.listing.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    const listingIds = listings.map((listing) => listing.id);
    const guestReservationIds = await this.findGuestReservationIds(this.prisma, user.id);

    const [reservationsAsGuest, reservationsAsHost, conversations, messagesAuthored, payments, calendarSyncs, calendarEvents] =
      await Promise.all([
        this.prisma.reservation.findMany({
          where: { id: { in: guestReservationIds } },
          orderBy: { startDate: 'asc' },
        }),
        listingIds.length
          ? this.prisma.reservation.findMany({
              where: { listingId: { in: listingIds } },
              orderBy: { startDate: 'asc' },
            })
          : Promise.resolve([]),
        this.prisma.conversation.findMany({
          where: { OR: [{ hostUserId: user.id }, { guestUserId: user.id }] },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.message.findMany({
          where: { authorUserId: user.id },
          orderBy: { sentAt: 'asc' },
        }),
        this.prisma.payment.findMany({
          where: listingIds.length ? { OR: [{ userId: user.id }, { listingId: { in: listingIds } }] } : { userId: user.id },
          orderBy: { createdAt: 'asc' },
          // `rawRequest` / `rawResponse` : échanges bruts avec Stripe (dont le client_secret), jamais exportés.
          select: {
            id: true,
            listingId: true,
            reservationId: true,
            userId: true,
            stripePaymentIntentId: true,
            stripeConnectedAccountId: true,
            currency: true,
            amountMinor: true,
            status: true,
            paymentChoice: true,
            chargeNowAmountMinor: true,
            deferredAmountMinor: true,
            deferredMode: true,
            deferredDueDate: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        listingIds.length
          ? this.prisma.calendarSync.findMany({
              where: { listingId: { in: listingIds } },
              orderBy: { createdAt: 'asc' },
              // `rawIcs` : copie brute du flux OTA, détails des réservations d'autres plateformes.
              select: {
                id: true,
                listingId: true,
                name: true,
                sourceUrl: true,
                timezone: true,
                lastStatus: true,
                lastError: true,
                lastSyncedAt: true,
                createdAt: true,
                updatedAt: true,
              },
            })
          : Promise.resolve([]),
        listingIds.length
          ? this.prisma.calendarEvent.findMany({
              where: { listingId: { in: listingIds } },
              orderBy: { startDate: 'asc' },
            })
          : Promise.resolve([]),
      ]);

    return {
      format: 'indiehost-user-export',
      version: 1,
      generatedAt: new Date().toISOString(),
      user,
      listings,
      reservations: {
        asGuest: reservationsAsGuest,
        asHost: reservationsAsHost,
      },
      conversations,
      messagesAuthored,
      payments,
      calendarSyncs,
      calendarEvents,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Suppression de compte (art. 17 RGPD)
  // ---------------------------------------------------------------------------------------------

  /** Raisons qui empêchent la suppression d'un compte (utilisées par la route et par la purge). */
  async assessDeletionBlockers(user: User, options?: { now?: Date }): Promise<DeletionBlocker[]> {
    const now = options?.now ?? new Date();
    const blockers: DeletionBlocker[] = [];

    if (isSuperAdminEmail(user.email)) blockers.push('admin_account');
    if (hasOngoingStripeSubscription(user)) blockers.push('active_subscription');

    const hostReservations = await this.prisma.reservation.findMany({
      where: { listing: { ownerId: user.id }, endDate: { gte: now } },
      select: { payment: true },
    });
    if (hostReservations.some((reservation) => !isReservationCanceled(reservation.payment))) {
      blockers.push('upcoming_host_reservations');
    }

    const guestReservationIds = await this.findGuestReservationIds(this.prisma, user.id);
    if (guestReservationIds.length) {
      const guestReservations = await this.prisma.reservation.findMany({
        where: { id: { in: guestReservationIds }, endDate: { gte: now } },
        select: { payment: true },
      });
      if (guestReservations.some((reservation) => !isReservationCanceled(reservation.payment))) {
        blockers.push('upcoming_guest_reservations');
      }
    }

    return blockers;
  }

  async deleteAccount(auth: RequestAuth): Promise<AccountDeletionResult> {
    if (hasAdminAccess(auth) || isSuperAdminEmail(readAuthEmail(auth))) {
      throw new PrivacyRequestError(403, 'ADMIN_ACCOUNT_CANNOT_SELF_DELETE', DELETION_BLOCKER_MESSAGES.admin_account);
    }

    const user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) {
      throw new PrivacyRequestError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');
    }

    const blockers = await this.assessDeletionBlockers(user);
    if (blockers.length) {
      const [first] = blockers;
      const code = first === 'admin_account' ? 'ADMIN_ACCOUNT_CANNOT_SELF_DELETE' : 'ACCOUNT_DELETION_BLOCKED';
      throw new PrivacyRequestError(
        first === 'admin_account' ? 403 : 409,
        code,
        DELETION_BLOCKER_MESSAGES[first as DeletionBlocker],
        { blockers },
      );
    }

    const result = await this.anonymizeUser(user.id);
    if (result.status === 'not_found') {
      throw new PrivacyRequestError(404, 'USER_NOT_FOUND', 'Compte introuvable.');
    }

    const counts: AnonymizationCounts = result.status === 'anonymized'
      ? result.counts
      : { listings: 0, guestReservations: 0, messages: 0, payments: 0, calendarSyncs: 0 };

    // L'identifiant Clerk d'origine est lu avant anonymisation : la ligne porte désormais `deleted_<id>`.
    const clerkUserId = user.clerkUserId ?? auth.userId;
    const clerk = await deleteClerkUser(clerkUserId);

    return { userId: user.id, counts, clerk };
  }

  /**
   * Webhook Clerk `user.deleted` : le login a déjà disparu, on anonymise sans garde-fou. Un
   * abonnement encore actif n'est pas touché (aucun appel Stripe) : il est seulement signalé.
   */
  async handleClerkUserDeleted(clerkUserId: string): Promise<ClerkUserDeletedResult> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ clerkUserId }, { externalUserId: clerkUserId }] },
    });
    if (!user) return { status: 'not_found', subscriptionWarning: false };

    const subscriptionWarning = hasOngoingStripeSubscription(user);
    const result = await this.anonymizeUser(user.id);
    return { ...result, subscriptionWarning };
  }

  /**
   * Anonymisation complète et idempotente d'un compte (ligne User conservée, `deletedAt` posé) :
   * - annonces → `deleted`, données de l'hôte retirées, sources iCal supprimées ;
   * - réservations faites en tant que voyageur → voyageur anonymisé (ligne + copie JSON de l'annonce) ;
   * - messages écrits → corps remplacé par « [message supprimé] », conversations conservées ;
   * - paiements → échanges bruts Stripe effacés, montants et identifiants conservés (comptabilité) ;
   * - User → identité effacée, `clerkUserId` / `externalUserId` remplacés par `deleted_<id>`.
   */
  async anonymizeUser(userId: string): Promise<AnonymizeUserResult> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) return { status: 'not_found' as const };
      if (user.deletedAt) return { status: 'already_deleted' as const, userId: user.id };

      const listings = await tx.listing.findMany({
        where: { ownerId: user.id },
        select: { id: true, core: true },
      });
      const listingIds = listings.map((listing) => listing.id);

      for (const listing of listings) {
        await tx.listing.update({
          where: { id: listing.id },
          data: buildAnonymizedListingData(listing.core),
        });
      }

      let calendarSyncs = 0;
      if (listingIds.length) {
        // Les URL iCal sont des liens privés vers les calendriers OTA de l'hôte.
        await tx.calendarEvent.deleteMany({ where: { listingId: { in: listingIds }, calendarSyncId: { not: null } } });
        const deletedSyncs = await tx.calendarSync.deleteMany({ where: { listingId: { in: listingIds } } });
        calendarSyncs = deletedSyncs.count;
      }

      const guestReservationIds = await this.findGuestReservationIds(tx, user.id);
      const guestReservations = guestReservationIds.length
        ? await tx.reservation.findMany({
            where: { id: { in: guestReservationIds } },
            select: { id: true, listingId: true },
          })
        : [];
      const anonymizedReservations = await anonymizeReservations(tx, guestReservations);

      const messages = await tx.message.updateMany({
        where: { authorUserId: user.id, body: { not: DELETED_MESSAGE_BODY } },
        data: { body: DELETED_MESSAGE_BODY, metadata: Prisma.DbNull },
      });

      await tx.conversation.updateMany({
        where: { guestUserId: user.id },
        data: { subject: null },
      });

      const payments = await tx.payment.updateMany({
        where: { userId: user.id },
        data: { rawRequest: Prisma.DbNull, rawResponse: Prisma.DbNull },
      });

      const deletedIdentifier = `deleted_${user.id}`;
      await tx.user.update({
        where: { id: user.id },
        data: {
          clerkUserId: deletedIdentifier,
          externalUserId: deletedIdentifier,
          email: null,
          firstName: null,
          lastName: null,
          displayName: null,
          avatarUrl: null,
          hostProfile: Prisma.DbNull,
          stripeConnectProfile: toPrismaJson(buildAnonymizedStripeProfile(user.stripeConnectProfile)),
          deletedAt: new Date(),
        },
      });

      return {
        status: 'anonymized' as const,
        userId: user.id,
        clerkUserId: user.clerkUserId,
        counts: {
          listings: listings.length,
          guestReservations: anonymizedReservations,
          messages: messages.count,
          payments: payments.count,
          calendarSyncs,
        },
      };
    }, {
      maxWait: ANONYMIZATION_TRANSACTION_MAX_WAIT_MS,
      timeout: ANONYMIZATION_TRANSACTION_TIMEOUT_MS,
    });
  }

  /**
   * Réservations faites par l'utilisateur en tant que voyageur. La ligne Reservation ne porte pas
   * d'identifiant de voyageur : on passe par le paiement qu'il a réglé et par la conversation où il
   * est le voyageur.
   */
  private async findGuestReservationIds(db: Prisma.TransactionClient, userId: string): Promise<string[]> {
    const [payments, conversations] = await Promise.all([
      db.payment.findMany({
        where: { userId, reservationId: { not: null } },
        select: { reservationId: true },
      }),
      db.conversation.findMany({
        where: { guestUserId: userId, reservationId: { not: null } },
        select: { reservationId: true },
      }),
    ]);

    const ids = new Set<string>();
    for (const row of [...payments, ...conversations]) {
      if (row.reservationId) ids.add(row.reservationId);
    }
    return [...ids];
  }
}
