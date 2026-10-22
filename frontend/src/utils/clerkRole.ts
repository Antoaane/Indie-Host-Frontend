// File: src/utils/clerkRole.ts

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
      if (ADMIN_ROLE_NAMES.has(role)) return role;
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

export function readClerkUserRole(user: unknown): string | null {
  const record = asRecord(user);
  if (!record) return null;

  const roleAtRoot = readRoleFromRecord(record);
  if (roleAtRoot) return roleAtRoot;

  // unsafeMetadata est modifiable par l'utilisateur lui-même : jamais une source de rôle.
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

export function hasClerkAdminRole(user: unknown): boolean {
  const role = readClerkUserRole(user);
  if (!role) return false;
  return ADMIN_ROLE_NAMES.has(role);
}
