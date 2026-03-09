import type { PrismaClient, User } from '@prisma/client';

import { asObject } from '../../lib/json.js';
import { toPrismaJson } from '../../lib/prisma.js';
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
    if (!actor) return 'forbidden' as const;

    const resolvedUser = await this.resolveUserById(userId);
    if (!resolvedUser) return [];
    if (resolvedUser.id !== actor.id) return 'forbidden' as const;

    return this.listListingsByOwnerId(resolvedUser.id);
  }
}
