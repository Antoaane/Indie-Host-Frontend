import type { PrismaClient, User } from '@prisma/client';

import { asObject } from '../../lib/json.js';
import { toPrismaJson } from '../../lib/prisma.js';
import { hasAdminAccess } from '../../lib/authRole.js';
import { listClerkUsers } from '../../lib/clerkUsers.js';
import type { RequestAuth } from '../../types/auth.js';
import { ListingsService } from '../listings/listings.service.js';
import { buildHostProfileFromUser, isDeprecatedHostIdentity, resolveUserByIdentifier, upsertUserFromAuth } from './users.repository.js';

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
  username: string | null;
  avatarUrl: string | null;
};

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readPreferredUsername(hostProfile: unknown): string | null {
  const record = asRecord(hostProfile);
  if (!record) return null;

  const candidates = [
    record.pseudo,
    record.displayName,
    record.display_name,
    record.name,
    record.username,
    record.userName,
    record.user_name,
  ];

  for (const value of candidates) {
    const normalized = readOptionalString(value);
    if (!normalized) continue;
    if (isDeprecatedHostIdentity(normalized)) continue;
    return normalized;
  }

  return null;
}

function toSearchableUserText(user: Pick<User, 'email' | 'firstName' | 'lastName' | 'displayName' | 'hostProfile'>): string {
  const firstName = user.firstName ?? '';
  const lastName = user.lastName ?? '';
  const displayName = user.displayName ?? '';
  const username = readPreferredUsername(user.hostProfile) ?? '';
  const email = user.email ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  const reverseFullName = `${lastName} ${firstName}`.trim();

  return normalizeSearchValue([
    firstName,
    lastName,
    displayName,
    username,
    email,
    fullName,
    reverseFullName,
  ].join(' '));
}

function toSearchableAdminItemText(user: Pick<AdminUserSearchItem, 'email' | 'firstName' | 'lastName' | 'displayName' | 'username'>): string {
  const firstName = user.firstName ?? '';
  const lastName = user.lastName ?? '';
  const displayName = user.displayName ?? '';
  const username = user.username ?? '';
  const email = user.email ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  const reverseFullName = `${lastName} ${firstName}`.trim();

  return normalizeSearchValue([
    firstName,
    lastName,
    displayName,
    username,
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
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            hostProfile: true,
            clerkUserId: true,
            externalUserId: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return await this.listingsService.listUserCards(listings);
  }

  async listAllListingsForAdmin(auth: RequestAuth | null) {
    if (!hasAdminAccess(auth)) return 'forbidden' as const;

    const listings = await this.prisma.listing.findMany({
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            hostProfile: true,
            clerkUserId: true,
            externalUserId: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return await this.listingsService.listUserCards(listings);
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
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

    const clerkUsers = await listClerkUsers(normalizedQuery ? Math.min(2000, safeLimit * 8) : safeLimit);
    if (clerkUsers.length > 0) {
      const clerkItems = clerkUsers.map<AdminUserSearchItem>((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
      }));

      const filteredClerkItems = normalizedQuery
        ? clerkItems.filter((user) => {
            const searchableText = toSearchableAdminItemText(user);
            if (!searchableText) return false;
            if (searchableText.includes(normalizedQuery)) return true;
            return queryTokens.every((token) => searchableText.includes(token));
          })
        : clerkItems;

      return filteredClerkItems.slice(0, safeLimit);
    }

    const initialTake = normalizedQuery ? Math.min(2000, safeLimit * 4) : safeLimit;

    const users = await this.prisma.user.findMany({
      where: normalizedQuery
        ? {
            OR: [
              { firstName: { contains: normalizedQuery, mode: 'insensitive' } },
              { lastName: { contains: normalizedQuery, mode: 'insensitive' } },
              { displayName: { contains: normalizedQuery, mode: 'insensitive' } },
              { email: { contains: normalizedQuery, mode: 'insensitive' } },
              { hostProfile: { path: ['pseudo'], string_contains: normalizedQuery } },
              { hostProfile: { path: ['displayName'], string_contains: normalizedQuery } },
              { hostProfile: { path: ['name'], string_contains: normalizedQuery } },
            ],
          }
        : undefined,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        hostProfile: true,
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
      displayName: user.displayName && !isDeprecatedHostIdentity(user.displayName) ? user.displayName : null,
      username: readPreferredUsername(user.hostProfile),
      avatarUrl: user.avatarUrl ?? null,
    }));
  }
}
