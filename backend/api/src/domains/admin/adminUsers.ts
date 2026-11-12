// Droits des comptes, depuis l'administration : rôle administrateur (métadonnée privée Clerk) et
// blocage de la connexion (bannissement Clerk). Le rôle est relu par `plugins/auth.ts` à chaque
// requête, avec un cache d'une minute qu'on vide ici pour que le changement prenne effet aussitôt.

import { isAdminRoleName, isConfiguredSuperAdminEmail, readRoleFromAuthPayload } from '../../lib/authRole.js';
import { ClerkApiError, fetchClerkUserById, setClerkUserBanned, updateClerkUserMetadata, type ClerkUserProfile } from '../../lib/clerkUsers.js';
import { invalidateClerkRoleCache } from '../../plugins/auth.js';
import type { RequestAuth } from '../../types/auth.js';
import { resolveAdminUserAccess, type AdminUserAccess } from '../users/users.service.js';

export class AdminUserActionError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function hasAdminRole(user: ClerkUserProfile): boolean {
  return isAdminRoleName(readRoleFromAuthPayload({
    private_metadata: user.privateMetadata,
    public_metadata: user.publicMetadata,
  }));
}

async function loadTarget(clerkUserId: string): Promise<ClerkUserProfile> {
  const user = await fetchClerkUserById(clerkUserId);
  if (!user) {
    throw new AdminUserActionError(404, 'USER_NOT_FOUND', 'Ce compte n’existe pas chez Clerk, ou Clerk ne répond pas.');
  }
  return user;
}

function assertNotSelf(actor: RequestAuth, target: ClerkUserProfile, message: string) {
  if (actor.userId === target.id) {
    throw new AdminUserActionError(409, 'SELF_ACTION', message);
  }
}

function rethrowClerk(error: unknown): never {
  if (error instanceof ClerkApiError) {
    throw new AdminUserActionError(error.statusCode >= 500 ? 502 : error.statusCode, 'CLERK_REFUSED', error.message);
  }
  throw error;
}

/** Donne ou retire le rôle administrateur. Les comptes de la plateforme et le sien ne changent pas. */
export async function setAdminRole(actor: RequestAuth, clerkUserId: string, makeAdmin: boolean): Promise<AdminUserAccess> {
  const target = await loadTarget(clerkUserId);

  if (isConfiguredSuperAdminEmail(target.email)) {
    throw new AdminUserActionError(409, 'CONFIGURED_SUPER_ADMIN',
      'Ce compte est administrateur par la configuration du serveur (SUPER_ADMIN_EMAILS) : ses droits ne se changent pas ici.');
  }
  if (!makeAdmin) {
    assertNotSelf(actor, target, 'Vous ne pouvez pas retirer vos propres droits d’administration.');
  }
  if (makeAdmin && target.banned) {
    throw new AdminUserActionError(409, 'USER_BANNED', 'Débloquez d’abord ce compte avant de lui donner des droits.');
  }

  let updated: ClerkUserProfile | null;
  try {
    updated = await updateClerkUserMetadata(target.id, makeAdmin
      ? { privateMetadata: { role: 'admin' } }
      // `null` supprime la clé : un rôle posé à la main côté public disparaît aussi.
      : { privateMetadata: { role: null }, publicMetadata: { role: null } });
  } catch (error) {
    rethrowClerk(error);
  }

  invalidateClerkRoleCache(target.id);
  const after = updated ?? await loadTarget(target.id);

  if (!makeAdmin && hasAdminRole(after)) {
    // Le rôle vient d'une autre clé de métadonnée (`roles`, `app_role`…), que l'on ne devine pas.
    throw new AdminUserActionError(409, 'ROLE_ELSEWHERE',
      'Ce compte reste administrateur par une autre métadonnée Clerk : retirez-la dans le Clerk Dashboard (Users → le compte → Metadata).');
  }

  return resolveAdminUserAccess(after.email, after);
}

/** Bloque ou débloque la connexion d'un compte. Un administrateur doit d'abord perdre son rôle. */
export async function setUserBlocked(actor: RequestAuth, clerkUserId: string, blocked: boolean): Promise<AdminUserAccess> {
  const target = await loadTarget(clerkUserId);

  if (blocked) {
    assertNotSelf(actor, target, 'Vous ne pouvez pas bloquer votre propre compte.');
    if (isConfiguredSuperAdminEmail(target.email) || hasAdminRole(target)) {
      throw new AdminUserActionError(409, 'TARGET_IS_ADMIN', 'Retirez d’abord ses droits d’administration avant de bloquer ce compte.');
    }
  }

  let updated: ClerkUserProfile | null;
  try {
    updated = await setClerkUserBanned(target.id, blocked);
  } catch (error) {
    rethrowClerk(error);
  }

  invalidateClerkRoleCache(target.id);
  const after = updated ?? await loadTarget(target.id);
  return resolveAdminUserAccess(after.email, after);
}
