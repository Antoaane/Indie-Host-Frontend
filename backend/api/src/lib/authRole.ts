import type { RequestAuth } from '../types/auth.js';

const ADMIN_ROLE_NAMES = new Set([
  'admin',
  'superadmin',
  'super_admin',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeRoleName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function isAdminRoleName(role: string | null): boolean {
  if (!role) return false;
  return ADMIN_ROLE_NAMES.has(role);
}

function readRoleCandidate(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = normalizeRoleName(value);
    return normalized || null;
  }

  if (Array.isArray(value)) {
    let firstRole: string | null = null;
    for (const item of value) {
      const role = readRoleCandidate(item);
      if (!role) continue;
      if (isAdminRoleName(role)) return role;
      if (!firstRole) firstRole = role;
    }
    return firstRole;
  }

  const fromRecord = asRecord(value);
  if (!fromRecord) return null;
  return readRoleFromRecord(fromRecord);
}

function readRoleFromRecord(record: Record<string, unknown>): string | null {
  const directRoleKeys = [
    'role',
    'userRole',
    'user_role',
    'appRole',
    'app_role',
    'orgRole',
    'org_role',
  ];

  for (const key of directRoleKeys) {
    const role = readRoleCandidate(record[key]);
    if (role) return role;
  }

  const roleCollectionKeys = [
    'roles',
    'userRoles',
    'user_roles',
    'appRoles',
    'app_roles',
    'orgRoles',
    'org_roles',
  ];

  for (const key of roleCollectionKeys) {
    const role = readRoleCandidate(record[key]);
    if (role) return role;
  }

  for (const [key, value] of Object.entries(record)) {
    if (!/role/i.test(key)) continue;
    const role = readRoleCandidate(value);
    if (role) return role;
  }

  return null;
}

export function readRoleFromAuthPayload(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) return null;

  const fromRoot = readRoleFromRecord(record);
  if (fromRoot) return fromRoot;

  // Uniquement les métadonnées que seul le backend Clerk peut écrire : unsafe_metadata est
  // modifiable par l'utilisateur lui-même depuis le navigateur (user.update()).
  const metadataKeys = [
    'privateMetadata',
    'private_metadata',
    'publicMetadata',
    'public_metadata',
  ];

  for (const key of metadataKeys) {
    const metadata = asRecord(record[key]);
    if (!metadata) continue;
    const role = readRoleFromRecord(metadata);
    if (role) return role;
  }

  return null;
}

export function hasAdminAccess(auth: RequestAuth | null | undefined): boolean {
  const role = readRoleFromAuthPayload(auth?.payload);
  return isAdminRoleName(role);
}
