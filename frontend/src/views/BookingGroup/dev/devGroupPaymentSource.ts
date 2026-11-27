// File: src/views/BookingGroup/dev/devGroupPaymentSource.ts

// Paiement à plusieurs en mémoire, pour la route de développement `/dev/group-payment` : la page
// complète (invitations, règlement simulé d'une part, groupe complet ou échu) sans API ni Stripe.

import type {
  GroupInvitationInput,
  GroupParticipant,
  GroupPaymentPage,
  GroupPaymentSource,
} from '@/domain/api/groupPayments'
import { splitGroupAmount } from '@/domain/payments/groupPayment'

export type DevGroupScenario = {
  role: 'organizer' | 'participant'
  /**
   * `pending` : en cours ; `paid` : la part de l'amie est réglée ; `alone` : seule l'organisatrice a
   * réglé (une personne peut être retirée) ; puis les issues.
   */
  state: 'pending' | 'paid' | 'alone' | 'completed' | 'expired' | 'canceled'
}

const PAYERS = 4
// Six adultes : de quoi ajouter des personnes au groupe.
const ADULTS = 6
const TOTAL_MINOR = 35_000
// Même photo que les annonces en mémoire de `/dev/editor`.
const SAMPLE_IMAGE = '/assets/media/images/webp/hero-image.webp'

type DevShare = {
  shareId: string
  position: number
  name: string | null
  email: string | null
  invitedAtISO: string | null
  status: 'paid' | 'pending' | 'released'
  amountMinor: number
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createDevGroupPaymentSource(scenario: DevGroupScenario): GroupPaymentSource {
  const amounts = splitGroupAmount(TOTAL_MINOR, PAYERS)
  const createdAt = new Date(Date.now() - 31 * 60 * 60 * 1000)
  const expiresAt = new Date(createdAt.getTime() + 72 * 60 * 60 * 1000)
  const invitedAt = new Date(createdAt.getTime() + 10 * 60 * 1000).toISOString()

  const shares: DevShare[] = [
    { shareId: 'share-0', position: 0, name: 'Camille Martin', email: 'camille@exemple.fr', invitedAtISO: null, status: 'paid', amountMinor: amounts[0] ?? 0 },
    { shareId: 'share-1', position: 1, name: 'Julien Bernard', email: 'julien@exemple.fr', invitedAtISO: invitedAt, status: 'paid', amountMinor: amounts[1] ?? 0 },
    { shareId: 'share-2', position: 2, name: null, email: 'sarah.lemoine@exemple.fr', invitedAtISO: invitedAt, status: 'pending', amountMinor: amounts[2] ?? 0 },
    { shareId: 'share-3', position: 3, name: null, email: null, invitedAtISO: null, status: 'pending', amountMinor: amounts[3] ?? 0 },
  ]

  // La personne qui ouvre la page : l'organisatrice, ou l'amie n° 2 (invitée, pas encore réglée).
  const viewerId = scenario.role === 'organizer' ? 'share-0' : 'share-2'
  let status: GroupPaymentPage['status'] = 'pending'
  let shareSequence = shares.length
  let closeReason: GroupPaymentPage['closeReason'] = null

  if (scenario.state === 'paid') {
    const viewer = shares.find((share) => share.shareId === viewerId)
    if (viewer) viewer.status = 'paid'
  }
  if (scenario.state === 'alone') {
    const julien = shares.find((share) => share.shareId === 'share-1')
    if (julien) julien.status = 'pending'
  }
  if (scenario.state === 'completed') {
    shares.forEach((share) => {
      share.status = 'paid'
    })
    status = 'completed'
  }
  if (scenario.state === 'expired' || scenario.state === 'canceled') {
    shares.forEach((share) => {
      if (share.status === 'paid') share.status = 'released'
    })
    status = scenario.state
    closeReason = scenario.state === 'expired' ? 'expired' : 'organizer'
  }

  function build(): GroupPaymentPage {
    const isOrganizer = viewerId === 'share-0'
    const viewer = shares.find((share) => share.shareId === viewerId) as DevShare
    const open = status === 'pending'
    const participants: GroupParticipant[] = shares.map((share) => {
      const base: GroupParticipant = {
        position: share.position,
        isOrganizer: share.position === 0,
        isYou: share.shareId === viewerId,
        label: share.position === 0
          ? 'Camille Martin'
          : isOrganizer
            ? share.name ?? share.email ?? `Ami n° ${share.position}`
            : share.name ? `${share.name.split(' ')[0]} ${share.name.split(' ')[1]?.slice(0, 1) ?? ''}.` : `Ami n° ${share.position}`,
        status: share.status,
        amountMinor: share.amountMinor,
      }
      if (!isOrganizer || share.position === 0) return base
      return {
        ...base,
        shareId: share.shareId,
        email: share.email,
        invitedAtISO: share.invitedAtISO,
        payPath: `/booking/group/gp_${share.shareId.replace('-', '')}_000000000000000000000000`,
        canResend: open && share.status === 'pending' && Boolean(share.email),
      }
    })

    return {
      role: isOrganizer ? 'organizer' : 'participant',
      status,
      processing: false,
      closeReason,
      mock: true,
      listing: { id: 'dev-apartment', title: 'Appartement les Raisins Clairs', city: 'Saint-François', image: SAMPLE_IMAGE },
      host: { name: 'Nathan' },
      stay: {
        startISO: '2027-02-12',
        endISO: '2027-02-19',
        nights: 7,
        guests: { adults: ADULTS, children: 0, infants: 0, pets: 0 },
      },
      amounts: {
        currency: 'eur',
        totalMinor: TOTAL_MINOR,
        onlineTotalMinor: TOTAL_MINOR,
        deferredMinor: 0,
        deferredMode: 'none',
        deferredDueDateISO: null,
      },
      group: {
        payers: shares.length,
        paidCount: shares.filter((share) => share.status === 'paid').length,
        expiresAtISO: expiresAt.toISOString(),
        createdAtISO: createdAt.toISOString(),
        organizerName: 'Camille Martin',
      },
      share: {
        position: viewer.position,
        status: viewer.status,
        amountMinor: viewer.amountMinor,
        name: viewer.name,
      },
      participants,
      actions: {
        canPay: open && viewer.status === 'pending',
        canInvite: open && isOrganizer,
        canCancel: isOrganizer && open,
        canAddPayer: open && isOrganizer && shares.length < ADULTS,
        canRemovePayer: open && isOrganizer && shares.length > 2 && !shares.some((share) => share.position > 0 && share.status === 'paid'),
      },
      limits: { minPayers: 2, maxPayers: ADULTS },
      cancellation: {
        summary: 'modérée',
        lines: [
          'Remboursement intégral jusqu’à 5 jours avant l’arrivée.',
          'Ensuite, 50 % du montant payé est remboursé.',
        ],
      },
      confirmationPath: isOrganizer && status === 'completed' ? '/booking/confirmation/dev?token=dev' : null,
    }
  }

  // Mêmes règles que l'API (`GroupPaymentLedger.resizeGroup`) : parts égales recalculées.
  function resplit() {
    const next = splitGroupAmount(TOTAL_MINOR, shares.length)
    shares.forEach((share, index) => {
      share.position = index
      const amountMinor = next[index] ?? 0
      if (share.status === 'paid' && amountMinor > share.amountMinor) share.status = 'pending'
      share.amountMinor = amountMinor
    })
  }

  function completeIfFull() {
    if (shares.every((share) => share.status === 'paid')) status = 'completed'
  }

  return {
    async fetchPage() {
      await wait(150)
      return build()
    },
    async createShareIntent(_key, input) {
      await wait(200)
      const viewer = shares.find((share) => share.shareId === viewerId)
      if (viewer && input.name) viewer.name = input.name
      return {
        paymentIntentId: 'pi_mock_dev',
        clientSecret: 'pi_mock_dev_secret_mock',
        connectedAccountId: null,
        amountMinor: viewer?.amountMinor ?? 0,
        currency: 'eur',
        mock: true,
      }
    },
    async confirmShare() {
      await wait(300)
      const viewer = shares.find((share) => share.shareId === viewerId)
      if (viewer) viewer.status = 'paid'
      completeIfFull()
      return build()
    },
    async invite(_key, invitations: GroupInvitationInput[]) {
      await wait(300)
      const emails = new Set<string>()
      for (const invitation of invitations) {
        if (emails.has(invitation.email)) throw new Error('Chaque ami doit avoir sa propre adresse e-mail.')
        emails.add(invitation.email)
        const share = shares.find((item) => item.shareId === invitation.shareId)
        if (!share) continue
        share.email = invitation.email
        share.invitedAtISO = new Date().toISOString()
      }
      return build()
    },
    async changePayers(_key, change) {
      await wait(300)
      if (change.action === 'add') {
        if (shares.length >= ADULTS) throw new Error(`Le paiement à plusieurs se fait à ${ADULTS} personnes au plus pour ce séjour.`)
        shareSequence += 1
        shares.push({ shareId: `share-${shareSequence}`, position: shares.length, name: null, email: null, invitedAtISO: null, status: 'pending', amountMinor: 0 })
      } else {
        if (shares.some((share) => share.position > 0 && share.status === 'paid')) {
          throw new Error('Un ami a déjà réglé sa part : les parts ne peuvent plus augmenter.')
        }
        const index = shares.findIndex((share) => share.shareId === change.shareId)
        if (index > 0) shares.splice(index, 1)
      }
      resplit()
      return build()
    },
    async cancel() {
      await wait(300)
      shares.forEach((share) => {
        if (share.status === 'paid') share.status = 'released'
      })
      status = 'canceled'
      closeReason = 'organizer'
      return build()
    },
  }
}
