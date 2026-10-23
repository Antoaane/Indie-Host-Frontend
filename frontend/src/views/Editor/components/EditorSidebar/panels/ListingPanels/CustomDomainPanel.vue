<!-- File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/CustomDomainPanel.vue -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch, type Component } from 'vue'
import { Check, CircleAlert, CircleCheck, Copy, Globe, Info, Link2, Settings2, ShieldCheck } from 'lucide-vue-next'

import {
  fetchListingDomain,
  removeListingCustomDomain,
  saveListingCustomDomain,
  verifyListingCustomDomain,
  type ListingCustomDomainVerification,
  type ListingDomainRecord,
} from '@/domain/api/listingDomains'
import { fetchMyStripeSubscriptionState } from '@/domain/api/stripeSubscriptions'
import { getPublicListingRootDomain } from '@/domain/listings/publicDomain'

const props = defineProps<{
  listingId: string
  isAdmin?: boolean
}>()

const emit = defineEmits<{
  (e: 'updated', domain: ListingDomainRecord): void
}>()

type DnsRecord = {
  key: string
  type: 'A' | 'CNAME' | 'TXT'
  // Nom relatif à la zone, tel que le registrar le demande (`www`, `@`, `_indiehost-verification.www`).
  name: string
  // Nom complet, pour les registrars qui attendent un nom qualifié.
  fullName: string
  value: string
}

type VerificationCheckView = {
  key: 'address' | 'ownership'
  label: string
  ok: boolean
  reason: string | null
}

const COPY_FEEDBACK_MS = 2000

type GuideStep = {
  key: string
  icon: Component
  title: string
  description: string
}

type GuideStepState = 'done' | 'active' | 'todo'

// Le guide ne s'ouvre plus tout seul : il reste disponible derrière le bouton d'aide.
const GUIDE_AUTO_OPEN_LIMIT = 0
const GUIDE_AUTO_OPEN_STORAGE_KEY = 'indiehost:custom-domain-guide:auto-opens'
let hasAutoOpenedGuideThisSession = false

const guideSteps: GuideStep[] = [
  {
    key: 'own',
    icon: Globe,
    title: 'Choisissez le domaine à utiliser',
    description: 'Vous l’avez acheté chez un registrar (OVH, Gandi, IONOS, GoDaddy…). Préférez l’adresse avec www, par exemple www.gite-belair.fr : c’est la plus simple à configurer.',
  },
  {
    key: 'attach',
    icon: Link2,
    title: 'Rattachez-le à cette annonce',
    description: 'Saisissez-le ci-dessous puis cliquez sur « Rattacher ce domaine ». IndieHost vous indique alors les deux enregistrements DNS exacts à créer.',
  },
  {
    key: 'dns',
    icon: Settings2,
    title: 'Créez les deux enregistrements DNS chez votre registrar',
    description: 'Dans votre espace client, ouvrez la zone DNS du domaine et ajoutez les enregistrements affichés (type, nom, valeur) : le A ou CNAME fait pointer le domaine vers IndieHost, le TXT prouve que vous êtes bien propriétaire du domaine. La propagation prend de quelques minutes à 24 h.',
  },
  {
    key: 'verify',
    icon: ShieldCheck,
    title: 'Vérifiez : votre annonce est en ligne',
    description: 'Cliquez sur « Vérifier la configuration DNS ». Le résultat de chaque enregistrement s’affiche. Une fois les deux validés, le certificat HTTPS est généré automatiquement et votre annonce répond sur votre domaine.',
  },
]

const guideId = useId()
const guideToggleRef = ref<HTMLButtonElement | null>(null)
const isGuideOpen = ref(false)

const domainInput = ref('')
const currentDomain = ref<ListingDomainRecord | null>(null)
const isLoadingCurrent = ref(false)
const isLoadingSubscription = ref(false)
const isSaving = ref(false)
const isVerifying = ref(false)
const isDeleting = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const hasSelectedPlan = ref(false)
// Dernier résultat de « Vérifier » : l'état de chaque enregistrement reste affiché jusqu'au prochain changement.
const lastVerification = ref<ListingCustomDomainVerification | null>(null)
const copiedRecordKey = ref<string | null>(null)
const copyFeedback = ref<string | null>(null)
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

const rootDomain = getPublicListingRootDomain()
const normalizedDomain = computed(() => normalizeDomainInput(domainInput.value))
const canManageDomain = computed(() => Boolean(props.isAdmin || (hasSelectedPlan.value && !isLoadingSubscription.value)))
const attachedDomain = computed(() => currentDomain.value?.customDomain ?? null)
const status = computed(() => currentDomain.value?.customDomainStatus ?? 'none')
const isVerified = computed(() => status.value === 'verified')
const targets = computed(() => currentDomain.value?.customDomainTargets ?? { ipv4: null, cname: null })
const isDirty = computed(() => Boolean(normalizedDomain.value) && normalizedDomain.value !== attachedDomain.value)
const canSave = computed(() => canManageDomain.value && isValidDomain(normalizedDomain.value) && isDirty.value)

const guideToggleLabel = computed(() => (isGuideOpen.value ? 'Masquer le guide' : 'Comment rattacher mon domaine ?'))

const statusLabel = computed(() => {
  if (status.value === 'verified') return 'Actif'
  if (status.value === 'pending') return 'En attente de la configuration DNS'
  return 'Aucun domaine rattaché'
})

// L'étape mise en avant suit l'état réel : rien → 1, domaine saisi → 2, en attente DNS → 3, vérifié → tout est fait.
const activeGuideStepIndex = computed(() => {
  if (status.value === 'verified') return guideSteps.length
  if (status.value === 'pending') return 2
  return normalizedDomain.value ? 1 : 0
})

// Nom relatif à la zone (`www`, `@`, `_indiehost-verification.www`) à partir d'un nom complet et de son apex.
function toZoneRelativeName(fullName: string, apex: string): string {
  if (fullName === apex) return '@'
  return fullName.endsWith(`.${apex}`) ? fullName.slice(0, -(apex.length + 1)) : fullName
}

// Enregistrements à créer chez le registrar : CNAME pour un sous-domaine (www…) ou A pour un domaine nu,
// puis le TXT de propriété dès que le domaine est rattaché (le jeton vient de l'API).
const dnsRecords = computed<DnsRecord[]>(() => {
  const domain = attachedDomain.value ?? (isValidDomain(normalizedDomain.value) ? normalizedDomain.value : '')
  if (!domain) return []

  const labels = domain.split('.')
  const apex = labels.slice(-2).join('.')
  const name = toZoneRelativeName(domain, apex)
  const records: DnsRecord[] = []

  if (name !== '@' && targets.value.cname) {
    records.push({ key: 'address', type: 'CNAME', name, fullName: domain, value: targets.value.cname })
  } else if (targets.value.ipv4) {
    records.push({ key: 'address', type: 'A', name, fullName: domain, value: targets.value.ipv4 })
  }

  const txt = currentDomain.value?.customDomainVerificationRecord
  const txtName = txt?.names[0]
  if (txt && txtName && attachedDomain.value === domain) {
    records.push({ key: 'ownership', type: 'TXT', name: toZoneRelativeName(txtName, apex), fullName: txtName, value: txt.value })
  }

  return records
})

const hasTxtRecord = computed(() => dnsRecords.value.some((record) => record.type === 'TXT'))

// Pour `www.x.fr`, le TXT peut aussi être posé sur l'apex : il vaut alors pour `www.x.fr` et `x.fr`.
const txtApexAlternative = computed(() => currentDomain.value?.customDomainVerificationRecord?.names[1] ?? null)

const verificationChecks = computed<VerificationCheckView[]>(() => {
  const verification = lastVerification.value
  if (!verification || isVerified.value) return []

  const addressRecord = dnsRecords.value.find((record) => record.key === 'address')
  return [
    {
      key: 'address',
      label: `Enregistrement ${addressRecord?.type ?? 'A / CNAME'} (pointage vers IndieHost)`,
      ok: verification.checks.address.ok,
      reason: verification.checks.address.reason,
    },
    {
      key: 'ownership',
      label: 'Enregistrement TXT (preuve de propriété)',
      ok: verification.checks.ownership.ok,
      reason: verification.checks.ownership.reason,
    },
  ]
})

function clearCopyFeedback() {
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer)
    copyFeedbackTimer = null
  }
  copiedRecordKey.value = null
  copyFeedback.value = null
}

async function writeToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }

    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}

async function copyRecordValue(record: DnsRecord) {
  clearCopyFeedback()
  const copied = await writeToClipboard(record.value)

  if (copied) {
    copiedRecordKey.value = record.key
    copyFeedback.value = `Valeur de l’enregistrement ${record.type} copiée.`
  } else {
    copyFeedback.value = 'Copie impossible : sélectionnez la valeur puis copiez-la manuellement.'
  }

  copyFeedbackTimer = setTimeout(clearCopyFeedback, COPY_FEEDBACK_MS)
}

function guideStepState(index: number): GuideStepState {
  if (index < activeGuideStepIndex.value) return 'done'
  if (index === activeGuideStepIndex.value) return 'active'
  return 'todo'
}

function readGuideAutoOpenCount(): number {
  try {
    const parsed = Number.parseInt(window.localStorage.getItem(GUIDE_AUTO_OPEN_STORAGE_KEY) ?? '0', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  } catch {
    return 0
  }
}

function writeGuideAutoOpenCount(count: number) {
  try {
    window.localStorage.setItem(GUIDE_AUTO_OPEN_STORAGE_KEY, String(count))
  } catch {
    // Stockage indisponible (navigation privée) : le guide s'ouvre quand même, sans mémoire.
  }
}

function maybeAutoOpenGuide() {
  if (hasAutoOpenedGuideThisSession || typeof window === 'undefined') return
  if (attachedDomain.value) return

  const count = readGuideAutoOpenCount()
  if (count >= GUIDE_AUTO_OPEN_LIMIT) return

  hasAutoOpenedGuideThisSession = true
  writeGuideAutoOpenCount(count + 1)
  isGuideOpen.value = true
}

function toggleGuide() {
  isGuideOpen.value = !isGuideOpen.value
}

function closeGuide() {
  isGuideOpen.value = false
  guideToggleRef.value?.focus()
}

function normalizeDomainInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    ?.split(':')[0]
    ?.replace(/\.$/, '') ?? ''
}

function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false
  const labels = domain.split('.')
  if (labels.length < 2) return false
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
}

function resetFeedback() {
  errorMessage.value = null
  successMessage.value = null
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return fallback
}

function applyRecord(domain: ListingDomainRecord) {
  currentDomain.value = domain
  domainInput.value = domain.customDomain ?? ''
  emit('updated', domain)
}

async function loadCurrentDomain() {
  if (!props.listingId.trim()) return

  resetFeedback()
  lastVerification.value = null
  currentDomain.value = null
  domainInput.value = ''
  isLoadingCurrent.value = true

  try {
    const domain = await fetchListingDomain(props.listingId)
    currentDomain.value = domain
    domainInput.value = domain.customDomain ?? ''
  } catch (error) {
    console.error('[EditorCustomDomainPanel] failed to load current domain', error)
    errorMessage.value = resolveErrorMessage(error, 'Impossible de charger le domaine actuel.')
  } finally {
    isLoadingCurrent.value = false
    maybeAutoOpenGuide()
  }
}

function computeHasSelectedPlanFromBillingState(state: Awaited<ReturnType<typeof fetchMyStripeSubscriptionState>>) {
  const activePlan = state.subscription?.planCode ?? null
  const pendingPlan = state.subscription?.pendingPlanCode ?? null
  const currentPlan = state.currentPlanCode ?? null
  return Boolean(activePlan || pendingPlan || currentPlan)
}

async function loadSubscriptionState() {
  isLoadingSubscription.value = true
  try {
    const billingState = await fetchMyStripeSubscriptionState({ sync: false })
    hasSelectedPlan.value = computeHasSelectedPlanFromBillingState(billingState)
  } catch (error) {
    console.error('[EditorCustomDomainPanel] failed to load subscription state', error)
    hasSelectedPlan.value = false
  } finally {
    isLoadingSubscription.value = false
  }
}

async function saveDomain() {
  if (isSaving.value) return

  resetFeedback()

  if (!canManageDomain.value) {
    errorMessage.value = 'Sélectionnez un plan d abonnement pour rattacher un nom de domaine.'
    return
  }

  if (!isValidDomain(normalizedDomain.value)) {
    errorMessage.value = 'Saisissez un nom de domaine valide, par exemple www.gite-belair.fr.'
    return
  }

  if (!isDirty.value) return

  isSaving.value = true
  try {
    const domain = await saveListingCustomDomain(props.listingId, normalizedDomain.value)
    lastVerification.value = null
    applyRecord(domain)
    successMessage.value = domain.customDomainStatus === 'verified'
      ? `${domain.customDomain} est rattaché et déjà actif.`
      : `${domain.customDomain} est rattaché. Créez les deux enregistrements DNS ci-dessous puis vérifiez la configuration.`
  } catch (error) {
    console.error('[EditorCustomDomainPanel] failed to save custom domain', error)
    errorMessage.value = resolveErrorMessage(error, 'Impossible de rattacher ce nom de domaine.')
  } finally {
    isSaving.value = false
  }
}

async function verifyDomain() {
  if (isVerifying.value || !attachedDomain.value) return

  resetFeedback()
  isVerifying.value = true
  try {
    const { record, verification } = await verifyListingCustomDomain(props.listingId)
    applyRecord(record)
    lastVerification.value = verification
    if (verification.ok) {
      successMessage.value = `Configuration DNS validée : ${record.customDomain} est actif. Le certificat HTTPS est généré dans les minutes qui suivent.`
      return
    }
    // Le détail par enregistrement est affiché dans la liste des contrôles ; ici, le résumé.
    const failing = [verification.checks.address, verification.checks.ownership].filter((check) => !check.ok).length
    errorMessage.value = failing === 2
      ? 'Aucun des deux enregistrements n’est encore en place. Vérifiez chaque ligne ci-dessous.'
      : 'Un enregistrement manque encore. Vérifiez la ligne signalée ci-dessous.'
  } catch (error) {
    console.error('[EditorCustomDomainPanel] failed to verify custom domain', error)
    errorMessage.value = resolveErrorMessage(error, 'Impossible de vérifier la configuration DNS.')
  } finally {
    isVerifying.value = false
  }
}

async function deleteDomain() {
  if (isDeleting.value || !attachedDomain.value) return

  resetFeedback()
  isDeleting.value = true
  try {
    const domain = await removeListingCustomDomain(props.listingId)
    lastVerification.value = null
    applyRecord(domain)
    successMessage.value = 'Le nom de domaine a été détaché de cette annonce.'
  } catch (error) {
    console.error('[EditorCustomDomainPanel] failed to remove custom domain', error)
    errorMessage.value = resolveErrorMessage(error, 'Impossible de détacher ce nom de domaine.')
  } finally {
    isDeleting.value = false
  }
}

watch(
  () => props.listingId,
  () => {
    void loadSubscriptionState()
    void loadCurrentDomain()
  },
)

watch(domainInput, () => {
  errorMessage.value = null
  successMessage.value = null
})

onMounted(() => {
  void loadSubscriptionState()
  void loadCurrentDomain()
})

onBeforeUnmount(() => {
  clearCopyFeedback()
})
</script>

<template>
  <section class="editor-custom-domain-panel">
    <div class="header">
      <div class="main">
        <h3>Votre propre nom de domaine</h3>
        <p>Un domaine que vous possédez déjà (ex. www.gite-belair.fr), relié en quatre étapes via le bouton d’aide.</p>
      </div>

      <div class="header-actions">
        <div class="guide-toggle">
          <button
            ref="guideToggleRef"
            type="button"
            :aria-expanded="isGuideOpen"
            :aria-controls="guideId"
            :aria-label="guideToggleLabel"
            :title="guideToggleLabel"
            @click="toggleGuide"
          >
            <Info :size="17" />
          </button>
        </div>
      </div>
    </div>

    <div
      :id="guideId"
      class="guide"
      :class="{ 'is-open': isGuideOpen }"
      role="region"
      aria-label="Comment rattacher votre nom de domaine"
      :inert="!isGuideOpen"
    >
      <div class="guide-inner">
        <div class="guide-card">
          <p class="guide-intro">Quatre étapes, une dizaine de minutes chez votre registrar.</p>

          <ol class="guide-steps">
            <li
              v-for="(step, index) in guideSteps"
              :key="step.key"
              class="guide-step"
              :class="`is-${guideStepState(index)}`"
            >
              <span
                class="marker"
                aria-hidden="true"
              >
                <component
                  :is="step.icon"
                  :size="16"
                />
              </span>
              <div class="content">
                <h4>{{ step.title }}</h4>
                <p>{{ step.description }}</p>
              </div>
            </li>
          </ol>

          <div class="guide-footer">
            <div class="close">
              <button
                type="button"
                @click="closeGuide"
              >
                Fermer le guide
              </button>
            </div>
            <p>Il reste disponible à tout moment via le bouton d’aide.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="body">
      <div class="input">
        <input
          v-model="domainInput"
          type="text"
          placeholder="ex: www.gite-belair.fr"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          inputmode="url"
          enterkeyhint="done"
          :disabled="isLoadingCurrent || (!props.isAdmin && isLoadingSubscription) || !canManageDomain"
          @keydown.enter.prevent="saveDomain"
        />
      </div>

      <div class="actions">
        <div class="manage">
          <button
            type="button"
            :disabled="!canSave || isSaving"
            @click="saveDomain"
          >
            {{ isSaving ? 'Rattachement...' : (attachedDomain ? 'Changer de domaine' : 'Rattacher ce domaine') }}
          </button>
        </div>

        <div
          v-if="attachedDomain"
          class="checkout"
        >
          <button
            type="button"
            :disabled="isVerifying || isVerified"
            @click="verifyDomain"
          >
            {{ isVerifying ? 'Vérification...' : (isVerified ? 'DNS vérifié' : 'Vérifier la configuration DNS') }}
          </button>
        </div>

        <div
          v-if="attachedDomain"
          class="checkout"
        >
          <button
            type="button"
            :disabled="isDeleting"
            @click="deleteDomain"
          >
            {{ isDeleting ? 'Suppression...' : 'Détacher le domaine' }}
          </button>
        </div>
      </div>

      <div
        v-if="attachedDomain"
        class="availability"
      >
        <p><strong>Domaine :</strong> {{ attachedDomain }}</p>
        <p>
          <strong>Statut :</strong>
          <span :class="['status', `is-${status}`]">{{ statusLabel }}</span>
        </p>
        <p v-if="isVerified && currentDomain?.customDomainUrl">
          <strong>URL :</strong>
          <a
            :href="currentDomain.customDomainUrl"
            target="_blank"
            rel="noreferrer"
          >
            {{ currentDomain.customDomainUrl }}
          </a>
        </p>
      </div>

      <div
        v-if="dnsRecords.length"
        class="dns"
      >
        <p class="dns-title">
          {{ hasTxtRecord ? 'Enregistrements à créer' : 'Enregistrement à créer' }} dans la zone DNS de votre registrar (OVH, Gandi, IONOS, GoDaddy…)
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Nom</th>
              <th scope="col">Valeur</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="record in dnsRecords"
              :key="record.key"
            >
              <td>{{ record.type }}</td>
              <td>
                <code>{{ record.name }}</code>
                <small v-if="record.name !== record.fullName">{{ record.fullName }}</small>
              </td>
              <td>
                <div class="value">
                  <code>{{ record.value }}</code>
                  <div class="copy">
                    <button
                      type="button"
                      :aria-label="copiedRecordKey === record.key ? 'Valeur copiée' : `Copier la valeur de l’enregistrement ${record.type}`"
                      :title="copiedRecordKey === record.key ? 'Copié' : 'Copier la valeur'"
                      @click="copyRecordValue(record)"
                    >
                      <Check
                        v-if="copiedRecordKey === record.key"
                        :size="15"
                      />
                      <Copy
                        v-else
                        :size="15"
                      />
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="hasTxtRecord"
          class="dns-hint"
        >
          L’enregistrement TXT prouve que vous êtes bien propriétaire du domaine : sans lui, n’importe qui pourrait rattacher votre domaine à son annonce.
          <template v-if="txtApexAlternative">
            Vous pouvez aussi le placer sur <code>{{ txtApexAlternative }}</code> (sans www) : il vaut alors pour les deux adresses.
          </template>
        </p>
        <p class="dns-hint">
          La propagation DNS prend de quelques minutes à 24 h. Une fois vérifié, le certificat HTTPS est généré automatiquement.
        </p>
        <p
          class="sr-only"
          role="status"
          aria-live="polite"
        >
          {{ copyFeedback ?? '' }}
        </p>
      </div>

      <ul
        v-if="verificationChecks.length"
        class="checks"
        aria-label="Résultat de la vérification DNS"
      >
        <li
          v-for="check in verificationChecks"
          :key="check.key"
          :class="check.ok ? 'is-ok' : 'is-missing'"
        >
          <span
            class="icon"
            aria-hidden="true"
          >
            <CircleCheck
              v-if="check.ok"
              :size="16"
            />
            <CircleAlert
              v-else
              :size="16"
            />
          </span>
          <div class="content">
            <p class="label">
              {{ check.label }} : <strong>{{ check.ok ? 'OK' : 'manquant' }}</strong>
            </p>
            <p
              v-if="!check.ok && check.reason"
              class="reason"
            >
              {{ check.reason }}
            </p>
          </div>
        </li>
      </ul>

      <p
        v-if="!isLoadingSubscription && !props.isAdmin && !hasSelectedPlan"
        class="meta is-error"
      >
        Sélectionnez d abord un plan d abonnement pour rattacher un nom de domaine.
      </p>
      <p
        v-if="isLoadingSubscription"
        class="meta"
      >
        Vérification du plan en cours...
      </p>
      <p
        v-if="successMessage"
        class="meta is-success"
        role="status"
      >
        {{ successMessage }}
      </p>
      <p
        v-if="isLoadingCurrent"
        class="meta"
      >
        Chargement du domaine actuel...
      </p>
      <p
        v-if="errorMessage"
        class="meta is-error"
        role="alert"
      >
        {{ errorMessage }}
      </p>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/styles/variables/globals' as *;
@use '@/styles/variables/borders' as borders;
@use '@/styles/variables/animations' as animations;
@use '@/styles/components/buttons' as buttons;
@use '@/styles/components/inputs' as inputs;
@use '@/views/Editor/components/EditorSidebar/panels/panel.scss' as *;

.editor-custom-domain-panel {
  @extend %panel;

  > .header {
    margin-bottom: var(--layout-gap);

    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--layout-gap-sm);

    > .main {
      min-width: 0;
      flex: 1 1 auto;

      > h3 {
        @extend %panel-title;
      }

      > p {
        @extend %panel-subtitle;
      }
    }

    > .header-actions {
      flex: 0 0 auto;

      > .guide-toggle {
        @include buttons.primary($theme: white, $icon-only: true, $deep: true);

        > * {
          width: 2.5rem;
          height: 2.5rem;

          @media (pointer: coarse) {
            width: 2.75rem;
            height: 2.75rem;
          }
        }

        // Bouton d'aide « enfoncé » tant que le guide est ouvert : même rendu que le survol.
        > [aria-expanded='true'] {
          color: $accent;
          background-color: $secondary-button-reference;

          * {
            color: $accent;
            stroke: $accent;
          }
        }
      }
    }
  }

  // Dépliage du guide : une seule animation, hauteur par grille (pas de mesure JS) + opacité.
  // Propriétés de mise en page passées explicitement ; la fermeture est plus rapide.
  > .guide {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    @include animations.transition(animations.$duration-exit, animations.$ease-out, (grid-template-rows, opacity, margin-bottom));

    &.is-open {
      grid-template-rows: 1fr;
      opacity: 1;
      margin-bottom: var(--layout-gap);
      transition-duration: animations.$duration-overlay;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }

    > .guide-inner {
      min-height: 0;
      overflow: hidden;

      > .guide-card {
        display: flex;
        flex-direction: column;
        gap: var(--layout-gap);
        padding: var(--layout-gap);
        border-radius: borders.$rounded-sm;
        border: 1px solid rgba($secondary, 0.08);
        background: rgba($secondary, 0.02);

        > .guide-intro {
          @include little-text($thin: false);
          color: rgba($secondary, 0.72);
        }

        > .guide-steps {
          margin: 0;
          padding: 0;
          list-style: none;

          display: flex;
          flex-direction: column;
          gap: var(--layout-gap);

          > .guide-step {
            position: relative;
            display: flex;
            align-items: flex-start;
            gap: var(--layout-gap-sm);

            // Fil reliant les marqueurs : la séquence se lit d'un coup d'œil.
            &:not(:last-child)::before {
              content: '';
              position: absolute;
              top: 2rem;
              bottom: calc(-1 * var(--layout-gap));
              left: calc(1rem - 0.5px);
              width: 1px;
              background: rgba($secondary, 0.12);
            }

            > .marker {
              position: relative;
              z-index: 1;
              flex: 0 0 auto;
              width: 2rem;
              height: 2rem;

              display: inline-flex;
              align-items: center;
              justify-content: center;

              border-radius: borders.$rounded;
              border: 1px solid rgba($secondary, 0.12);
              background: $accent;
              @include animations.transition();

              > svg {
                stroke: rgba($secondary, 0.7);
                @include animations.transition();
              }
            }

            > .content {
              min-width: 0;
              flex: 1 1 auto;

              display: flex;
              flex-direction: column;
              gap: var(--layout-gap-2xs);

              > h4 {
                margin: 0;
                font-weight: 600 !important;
                text-wrap: balance;
                @include h4-title();
              }

              > p {
                @include little-text($thin: false);
                color: rgba($secondary, 0.72);
              }
            }

            &.is-active > .marker {
              border-color: $secondary;
              background: $secondary;

              > svg {
                stroke: $accent;
              }
            }

            &.is-done {
              > .marker {
                border-color: rgba($good, 0.5);
                background: rgba($good, 0.2);

                > svg {
                  stroke: $secondary;
                }
              }

              > .content > h4 {
                color: rgba($secondary, 0.6);
              }
            }
          }
        }

        > .guide-footer {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: var(--layout-gap-sm);

          > .close {
            @include buttons.secondary($theme: white, $padding: false);
          }

          > p {
            @include little-text($thin: false);
            color: rgba($secondary, 0.6);
          }
        }
      }
    }
  }

  > .body {
    @extend %panel-body;

    > .input {
      @include inputs.field($theme: base);
    }

    > .actions {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xs);

      > .manage,
      > .checkout {
        @include buttons.primary($theme: white, $fullwidth: true);
      }
    }

    > .availability {
      display: flex;
      flex-direction: column;
      gap: calc(var(--layout-gap-xs) / 2);
      padding: var(--layout-gap-sm);
      border-radius: borders.$rounded-sm;
      border: 1px solid rgba($secondary, 0.1);
      background: rgba($secondary, 0.02);

      > p {
        margin: 0;
        @include little-text($thin: false);
        color: rgba($secondary, 0.82);
        word-break: break-word;

        > .status {
          &.is-verified {
            color: $good-ink;
          }

          &.is-pending {
            color: rgba($secondary, 0.7);
          }
        }
      }
    }

    > .dns {
      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xs);

      > .dns-title,
      > .dns-hint {
        margin: 0;
        @include little-text($thin: false);
        color: rgba($secondary, 0.72);
      }

      > table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid rgba($secondary, 0.1);
        border-radius: borders.$rounded-sm;
        overflow: hidden;

        th,
        td {
          padding: calc(var(--layout-gap-xs) / 2) var(--layout-gap-xs);
          text-align: left;
          @include little-text($thin: false);
          color: rgba($secondary, 0.82);
          border-bottom: 1px solid rgba($secondary, 0.08);
          word-break: break-all;
        }

        th {
          background: rgba($secondary, 0.04);
        }

        tr:last-child > td {
          border-bottom: 0;
        }

        code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          user-select: all;
        }

        // Nom complet sous le nom relatif, pour les registrars qui attendent un nom qualifié.
        td > small {
          display: block;
          @include little-text();
          color: rgba($secondary, 0.6);
        }

        // Valeur + bouton copier : la valeur garde la place, le bouton ne se rétrécit jamais.
        td > .value {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--layout-gap-xs);

          > code {
            min-width: 0;
            flex: 1 1 auto;
          }

          > .copy {
            flex: 0 0 auto;
            @include buttons.low-btn($icon-only: true, $deep: true, $borders: true, $text-color: rgba($secondary, 0.7));

            > button {
              // Icône 15 px : cible d'au moins 44 px au tact, compacte à la souris.
              width: 2rem;
              height: 2rem;

              @media (pointer: coarse) {
                width: 2.75rem;
                height: 2.75rem;
              }
            }
          }
        }
      }

      > .dns-hint > code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        color: rgba($secondary, 0.82);
        user-select: all;
      }
    }

    // Résultat de « Vérifier » : une ligne par enregistrement, OK ou manquant avec la raison.
    > .checks {
      margin: 0;
      padding: 0;
      list-style: none;

      display: flex;
      flex-direction: column;
      gap: var(--layout-gap-xs);

      > li {
        display: flex;
        align-items: flex-start;
        gap: var(--layout-gap-xs);
        padding: var(--layout-gap-xs) var(--layout-gap-sm);
        border-radius: borders.$rounded-sm;
        border: 1px solid rgba($secondary, 0.08);
        background: rgba($secondary, 0.02);

        > .icon {
          flex: 0 0 auto;
          display: inline-flex;
          // Aligne l'icône sur la première ligne de texte.
          margin-top: 0.1rem;
        }

        > .content {
          min-width: 0;
          flex: 1 1 auto;

          display: flex;
          flex-direction: column;
          gap: var(--layout-gap-2xs);

          > p {
            margin: 0;
            @include little-text($thin: false);
            color: rgba($secondary, 0.82);
            word-break: break-word;
          }

          > .reason {
            color: rgba($secondary, 0.7);
          }
        }

        &.is-ok {
          border-color: rgba($good, 0.4);

          > .icon > svg {
            stroke: $good-ink;
          }

          > .content > .label > strong {
            color: $good-ink;
          }
        }

        &.is-missing {
          border-color: rgba($bad, 0.3);

          > .icon > svg {
            stroke: $bad-ink;
          }

          > .content > .label > strong {
            color: $bad-ink;
          }
        }
      }
    }

    > .meta {
      margin: 0;
      @include little-text($thin: false);
      color: rgba($secondary, 0.7);

      &.is-success {
        color: $good-ink;
      }

      &.is-error {
        color: $bad-ink;
      }
    }
  }
}
</style>
