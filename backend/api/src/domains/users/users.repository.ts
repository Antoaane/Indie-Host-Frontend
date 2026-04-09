import type { PrismaClient, User } from '@prisma/client';

import type { RequestAuth } from '../../types/auth.js';

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toHostProfile(user: Partial<User>) {
  const fallbackName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Hote';
  const displayName = user.displayName ?? fallbackName;

  return {
    name: displayName,
    status: 'Host',
    seniority: 0,
    'global-note': 5,
    avatar: user.avatarUrl ?? '',
    'catalog-link': '',
  };
}

export async function upsertUserFromAuth(prisma: PrismaClient, auth: RequestAuth | null): Promise<User | null> {
  if (!auth) return null;

  const payload = auth.payload as Record<string, unknown>;
  const email = readString(payload, 'email') ?? readString(payload, 'email_address');
  const firstName = readString(payload, 'given_name') ?? readString(payload, 'first_name');
  const lastName = readString(payload, 'family_name') ?? readString(payload, 'last_name');
  const nameFromPayload = readString(payload, 'name');
  const fallbackDisplayName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const displayName = nameFromPayload ?? (fallbackDisplayName || null);
  const avatarUrl =
    readString(payload, 'picture') ??
    readString(payload, 'image_url') ??
    null;

  const hostProfile = toHostProfile({
    firstName: firstName ?? undefined,
    lastName: lastName ?? undefined,
    displayName: displayName ?? undefined,
    avatarUrl: avatarUrl ?? undefined,
  });

  const [byClerkUserId, byExternalUserId] = await Promise.all([
    prisma.user.findUnique({
      where: {
        clerkUserId: auth.userId,
      },
    }),
    prisma.user.findUnique({
      where: {
        externalUserId: auth.userId,
      },
    }),
  ]);

  const targetUser = byClerkUserId ?? byExternalUserId;

  if (targetUser) {
    const existingHostProfile = asRecord(targetUser.hostProfile);
    const mergedHostProfile = {
      ...hostProfile,
      ...existingHostProfile,
    };

    const persistedDisplayName = readOptionalString(targetUser.displayName);
    const persistedAvatarUrl = readOptionalString(targetUser.avatarUrl);

    return prisma.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        ...(byClerkUserId?.id === targetUser.id || !byClerkUserId ? { clerkUserId: auth.userId } : {}),
        ...(byExternalUserId?.id === targetUser.id || !byExternalUserId ? { externalUserId: auth.userId } : {}),
        email: email ?? targetUser.email,
        firstName: firstName ?? targetUser.firstName,
        lastName: lastName ?? targetUser.lastName,
        displayName: persistedDisplayName ?? displayName,
        avatarUrl: persistedAvatarUrl ?? avatarUrl,
        hostProfile: mergedHostProfile,
      },
    });
  }

  return prisma.user.create({
    data: {
      clerkUserId: auth.userId,
      externalUserId: auth.userId,
      email,
      firstName,
      lastName,
      displayName,
      avatarUrl,
      hostProfile,
    },
  });
}

export async function resolveUserByIdentifier(prisma: PrismaClient, userId: string): Promise<User | null> {
  const trimmed = userId.trim();
  if (!trimmed) return null;

  const [byInternalId, byExternalId, byClerkId] = await Promise.all([
    prisma.user.findUnique({ where: { id: trimmed } }),
    prisma.user.findUnique({ where: { externalUserId: trimmed } }),
    prisma.user.findUnique({ where: { clerkUserId: trimmed } }),
  ]);

  return byInternalId ?? byExternalId ?? byClerkId;
}

export function buildHostProfileFromUser(user: User | null | undefined): Record<string, unknown> {
  if (!user) {
    return {
      name: '',
      status: '',
      seniority: 0,
      'global-note': 0,
      avatar: '',
      'catalog-link': '',
    };
  }

  if (user.hostProfile && typeof user.hostProfile === 'object' && !Array.isArray(user.hostProfile)) {
    return user.hostProfile as Record<string, unknown>;
  }

  return toHostProfile(user);
}
