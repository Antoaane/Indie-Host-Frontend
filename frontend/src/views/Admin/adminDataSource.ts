// File: src/views/Admin/adminDataSource.ts

// D'où l'administration tire ses données : l'API en temps normal, des données en mémoire sur la
// route de développement `/dev/admin` (sans compte ni API). Les écrans passent toujours par ici.

import { inject, type InjectionKey } from 'vue'

import {
  createFloorplanTicket,
  fetchAdminOverview,
  fetchAdminPayments,
  fetchSystemHealth,
  refreshSystemHealth,
  setAdminUserBlocked,
  setAdminUserRole,
  type AdminOverview,
  type AdminPayments,
  type AdminUserAccess,
  type FloorplanTicket,
  type SystemHealth,
} from '@/domain/api/admin'
import { fetchAdminUsersOverview, type AdminUserOverview } from '@/domain/api/users'

export type AdminDataSource = {
  loadOverview: (options?: { refresh?: boolean }) => Promise<AdminOverview>
  loadPayments: (options?: { refresh?: boolean }) => Promise<AdminPayments>
  loadHealth: () => Promise<SystemHealth>
  refreshHealth: () => Promise<{ refreshed: boolean; snapshot: SystemHealth }>
  loadUsers: () => Promise<AdminUserOverview[]>
  setUserRole: (clerkUserId: string, role: 'admin' | 'none') => Promise<AdminUserAccess>
  setUserBlocked: (clerkUserId: string, blocked: boolean) => Promise<AdminUserAccess>
  openFloorplan: () => Promise<FloorplanTicket>
  /** Délai entre deux lectures de l'état des services, en millisecondes. */
  healthPollMs: number
}

export const ADMIN_DATA_SOURCE: InjectionKey<AdminDataSource> = Symbol('admin-data-source')

export const apiAdminDataSource: AdminDataSource = {
  loadOverview: fetchAdminOverview,
  loadPayments: fetchAdminPayments,
  loadHealth: fetchSystemHealth,
  refreshHealth: refreshSystemHealth,
  loadUsers: () => fetchAdminUsersOverview(),
  setUserRole: setAdminUserRole,
  setUserBlocked: setAdminUserBlocked,
  openFloorplan: createFloorplanTicket,
  healthPollMs: 15_000,
}

export function useAdminDataSource(): AdminDataSource {
  return inject(ADMIN_DATA_SOURCE, apiAdminDataSource)
}
