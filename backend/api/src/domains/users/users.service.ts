import type { PrismaClient, User } from '@prisma/client';

import { asObject } from '../../lib/json.js';
import { toPrismaJson } from '../../lib/prisma.js';
import { hasAdminAccess } from '../../lib/authRole.js';
import type { RequestAuth } from '../../types/auth.js';
import { ListingsService } from '../listings/listings.service.js';
import { buildHostProfileFromUser, resolveUserByIdentifier, upsertUserFromAuth } from './users.repository.js';

type UpdateMeInput = {
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  hostProfile?: Record<string, unknown>;
  stripeConnect?: Record<string, unknown>;
};

type SearchUsersInput = {
  query: string;
  limit: number;
};

export type AdminUserSearchItem = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toSearchableUserText(user: Pick<User, 'email' | 'firstName' | 'lastName' | 'displayName'>): string {
  const firstName = user.firstName ?? '';
  const lastName = user.lastName ?? '';
  const displayName = user.displayName ?? '';
  const email = user.email ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  const reverseFullName = `${lastName} ${firstName}`.trim();

  return normalizeSearchValue([
    firstName,
    lastName,
    displayName,
    email,
    fullName,
    reverseFullName,
  ].join(' '));
}

export class UsersService {
  private readonly listingsService: ListingsService;

  constructor(private readonly prisma: PrismaClient) {
    this.listingsService = new ListingsService(prisma);
  }

  async getOrCreateAuthenticatedUser(auth: RequestAuth | null) {
    return upsertUserFromAuth(this.prisma, auth);
  }

  async updateAuthenticatedUser(auth: RequestAuth | null, input: UpdateMeInput) {
    const user = await upsertUserFromAuth(this.prisma, auth);
    if (!user) return null;

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: input.email ?? user.email,
        firstName: input.firstName ?? user.firstName,
        lastName: input.lastName ?? user.lastName,
        displayName: input.displayName ?? user.displayName,
        avatarUrl: input.avatarUrl ?? user.avatarUrl,
        hostProfile: toPrismaJson(input.hostProfile ?? asObject(user.hostProfile, buildHostProfileFromUser(user))),
        stripeConnectProfile: toPrismaJson(input.stripeConnect ?? asObject(user.stripeConnectProfile)),
      },
    });

    return updated;
  }

  async resolveUserById(userId: string): Promise<User | null> {
    return resolveUserByIdentifier(this.prisma, userId);
  }

  private async listListingsByOwnerId(ownerId: string) {
    const listings = await this.prisma.listing.findMany({
      where: {
        ownerId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return this.listingsService.listUserCards(listings);
  }

  async listAuthenticatedUserListings(auth: RequestAuth | null) {
    const actor = await upsertUserFromAuth(this.prisma, auth);
    if (!actor) return [];

    return this.listListingsByOwnerId(actor.id);
  }

  async listUserListingsForAuth(userId: string, auth: RequestAuth | null) {
    const actor = await upsertUserFromAuth(this.prisma, auth);
    const allowAdmin = hasAdminAccess(auth);
    if (!actor && !allowAdmin) return 'forbidden' as const;

    const resolvedUser = await this.resolveUserById(userId);
    if (!resolvedUser) return [];
    if (!allowAdmin && (!actor || resolvedUser.id !== actor.id)) return 'forbidden' as const;

    return this.listListingsByOwnerId(resolvedUser.id);
  }

  async searchUsersForAdmin(input: SearchUsersInput, auth: RequestAuth | null) {
    if (!hasAdminAccess(auth)) return 'forbidden' as const;

    const normalizedQuery = normalizeSearchValue(input.query);
    const safeLimit = Math.max(1, Math.min(2000, Math.trunc(input.limit)));
    const initialTake = normalizedQuery ? Math.min(2000, safeLimit * 4) : safeLimit;
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

    const users = await this.prisma.user.findMany({
      where: normalizedQuery
        ? {
            OR: [
              { firstName: { contains: normalizedQuery, mode: 'insensitive' } },
              { lastName: { contains: normalizedQuery, mode: 'insensitive' } },
              { displayName: { contains: normalizedQuery, mode: 'insensitive' } },
              { email: { contains: normalizedQuery, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: initialTake,
    });

    const filtered = normalizedQuery
      ? users.filter((user) => {
          const searchableText = toSearchableUserText(user);
          if (!searchableText) return false;
          if (searchableText.includes(normalizedQuery)) return true;
          return queryTokens.every((token) => searchableText.includes(token));
        })
      : users;

    return filtered.slice(0, safeLimit).map<AdminUserSearchItem>((user) => ({
      id: user.id,
      email: user.email ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      displayName: user.displayName ?? null,
      avatarUrl: user.avatarUrl ?? null,
    }));
  }
}
