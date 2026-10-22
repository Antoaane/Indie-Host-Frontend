<!-- File: src/components/navs/Nav/HostSubscriptionSettings.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  fetchMyStripeSubscriptionState,
  setMySubscriptionCancellation,
  type StripeSubscriptionState,
} from '@/domain/api/stripeSubscriptions'

// Résiliation en ligne depuis le compte de l'hôte : l'abonnement s'arrête à la fin de la période payée.
// Les remboursements ne concernent que la rétractation sous 14 jours, demandée par e-mail.
const props = defineProps<{
  active: boolean
}>()

const PAID_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due'])

const billingState = ref<StripeSubscriptionState | null>(null)
const isLoading = ref(false)
const isSubmitting = ref(false)
const isConfirming = ref(false)
const errorMessage = ref('')

const subscription = computed(() => billingState.value?.subscription ?? null)
const status = computed(() => (subscription.value?.status ?? '').toLowerCase())
const isComplimentary = computed(() => Boolean(subscription.value?.complimentary))
const hasPaidSubscription = computed(() => (
  Boolean(subscription.value?.subscriptionId)
  && !isComplimentary.value
  && PAID_SUBSCRIPTION_STATUSES.has(status.value)
))
const planName = computed(() => billingState.value?.currentPlan?.name ?? 'Abonnement')
const periodEndLabel = computed(() => {
  const iso = subscription.value?.currentPeriodEndISO
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
})
const statusLabel = computed(() => {
  if (subscription.value?.cancelAtPeriodEnd) {
    return periodEndLabel.value
      ? `résiliation programmée, fin le ${periodEndLabel.value}`
      : 'résiliation programmée à la fin de la période en cours'
  }
  if (status.value === 'trialing') {
    return periodEndLabel.value ? `essai gratuit jusqu'au ${periodEndLabel.value}` : 'essai gratuit en cours'
  }
  return periodEndLabel.value ? `prochain renouvellement le ${periodEndLabel.value}` : 'actif'
})

async function loadSubscription() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    billingState.value = await fetchMyStripeSubscriptionState({ sync: true })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de charger votre abonnement.'
  } finally {
    isLoading.value = false
  }
}

async function updateCancellation(cancelAtPeriodEnd: boolean) {
  if (isSubmitting.value) return
  isSubmitting.value = true
  errorMessage.value = ''
  try {
    billingState.value = await setMySubscriptionCancellation(cancelAtPeriodEnd)
    isConfirming.value = false
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de modifier votre abonnement.'
  } finally {
    isSubmitting.value = false
  }
}

watch(
  () => props.active,
  (active) => {
    if (!active) return
    isConfirming.value = false
    void loadSubscription()
  },
  { immediate: true },
)
</script>

<template>
  <section
    class="host-subscription-settings"
    aria-labelledby="host-subscription-settings-title"
  >
    <h3 id="host-subscription-settings-title">
      Mon abonnement
    </h3>

    <p
      v-if="isLoading"
      class="summary"
    >
      Chargement de votre abonnement…
    </p>

    <template v-else-if="hasPaidSubscription">
      <p class="summary">
        <strong>{{ planName }}</strong> : {{ statusLabel }}.
      </p>

      <template v-if="subscription?.cancelAtPeriodEnd">
        <p class="hint">
          Vos annonces restent en ligne jusqu'à cette date, puis sont dépubliées. Vous pouvez encore changer d'avis.
        </p>
        <div class="actions">
          <button
            type="button"
            class="primary-button"
            :disabled="isSubmitting"
            @click="updateCancellation(false)"
          >
            {{ isSubmitting ? 'Reprise…' : 'Reprendre mon abonnement' }}
          </button>
        </div>
      </template>

      <template v-else-if="isConfirming">
        <p class="hint">
          L'abonnement s'arrêtera à la fin de la période en cours, déjà payée, sans nouveau prélèvement. Vos annonces seront alors dépubliées. Vous pourrez revenir sur votre décision d'ici là.
        </p>
        <div class="actions">
          <button
            type="button"
            class="ghost-button"
            :disabled="isSubmitting"
            @click="isConfirming = false"
          >
            Garder mon abonnement
          </button>
          <button
            type="button"
            class="primary-button"
            :disabled="isSubmitting"
            @click="updateCancellation(true)"
          >
            {{ isSubmitting ? 'Résiliation…' : 'Confirmer la résiliation' }}
          </button>
        </div>
      </template>

      <div
        v-else
        class="actions"
      >
        <button
          type="button"
          class="ghost-button"
          @click="isConfirming = true"
        >
          Résilier mon abonnement
        </button>
      </div>
    </template>

    <p
      v-else-if="isComplimentary"
      class="summary"
    >
      Votre plan est offert par IndieHost : il n'y a rien à résilier.
    </p>

    <p
      v-else-if="!errorMessage"
      class="summary"
    >
      Aucun abonnement payant sur ce compte.
      <RouterLink to="/pricing">
        Voir les offres
      </RouterLink>
    </p>

    <p
      v-if="errorMessage"
      class="status is-error"
      role="alert"
    >
      {{ errorMessage }}
    </p>

    <p class="note">
      Un remboursement n'est possible qu'en cas de rétractation dans les 14 jours suivant la souscription, sur demande à
      <a href="mailto:contact@indiehost.fr">contact@indiehost.fr</a>.
      <RouterLink to="/legal/annulation-remboursement">
        Voir les conditions
      </RouterLink>
    </p>
  </section>
</template>

<style lang="scss">
/* File: src/components/navs/Nav/HostSubscriptionSettings.vue */

@use '@/styles/variables/globals' as *;
@use '@/styles/components/buttons' as buttons;

.host-subscription-settings {
  display: flex;
  flex-direction: column;
  gap: var(--layout-gap-sm);
  padding-top: var(--layout-gap);
  border-top: 1px solid rgba($secondary, 0.08);

  > h3 {
    margin: 0;
    @include h4-title($colorful: false);
  }

  > .summary,
  > .hint,
  > .note {
    margin: 0;

    a {
      color: $secondary;
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }
  }

  > .summary {
    @include base-text($thin: false);
  }

  > .hint {
    @include little-text(rgba($secondary-text, 0.72), $thin: false);
  }

  > .note {
    @include little-text(rgba($secondary-text, 0.62), $thin: false);
  }

  > .status.is-error {
    margin: 0;
    @include little-text($bad-ink, $thin: false);
  }

  > .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--layout-gap-xs);

    > .ghost-button {
      @include buttons.secondary;
    }

    > .primary-button {
      @include buttons.primary(true);
    }
  }
}
</style>
