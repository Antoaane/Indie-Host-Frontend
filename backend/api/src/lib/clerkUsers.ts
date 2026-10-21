import type { JWTPayload } from 'jose';

import { env } from '../config/env.js';
import type { RequestAuth } from '../types/auth.js';

const CLERK_API_BASE_URL = 'https://api.clerk.com/v1';
const CLERK_MAX_LIST_LIMIT = 2000;
const CLERK_LIST_PAGE_SIZE = 100;

export type ClerkUserProfile = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  privateMetadata: Record<string, unknown>;
  publicMetadata: Record<string, unknown>;
  unsafeMetadata: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => Boolean(asRecord(item))).map((item) => item as Record<string, unknown>);
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function readEmailFromAddressEntry(entry: Record<string, unknown>): string | null {
  return (
    readOptionalString(entry.email_address)
    ?? readOptionalString(entry.emailAddress)
    ?? readOptionalString(entry.address)
    ?? null
  );
}

function readPrimaryEmail(record: Record<string, unknown>): string | null {
  const direct = (
    readOptionalString(record.email)
    ?? readOptionalString(record.email_address)
    ?? readOptionalString(record.emailAddress)
  );
  if (direct) return direct;

  const primaryEmailId = readOptionalString(record.primary_email_address_id) ?? readOptionalString(record.primaryEmailAddressId);
  const addresses = asRecordArray(record.email_addresses ?? record.emailAddresses);
  if (!addresses.length) return null;

  if (primaryEmailId) {
    const primary = addresses.find((entry) => {
      const id = readOptionalString(entry.id);
      return Boolean(id && id === primaryEmailId);
    });
    if (primary) {
      const email = readEmailFromAddressEntry(primary);
      if (email) return email;
    }
  }

  for (const entry of addresses) {
    const email = readEmailFromAddressEntry(entry);
    if (email) return email;
  }

  return null;
}

function toPlainMetadata(value: unknown): Record<string, unknown> {
  return asRecord(value) ?? {};
}

function parseClerkUser(raw: unknown): ClerkUserProfile | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = readOptionalString(record.id);
  if (!id) return null;

  const firstName = readOptionalString(record.first_name) ?? readOptionalString(record.firstName);
  const lastName = readOptionalString(record.last_name) ?? readOptionalString(record.lastName);
  const username = readOptionalString(record.username);
  const fullName = (
    readOptionalString(record.full_name)
    ?? readOptionalString(record.fullName)
    ?? readOptionalString(record.name)
  );
  const fallbackName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const displayName = fullName ?? (fallbackName || username || null);
  const avatarUrl = (
    readOptionalString(record.image_url)
    ?? readOptionalString(record.imageUrl)
    ?? readOptionalString(record.profile_image_url)
    ?? readOptionalString(record.profileImageUrl)
  );

  return {
    id,
    email: readPrimaryEmail(record),
    firstName,
    lastName,
    displayName,
    username,
    avatarUrl,
    privateMetadata: toPlainMetadata(record.private_metadata ?? record.privateMetadata),
    publicMetadata: toPlainMetadata(record.public_metadata ?? record.publicMetadata),
    unsafeMetadata: toPlainMetadata(record.unsafe_metadata ?? record.unsafeMetadata),
  };
}

function readUsersCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];

  const candidates = [
    record.data,
    record.users,
    record.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

async function fetchClerkJson(pathname: string, query?: URLSearchParams): Promise<unknown | null> {
  const secret = env.CLERK_SECRET_KEY.trim();
  if (!secret) return null;

  const queryString = query?.toString() ?? '';
  const url = `${CLERK_API_BASE_URL}${pathname}${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export type ClerkInvitation = {
  id: string;
  emailAddress: string;
  status: string;
  url: string | null;
};

export type CreateClerkInvitationInput = {
  emailAddress: string;
  redirectUrl?: string | null;
  publicMetadata?: Record<string, unknown>;
};

export class ClerkApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function readClerkErrorMessage(payload: unknown, fallback: string): string {
  const record = asRecord(payload);
  const errors = Array.isArray(record?.errors) ? record?.errors : [];
  for (const entry of errors) {
    const error = asRecord(entry);
    const message = readOptionalString(error?.long_message) ?? readOptionalString(error?.message);
    if (message) return message;
  }
  return fallback;
}

/**
 * Invitation Clerk : l'invité reçoit un email et crée son compte sur l'instance (prod : indiehost.fr).
 * Lève ClerkApiError (ex. 400 si une invitation est déjà en attente pour cet email).
 */
export async function createClerkInvitation(input: CreateClerkInvitationInput): Promise<ClerkInvitation> {
  const secret = env.CLERK_SECRET_KEY.trim();
  if (!secret) {
    throw new ClerkApiError(503, 'Clerk n’est pas configuré sur ce serveur (CLERK_SECRET_KEY).');
  }

  const response = await fetch(`${CLERK_API_BASE_URL}/invitations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: input.emailAddress,
      ...(input.redirectUrl ? { redirect_url: input.redirectUrl } : {}),
      ...(input.publicMetadata ? { public_metadata: input.publicMetadata } : {}),
      notify: true,
      ignore_existing: true,
    }),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ClerkApiError(response.status, readClerkErrorMessage(payload, 'Clerk a refusé l’invitation.'));
  }

  const record = asRecord(payload) ?? {};
  return {
    id: readOptionalString(record.id) ?? '',
    emailAddress: readOptionalString(record.email_address) ?? input.emailAddress,
    status: readOptionalString(record.status) ?? 'pending',
    url: readOptionalString(record.url),
  };
}

export async function fetchClerkUserById(userId: string): Promise<ClerkUserProfile | null> {
  const normalizedId = readOptionalString(userId);
  if (!normalizedId) return null;

  const payload = await fetchClerkJson(`/users/${encodeURIComponent(normalizedId)}`);
  return parseClerkUser(payload);
}

export async function listClerkUsers(limit: number): Promise<ClerkUserProfile[]> {
  const safeLimit = Math.max(1, Math.min(CLERK_MAX_LIST_LIMIT, Math.trunc(limit)));
  const pageSize = Math.min(CLERK_LIST_PAGE_SIZE, safeLimit);
  const collected: ClerkUserProfile[] = [];

  let offset = 0;
  while (collected.length < safeLimit) {
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    });

    const payload = await fetchClerkJson('/users', params);
    const pageUsers = readUsersCollection(payload);
    if (!pageUsers.length) break;

    for (const rawUser of pageUsers) {
      const parsed = parseClerkUser(rawUser);
      if (!parsed) continue;
      collected.push(parsed);
      if (collected.length >= safeLimit) break;
    }

    if (pageUsers.length < pageSize) break;
    offset += pageUsers.length;
  }

  return collected.slice(0, safeLimit);
}

export function buildRequestAuthFromClerkUser(user: ClerkUserProfile): RequestAuth {
  const payload = {
    sub: user.id,
    email: user.email ?? undefined,
    email_address: user.email ?? undefined,
    given_name: user.firstName ?? undefined,
    family_name: user.lastName ?? undefined,
    name: user.displayName ?? undefined,
    username: user.username ?? undefined,
    picture: user.avatarUrl ?? undefined,
    image_url: user.avatarUrl ?? undefined,
    private_metadata: user.privateMetadata,
    public_metadata: user.publicMetadata,
    unsafe_metadata: user.unsafeMetadata,
  } as JWTPayload & Record<string, unknown>;

  return {
    userId: user.id,
    payload,
  };
}
