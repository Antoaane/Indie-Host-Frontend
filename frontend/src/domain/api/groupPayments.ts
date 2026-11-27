// File: src/domain/api/groupPayments.ts

// Paiement à plusieurs : page de suivi du groupe et règlement d'une part, depuis un lien personnel
// (`/booking/group/<clé>`), sans compte. Routes de l'API : `bookings.plugin.ts`.

import { buildBookingsApiUrl } from '@/domain/api/bookings'

export type GroupPaymentStatus = 'pending' | 'completed' | 'expired' | 'canceled'
export type GroupShareStatus = 'paid' | 'pending' | 'released'

export type GroupParticipant = {
  position: number
  isOrganizer: boolean
  isYou: boolean
  label: string
  status: GroupShareStatus
  amountMinor: number
  /** Gestion du groupe : reçue seulement par l'organisateur. */
  shareId?: string
  email?: string | null
  invitedAtISO?: string | null
  payPath?: string
  canResend?: boolean
}

export type GroupPaymentPage = {
  role: 'organizer' | 'participant'
  status: GroupPaymentStatus
  /** Débit des parts ou annulation en cours : l'état définitif arrive dans la minute. */
  processing: boolean
  closeReason: 'expired' | 'organizer' | 'host' | null
  /** Paiement simulé (développement sans clé Stripe). */
  mock: boolean
  listing: { id: string; title: string; city: string | null; image: string | null }
  host: { name: string }
  stay: {
    startISO: string
    endISO: string
    nights: number
    guests: { adults: number; children: number; infants: number; pets: number }
  }
  amounts: {
    currency: string
    totalMinor: number
    onlineTotalMinor: number
    deferredMinor: number
    deferredMode: 'none' | 'online' | 'cash'
    deferredDueDateISO: string | null
  }
  group: {
    payers: number
    paidCount: number
    expiresAtISO: string
    createdAtISO: string
    organizerName: string
  }
  share: {
    position: number
    status: GroupShareStatus
    amountMinor: number
    name: string | null
  }
  participants: GroupParticipant[]
  actions: { canPay: boolean; canInvite: boolean; canCancel: boolean }
  cancellation: { summary: string; lines: string[] }
  confirmationPath: string | null
}

export type GroupShareIntent = {
  paymentIntentId: string
  clientSecret: string
  connectedAccountId: string | null
  amountMinor: number
  currency: string
  mock: boolean
}

export type GroupInvitationInput = {
  shareId: string
  email: string
  resend?: boolean
}

/** Appels de la page : l'API en production, de fausses données sur la route de développement. */
export type GroupPaymentSource = {
  fetchPage: (shareKey: string) => Promise<GroupPaymentPage>
  createShareIntent: (shareKey: string, input: { name: string }) => Promise<GroupShareIntent>
  confirmShare: (shareKey: string) => Promise<GroupPaymentPage>
  invite: (shareKey: string, invitations: GroupInvitationInput[]) => Promise<GroupPaymentPage>
  cancel: (shareKey: string) => Promise<GroupPaymentPage>
}

function resourceUrl(shareKey: string, suffix = ''): string {
  return buildBookingsApiUrl(`/group-payments/${encodeURIComponent(shareKey.trim())}${suffix}`)
}

async function getAxios() {
  const { default: axios } = await import('axios')
  return axios
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const data = (error as { response?: { data?: unknown } }).response?.data
    if (data && typeof data === 'object') {
      const message = (data as { message?: unknown }).message
      if (typeof message === 'string' && message.trim()) return message.trim()
    }
  }
  return fallback
}

async function post<T>(url: string, body: unknown, fallback: string): Promise<T> {
  const axios = await getAxios()
  try {
    const { data } = await axios.post<T>(url, body, { withCredentials: false })
    return data
  } catch (error) {
    throw new Error(resolveErrorMessage(error, fallback))
  }
}

export const groupPaymentApi: GroupPaymentSource = {
  async fetchPage(shareKey) {
    const axios = await getAxios()
    try {
      const { data } = await axios.get<GroupPaymentPage>(resourceUrl(shareKey), { withCredentials: false })
      return data
    } catch (error) {
      throw new Error(resolveErrorMessage(error, 'Impossible de charger ce paiement à plusieurs. Vérifiez le lien reçu par e-mail.'))
    }
  },
  createShareIntent(shareKey, input) {
    return post<GroupShareIntent>(resourceUrl(shareKey, '/payment-intent'), input, 'Impossible de préparer le paiement de votre part.')
  },
  confirmShare(shareKey) {
    return post<GroupPaymentPage>(resourceUrl(shareKey, '/confirm'), {}, 'Votre paiement est passé, mais son enregistrement a échoué. Rechargez la page dans un instant.')
  },
  invite(shareKey, invitations) {
    return post<GroupPaymentPage>(resourceUrl(shareKey, '/invitations'), { invitations }, 'Impossible d’envoyer les invitations.')
  },
  cancel(shareKey) {
    return post<GroupPaymentPage>(resourceUrl(shareKey, '/cancel'), {}, 'Impossible d’annuler la réservation.')
  },
}
