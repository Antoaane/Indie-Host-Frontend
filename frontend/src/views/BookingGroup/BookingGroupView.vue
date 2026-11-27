<!-- File: src/views/BookingGroup/BookingGroupView.vue -->

<script setup lang="ts">
// Paiement à plusieurs : page ouverte par le lien personnel d'une part (`/booking/group/<clé>`),
// sans compte. L'organisateur y invite ses amis et suit les paiements ; chaque ami y règle sa part.
// Règles et délais : `domain/payments/groupPayment.ts` (copie de l'API).
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CalendarDays, Check, ChevronDown, Clock, Copy, Send, Users } from '@lucide/vue'

import ConfirmationDialog from '@/components/overlays/ConfirmationDialog.vue'
import LegalLinksCompact from '@/components/layouts/LegalLinksCompact.vue'
import {
  groupPaymentApi,
  type GroupInvitationInput,
  type GroupParticipant,
  type GroupPaymentPage,
  type GroupPaymentSource,
} from '@/domain/api/groupPayments'
import { formatGroupTimeLeft, normalizeParticipantEmail } from '@/domain/payments/groupPayment'
import GroupSharePayment from '@/views/BookingGroup/components/GroupSharePayment.vue'

const props = withDefaults(
  defineProps<{
    /** Appels de la page : l'API, ou de fausses données sur la route de développement. */
    source?: GroupPaymentSource
    /** Clé de la part, à la place du paramètre d'adresse (route de développement). */
    shareKey?: string
  }>(),
  { source: () => groupPaymentApi, shareKey: '' },
)

const route = useRoute()
const router = useRouter()

const shareKey = computed(() => {
  if (props.shareKey) return props.shareKey
  const value = route.params.shareKey
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
})

const page = ref<GroupPaymentPage | null>(null)
const loadError = ref<string | null>(null)
const isLoading = ref(true)
const now = ref(Date.now())

// --- Chargement et suivi en direct ---------------------------------------------------------------

let refreshTimer: ReturnType<typeof setTimeout> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null

async function load(options?: { silent?: boolean }) {
  if (!shareKey.value) {
    loadError.value = 'Ce lien n’est pas complet. Ouvrez celui reçu par e-mail.'
    isLoading.value = false
    return
  }
  if (!options?.silent) isLoading.value = true
  try {
    page.value = await props.source.fetchPage(shareKey.value)
    loadError.value = null
  } catch (error) {
    if (!options?.silent || !page.value) {
      loadError.value = error instanceof Error ? error.message : 'Impossible de charger ce paiement à plusieurs.'
    }
  } finally {
    isLoading.value = false
    scheduleRefresh()
  }
}

// Tant que le groupe paie, la page se met à jour seule : l'organisateur voit arriver les parts.
function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer)
  const current = page.value
  if (!current || current.status !== 'pending' && !current.processing) return
  refreshTimer = setTimeout(() => {
    if (typeof document !== 'undefined' && document.hidden) {
      scheduleRefresh()
      return
    }
    void load({ silent: true })
  }, current.processing ? 5_000 : 20_000)
}

// Retour d'une validation bancaire (3-D Secure) qui a quitté la page : la part est relue chez Stripe.
async function handleStripeReturn(): Promise<boolean> {
  if (typeof route.query.payment_intent !== 'string' && typeof route.query.redirect_status !== 'string') return false
  try {
    page.value = await props.source.confirmShare(shareKey.value)
    loadError.value = null
  } catch {
    // La page se charge normalement ; la tâche planifiée relira la part dans les minutes qui suivent.
  }
  await router.replace({ query: {} })
  return Boolean(page.value)
}

onMounted(async () => {
  clockTimer = setInterval(() => {
    now.value = Date.now()
  }, 30_000)
  if (await handleStripeReturn()) {
    isLoading.value = false
    scheduleRefresh()
    return
  }
  await load()
})

onBeforeUnmount(() => {
  if (refreshTimer) clearTimeout(refreshTimer)
  if (clockTimer) clearInterval(clockTimer)
})

// --- Formats -------------------------------------------------------------------------------------

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const eurosWithCents = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const stayDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })
const deadlineFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

function formatMinor(amountMinor: number): string {
  return amountMinor % 100 === 0 ? euros.format(amountMinor / 100) : eurosWithCents.format(amountMinor / 100)
}

function formatStayDate(iso: string): string {
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? iso : stayDate.format(parsed)
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

// --- État de la page -----------------------------------------------------------------------------

const isOrganizer = computed(() => page.value?.role === 'organizer')
const isOpen = computed(() => page.value?.status === 'pending' && !page.value.processing)
const missingCount = computed(() => (page.value ? page.value.group.payers - page.value.group.paidCount : 0))
const progressPercent = computed(() => {
  if (!page.value || page.value.group.payers <= 0) return 0
  return Math.round((page.value.group.paidCount / page.value.group.payers) * 100)
})
const msLeft = computed(() => (page.value ? Date.parse(page.value.group.expiresAtISO) - now.value : 0))
const timeLeftLabel = computed(() => formatGroupTimeLeft(msLeft.value))
const deadlineLabel = computed(() => (page.value ? deadlineFormat.format(new Date(page.value.group.expiresAtISO)) : ''))
const isUrgent = computed(() => msLeft.value > 0 && msLeft.value <= 6 * 60 * 60 * 1000)

const stayLabel = computed(() => {
  if (!page.value) return ''
  const { startISO, endISO, nights } = page.value.stay
  return `Du ${formatStayDate(startISO)} au ${formatStayDate(endISO)} · ${plural(nights, 'nuit')}`
})

const guestsLabel = computed(() => {
  if (!page.value) return ''
  const { adults, children, infants, pets } = page.value.stay.guests
  return [
    adults ? plural(adults, 'adulte') : '',
    children ? plural(children, 'enfant') : '',
    infants ? plural(infants, 'bébé') : '',
    pets ? plural(pets, 'animal', 'animaux') : '',
  ].filter(Boolean).join(', ')
})

const heading = computed(() => {
  const current = page.value
  if (!current) return { eyebrow: 'Paiement à plusieurs', title: '', text: '' }
  const organizer = current.group.organizerName
  const share = formatMinor(current.share.amountMinor)

  if (current.processing && current.status === 'pending') {
    return {
      eyebrow: 'Paiement à plusieurs',
      title: 'Toutes les parts sont réglées',
      text: 'La réservation est en cours de confirmation. Cette page se met à jour toute seule.',
    }
  }
  if (current.status === 'completed') {
    return {
      eyebrow: 'Réservation confirmée',
      title: 'Le groupe est complet',
      text: isOrganizer.value
        ? `Les ${current.group.payers} parts sont réglées et débitées. Vous avez reçu la confirmation par e-mail, avec le guide d’arrivée.`
        : `Les ${current.group.payers} parts sont réglées : votre part de ${share} est débitée. ${organizer} a reçu la confirmation et le guide d’arrivée.`,
    }
  }
  if (current.status === 'expired') {
    return {
      eyebrow: 'Réservation annulée',
      title: 'Le groupe n’a pas été complété à temps',
      text: 'Toutes les parts n’ont pas été réglées dans le délai : la réservation est annulée et personne n’a été débité.',
    }
  }
  if (current.status === 'canceled') {
    return {
      eyebrow: 'Réservation annulée',
      title: 'La réservation est annulée',
      text: current.closeReason === 'host'
        ? 'L’hôte a annulé la réservation avant que le groupe ait fini de payer. Personne n’a été débité.'
        : `${isOrganizer.value ? 'Vous avez' : `${organizer} a`} annulé la réservation avant que le groupe ait fini de payer. Personne n’a été débité.`,
    }
  }
  if (isOrganizer.value) {
    return {
      eyebrow: 'Paiement à plusieurs',
      title: missingCount.value > 0 ? 'Invitez vos amis à régler leur part' : 'Toutes les parts sont réglées',
      text: `Votre part est enregistrée et les dates sont bloquées pour votre groupe. Chaque ami reçoit un lien pour régler sa part.`,
    }
  }
  if (current.share.status === 'paid') {
    return {
      eyebrow: 'Paiement à plusieurs',
      title: 'Votre part est réglée',
      text: `Merci ! Votre carte est autorisée, pas débitée : le débit n’a lieu que lorsque les ${current.group.payers} parts sont réglées.`,
    }
  }
  return {
    eyebrow: 'Paiement à plusieurs',
    title: `${organizer} vous invite à régler votre part`,
    text: `${organizer} a réservé ce séjour et partage le paiement entre ${current.group.payers} personnes.`,
  }
})

const amountRows = computed(() => {
  const current = page.value
  if (!current) return []
  const rows = [
    { label: 'À régler en ligne par le groupe', value: `${formatMinor(current.amounts.onlineTotalMinor)}, en ${plural(current.group.payers, 'part')}` },
    { label: 'Votre part', value: formatMinor(current.share.amountMinor), strong: true },
  ]
  if (current.amounts.deferredMinor > 0) {
    const due = current.amounts.deferredMode === 'cash'
      ? 'en espèces à l’arrivée'
      : current.amounts.deferredDueDateISO
        ? `avant le ${formatStayDate(current.amounts.deferredDueDateISO)}`
        : 'avant l’arrivée'
    rows.push({ label: 'Solde, réglé par la personne qui a réservé', value: `${formatMinor(current.amounts.deferredMinor)}, ${due}` })
  }
  return rows
})

// Groupe clos : une part réglée a été levée (rien débité), une part jamais réglée n'attend plus rien.
function participantStatusLabel(participant: GroupParticipant): string {
  if (participant.status === 'paid') return 'Réglée'
  if (participant.status === 'released') return 'Non débitée'
  return page.value?.status === 'pending' ? 'En attente' : 'Non réglée'
}

function participantStatusClass(participant: GroupParticipant): string {
  if (participant.status === 'pending' && page.value?.status !== 'pending') return 'is-released'
  return `is-${participant.status}`
}

// --- Invitations (organisateur) --------------------------------------------------------------------

const friends = computed(() => (page.value?.participants ?? []).filter((participant) => !participant.isOrganizer))
const pendingFriends = computed(() => friends.value.filter((participant) => participant.status === 'pending' && participant.shareId))
const drafts = reactive<Record<string, string>>({})
const inviteState = reactive({
  isSending: false,
  error: null as string | null,
  success: null as string | null,
  copiedShareId: null as string | null,
})

watch(
  pendingFriends,
  (list) => {
    list.forEach((participant) => {
      const id = participant.shareId as string
      if (drafts[id] === undefined) drafts[id] = participant.email ?? ''
    })
  },
  { immediate: true },
)

function draftChanged(participant: GroupParticipant): boolean {
  const id = participant.shareId as string
  const draft = (drafts[id] ?? '').trim().toLowerCase()
  return Boolean(draft) && draft !== (participant.email ?? '').toLowerCase()
}

const canManageInvitations = computed(() => isOrganizer.value && isOpen.value && pendingFriends.value.length > 0)

function isInviteRow(participant: GroupParticipant): boolean {
  return canManageInvitations.value && !participant.isOrganizer && participant.status === 'pending' && Boolean(participant.shareId)
}

const invitationsToSend = computed(() => pendingFriends.value.filter((participant) => draftChanged(participant)))
const notInvitedCount = computed(() => pendingFriends.value.filter((participant) => !participant.invitedAtISO).length)

function resetInviteFeedback() {
  inviteState.error = null
  inviteState.success = null
}

async function sendInvitations(list: GroupInvitationInput[]) {
  if (!list.length || inviteState.isSending) return
  inviteState.isSending = true
  resetInviteFeedback()
  try {
    page.value = await props.source.invite(shareKey.value, list)
    inviteState.success = list.length > 1
      ? `${list.length} invitations envoyées.`
      : 'Invitation envoyée.'
  } catch (error) {
    inviteState.error = error instanceof Error ? error.message : 'Impossible d’envoyer les invitations.'
  } finally {
    inviteState.isSending = false
  }
}

function submitInvitations() {
  resetInviteFeedback()
  const list: GroupInvitationInput[] = []
  const seen = new Set<string>()
  for (const participant of pendingFriends.value) {
    const id = participant.shareId as string
    const raw = (drafts[id] ?? '').trim()
    if (!raw) continue
    const email = normalizeParticipantEmail(raw)
    if (!email) {
      inviteState.error = `L’adresse « ${raw} » n’est pas valide.`
      return
    }
    if (seen.has(email)) {
      inviteState.error = 'Chaque ami doit avoir sa propre adresse e-mail.'
      return
    }
    seen.add(email)
    if (draftChanged(participant)) list.push({ shareId: id, email })
  }
  if (!list.length) {
    inviteState.error = 'Saisissez l’adresse e-mail d’au moins un ami.'
    return
  }
  void sendInvitations(list)
}

function resend(participant: GroupParticipant) {
  if (!participant.shareId || !participant.email) return
  void sendInvitations([{ shareId: participant.shareId, email: participant.email, resend: true }])
}

async function copyLink(participant: GroupParticipant) {
  if (!participant.payPath || typeof window === 'undefined') return
  const url = new URL(participant.payPath, window.location.origin).toString()
  try {
    await navigator.clipboard.writeText(url)
    inviteState.copiedShareId = participant.shareId ?? null
    setTimeout(() => {
      if (inviteState.copiedShareId === participant.shareId) inviteState.copiedShareId = null
    }, 2500)
  } catch {
    inviteState.error = `Copie impossible : voici le lien à envoyer, ${url}`
  }
}

// --- Règlement et annulation -------------------------------------------------------------------

function onPaid(next: GroupPaymentPage) {
  page.value = next
  scheduleRefresh()
}

const isCancelDialogOpen = ref(false)
const cancelState = reactive({ isCanceling: false, error: null as string | null })

async function confirmCancel() {
  if (cancelState.isCanceling) return
  cancelState.isCanceling = true
  cancelState.error = null
  try {
    page.value = await props.source.cancel(shareKey.value)
    isCancelDialogOpen.value = false
  } catch (error) {
    cancelState.error = error instanceof Error ? error.message : 'Impossible d’annuler la réservation.'
    isCancelDialogOpen.value = false
  } finally {
    cancelState.isCanceling = false
  }
}
</script>

<template>
  <main class="booking-group-page">
    <section class="group-card">
      <p
        v-if="isLoading && !page"
        class="state"
      >
        Chargement de votre paiement à plusieurs…
      </p>
      <div
        v-else-if="loadError && !page"
        class="state is-error"
        role="alert"
      >
        <h1>Ce lien ne fonctionne pas</h1>
        <p>{{ loadError }}</p>
      </div>

      <template v-else-if="page">
        <header class="heading">
          <p class="eyebrow">{{ heading.eyebrow }}</p>
          <h1>{{ heading.title }}</h1>
          <p class="lead">{{ heading.text }}</p>
        </header>

        <div class="stay">
          <img
            v-if="page.listing.image"
            class="thumb"
            :src="page.listing.image"
            alt=""
          />
          <div class="text">
            <p class="title">{{ page.listing.title }}</p>
            <p class="line">
              <CalendarDays
                :size="14"
                aria-hidden="true"
              />
              <span>{{ stayLabel }}</span>
            </p>
            <p class="line muted">
              {{ [page.listing.city, guestsLabel, `chez ${page.host.name}`].filter(Boolean).join(' · ') }}
            </p>
          </div>
        </div>

        <section
          v-if="page.status === 'pending'"
          class="progress"
          :class="{ 'is-urgent': isUrgent }"
        >
          <div class="counts">
            <p class="paid">
              <strong>{{ page.group.paidCount }} sur {{ page.group.payers }}</strong>
              {{ page.group.paidCount > 1 ? 'parts réglées' : 'part réglée' }}
            </p>
            <p
              v-if="!page.processing"
              class="left"
            >
              <Clock
                :size="14"
                aria-hidden="true"
              />
              <span>Plus que {{ timeLeftLabel }}</span>
            </p>
          </div>
          <div
            class="track"
            role="progressbar"
            aria-label="Parts réglées"
            :aria-valuenow="page.group.paidCount"
            aria-valuemin="0"
            :aria-valuemax="page.group.payers"
          >
            <span
              class="fill"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
          <p
            v-if="!page.processing"
            class="deadline"
          >
            À compléter avant le {{ deadlineLabel }}. Sinon la réservation est annulée et personne n’est débité.
          </p>
        </section>

        <!-- Règlement de la part de cet ami. -->
        <section
          v-if="page.actions.canPay"
          class="pay"
        >
          <h2>Régler votre part : {{ formatMinor(page.share.amountMinor) }}</h2>
          <GroupSharePayment
            :share-key="shareKey"
            :source="props.source"
            :amount-label="formatMinor(page.share.amountMinor)"
            :payers="page.group.payers"
            @paid="onPaid"
          />
        </section>

        <!-- Le groupe. Pour l'organisateur, chaque ami qui n'a pas réglé porte son adresse sur sa ligne. -->
        <section class="participants">
          <h2>
            <Users
              :size="18"
              aria-hidden="true"
            />
            Le groupe
          </h2>
          <p
            v-if="canManageInvitations"
            class="hint"
          >
            Indiquez l’adresse de chaque ami : il reçoit un lien pour régler sa part, puis des rappels avant l’échéance. Vous pouvez aussi copier son lien et le lui envoyer vous-même.
          </p>
          <form
            novalidate
            @submit.prevent="submitInvitations"
          >
            <ul>
              <li
                v-for="participant in page.participants"
                :key="participant.position"
                :class="[participantStatusClass(participant), { 'has-invite': isInviteRow(participant) }]"
              >
                <span class="name">
                  {{ isInviteRow(participant) ? `Ami n° ${participant.position}` : participant.label }}
                  <span
                    v-if="participant.isYou"
                    class="you"
                  >(vous)</span>
                  <span
                    v-else-if="participant.isOrganizer"
                    class="you"
                  >(a réservé)</span>
                  <span
                    v-else-if="isInviteRow(participant)"
                    class="you"
                  >{{ participant.invitedAtISO ? 'invité' : 'pas encore invité' }}</span>
                </span>
                <span class="amount">{{ formatMinor(participant.amountMinor) }}</span>
                <span class="status">
                  <Check
                    v-if="participant.status === 'paid'"
                    :size="14"
                    aria-hidden="true"
                  />
                  {{ participantStatusLabel(participant) }}
                </span>

                <div
                  v-if="isInviteRow(participant)"
                  class="invite-row"
                >
                  <div class="field">
                    <input
                      :id="`friend-${participant.shareId}`"
                      v-model="drafts[participant.shareId as string]"
                      type="email"
                      inputmode="email"
                      autocomplete="off"
                      autocapitalize="off"
                      spellcheck="false"
                      placeholder="adresse@exemple.fr"
                      :aria-label="`Adresse e-mail de l’ami n° ${participant.position}`"
                      :disabled="inviteState.isSending"
                      @input="resetInviteFeedback"
                    />
                  </div>
                  <button
                    type="button"
                    class="icon-action"
                    :aria-label="`Copier le lien de l’ami n° ${participant.position}`"
                    :title="inviteState.copiedShareId === participant.shareId ? 'Lien copié' : 'Copier son lien'"
                    @click="copyLink(participant)"
                  >
                    <Check
                      v-if="inviteState.copiedShareId === participant.shareId"
                      :size="16"
                      aria-hidden="true"
                    />
                    <Copy
                      v-else
                      :size="16"
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    v-if="participant.canResend && !draftChanged(participant)"
                    type="button"
                    class="resend"
                    :disabled="inviteState.isSending"
                    @click="resend(participant)"
                  >
                    Renvoyer l’invitation
                  </button>
                </div>
              </li>
            </ul>

            <template v-if="canManageInvitations">
              <div class="btn-primary__full send">
                <button
                  type="submit"
                  :disabled="inviteState.isSending || !invitationsToSend.length"
                >
                  <Send
                    :size="16"
                    aria-hidden="true"
                  />
                  {{
                    inviteState.isSending
                      ? 'Envoi…'
                      : invitationsToSend.length > 1
                        ? `Envoyer ${invitationsToSend.length} invitations`
                        : 'Envoyer l’invitation'
                  }}
                </button>
              </div>
              <p
                class="feedback"
                :class="{ 'is-error': Boolean(inviteState.error) }"
                aria-live="polite"
              >
                {{ inviteState.error ?? inviteState.success ?? (notInvitedCount ? `${plural(notInvitedCount, 'ami')} à inviter.` : '') }}
              </p>
            </template>
          </form>
        </section>

        <div
          v-if="page.confirmationPath"
          class="confirmation-link btn-primary__full"
        >
          <RouterLink :to="page.confirmationPath">
            Voir ma confirmation et le guide d’arrivée
          </RouterLink>
        </div>

        <section class="details">
          <dl class="amounts">
            <div
              v-for="row in amountRows"
              :key="row.label"
              :class="{ 'is-strong': row.strong }"
            >
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </div>
          </dl>

          <details class="policy">
            <summary>
              <span>Conditions d’annulation de l’hôte ({{ page.cancellation.summary }})</span>
              <ChevronDown
                :size="16"
                aria-hidden="true"
              />
            </summary>
            <ul>
              <li
                v-for="line in page.cancellation.lines"
                :key="line"
              >
                {{ line }}
              </li>
            </ul>
            <p>Elles s’appliquent une fois la réservation confirmée. Avant, une annulation ne coûte rien à personne.</p>
          </details>
        </section>

        <section
          v-if="page.actions.canCancel"
          class="cancel"
        >
          <button
            type="button"
            :disabled="cancelState.isCanceling"
            @click="isCancelDialogOpen = true"
          >
            Annuler la réservation
          </button>
          <p
            v-if="cancelState.error"
            class="feedback is-error"
            role="alert"
          >
            {{ cancelState.error }}
          </p>
        </section>
      </template>
    </section>

    <LegalLinksCompact />

    <ConfirmationDialog
      :open="isCancelDialogOpen"
      subject="Paiement à plusieurs"
      title="Annuler la réservation ?"
      message="Personne n’est débité : les parts déjà réglées sont levées sur les cartes, et chacun est prévenu par e-mail. Les dates redeviennent disponibles."
      :confirm-label="cancelState.isCanceling ? 'Annulation…' : 'Oui, annuler'"
      cancel-label="Garder la réservation"
      :confirm-disabled="cancelState.isCanceling"
      :cancel-disabled="cancelState.isCanceling"
      @close="isCancelDialogOpen = false"
      @cancel="isCancelDialogOpen = false"
      @confirm="confirmCancel"
    />
  </main>
</template>

<style lang="scss">
@use '@/views/BookingGroup/booking-group.scss';
</style>
