import type { PrismaClient, User } from '@prisma/client';

import { toPrismaJson } from '../../lib/prisma.js';
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

function stripAccents(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeIdentityToken(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[@\s._-]+/g, '')
    .trim();
}

export function isDeprecatedHostIdentity(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = normalizeIdentityToken(value);
  if (!normalized) return false;

  return normalized === 'hote' || normalized === 'host';
}

function readEmailLocalPart(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const localPart = trimmed.split('@')[0]?.trim() ?? '';
  return localPart || null;
}

function resolveIdentityLabel(input: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
}): string {
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
  const candidates = [
    input.displayName,
    fullName,
    input.username,
    readEmailLocalPart(input.email),
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (isDeprecatedHostIdentity(trimmed)) continue;
    return trimmed;
  }

  return '';
}

function mergeHostProfileIdentity(
  generatedProfile: Record<string, unknown>,
  existingProfile: Record<string, unknown>,
): Record<string, unknown> {
  const merged = {
    ...generatedProfile,
    ...existingProfile,
  };

  const generatedName = readOptionalString(generatedProfile.name as string | null | undefined) ?? '';
  const generatedAvatar = readOptionalString(generatedProfile.avatar as string | null | undefined) ?? '';

  const existingName = readOptionalString(existingProfile.name as string | null | undefined);
  merged.name = existingName && !isDeprecatedHostIdentity(existingName) ? existingName : generatedName;

  const existingDisplayName = readOptionalString(
    (existingProfile.displayName ?? existingProfile.display_name) as string | null | undefined,
  );
  if (existingDisplayName && !isDeprecatedHostIdentity(existingDisplayName)) {
    merged.displayName = existingDisplayName;
  } else if (generatedName) {
    merged.displayName = generatedName;
  } else {
    delete merged.displayName;
  }

  const existingPseudo = readOptionalString(existingProfile.pseudo as string | null | undefined);
  if (existingPseudo && !isDeprecatedHostIdentity(existingPseudo)) {
    merged.pseudo = existingPseudo;
  } else if (generatedName) {
    merged.pseudo = generatedName;
  } else {
    delete merged.pseudo;
  }

  const existingAvatar = readOptionalString(existingProfile.avatar as string | null | undefined);
  merged.avatar = existingAvatar ?? generatedAvatar;

  return merged;
}

function toHostProfile(user: Partial<User>) {
  const displayName = resolveIdentityLabel({
    displayName: user.displayName ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    email: user.email ?? null,
  });

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
  const username = readString(payload, 'username') ?? readString(payload, 'preferred_username');
  const nameFromPayload = readString(payload, 'name');
  const displayName = resolveIdentityLabel({
    displayName: nameFromPayload,
    firstName,
    lastName,
    username,
    email,
  }) || null;
  const avatarUrl =
    readString(payload, 'picture') ??
    readString(payload, 'image_url') ??
    null;

  const hostProfile = toHostProfile({
    firstName: firstName ?? undefined,
    lastName: lastName ?? undefined,
    displayName: displayName ?? undefined,
    email: email ?? undefined,
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
    const persistedDisplayName = readOptionalString(targetUser.displayName);
    const normalizedPersistedDisplayName = persistedDisplayName && !isDeprecatedHostIdentity(persistedDisplayName)
      ? persistedDisplayName
      : null;
    const persistedAvatarUrl = readOptionalString(targetUser.avatarUrl);
    const resolvedDisplayName = normalizedPersistedDisplayName ?? displayName ?? null;

    const nextGeneratedHostProfile = toHostProfile({
      firstName: firstName ?? targetUser.firstName ?? undefined,
      lastName: lastName ?? targetUser.lastName ?? undefined,
      displayName: resolvedDisplayName ?? undefined,
      email: email ?? targetUser.email ?? undefined,
      avatarUrl: persistedAvatarUrl ?? avatarUrl ?? targetUser.avatarUrl ?? undefined,
    });
    const mergedHostProfile = mergeHostProfileIdentity(nextGeneratedHostProfile, existingHostProfile);

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
        displayName: resolvedDisplayName,
        avatarUrl: persistedAvatarUrl ?? avatarUrl,
        hostProfile: toPrismaJson(mergedHostProfile),
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
      hostProfile: toPrismaJson(hostProfile),
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

  const generatedProfile = toHostProfile(user);
  if (user.hostProfile && typeof user.hostProfile === 'object' && !Array.isArray(user.hostProfile)) {
    return mergeHostProfileIdentity(generatedProfile, user.hostProfile as Record<string, unknown>);
  }

  return generatedProfile;
}
