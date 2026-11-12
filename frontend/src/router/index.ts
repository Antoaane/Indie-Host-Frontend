// File: src/router/index.ts

import SignInView from '@/views/SignInView.vue'
import SignUpView from '@/views/SignUpView.vue'
import { START_LOCATION, createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { injectHead, type VueHeadClient } from '@unhead/vue'
import { isListingHostname } from '@/domain/listings/publicDomain'
import { normalizeListingSlug } from '@/domain/listings/slug'
import { fetchMyUser } from '@/domain/api/users'
import { resolveRuntimeUserId } from '@/router/backOfficeUser'
import { SIGNED_IN_ENTRY_PATH, hasClerkSessionCookie, resolveTicketEntryRoute, waitForClerkUserId } from '@/utils/authEntry'
// Import direct : ses styles partent dans le CSS principal et habillent dès le premier rendu
// la version statique des documents générée au build (lisible sans JavaScript).
import LegalPage from '@/views/Legal/LegalPage.vue'
import { legalPages, legalSlugPattern } from '@/views/Legal/legalPages'
const HomePage = () => {
  if (typeof window !== 'undefined' && isListingHostname(window.location.hostname)) {
    return import('@/views/Listing/_Listing.vue')
  }
  return import('@/views/Landing/_LandingPage.vue')
}
const PricingView = () => import('@/views/PricingView.vue')
const PricingChecklistCallbackView = () => import('@/views/PricingCallbacks/PricingChecklistCallbackView.vue')
const Listing = () => import('@/views/Listing/_Listing.vue')
const ListingGuide = () => import('@/views/ListingGuide/_ListingGuide.vue')
const BookingConfirmationView = () => import('@/views/BookingConfirmation/BookingConfirmationView.vue')
const EditorRoute = () => import('@/views/Editor/EditorRoute.vue')
const CreateListingRoute = () => import('@/views/CreateListing/CreateListingRoute.vue')
const CreateListingPublicRoute = () => import('@/views/CreateListing/CreateListingPublicRoute.vue')
const MessagingRoute = () => import('@/views/Messaging/MessagingRoute.vue')
const ManagementRoute = () => import('@/views/Management/ManagementRoute.vue')
const DomainsRoute = () => import('@/views/Domains/DomainsRoute.vue')
const AdminRoute = () => import('@/views/Admin/AdminRoute.vue')
// Mode édition de la page de présentation : chargé seulement depuis le tableau de bord, jamais avec la page publique.
const HubPageEditRoute = () => import('@/views/ListingHub/edit/HubPageEditRoute.vue')

declare module 'vue-router' {
  interface RouteMeta {
    /** Titre d'onglet de la page (français). Une vue peut le préciser avec `useHead`. */
    title?: string
  }
}

// Attente de Clerk à l'ouverture de la landing avec une session. Au-delà, la landing s'affiche et
// `useDashboardEntryRedirect` envoie l'hôte sur ses annonces dès que Clerk répond.
const LANDING_SESSION_WAIT_MS = 4000

const SITE_NAME = 'IndieHost'
const HOME_TITLE = 'IndieHost — Location saisonnière sans commission'

function resolveRouteTitle(to: RouteLocationNormalized): string {
  const title = to.meta.title?.trim()
  if (!title) return SITE_NAME
  return title.startsWith(SITE_NAME) ? title : `${title} | ${SITE_NAME}`
}

const BACK_OFFICE_USER_ROUTE_BY_ENTRY_NAME = {
  editor: 'editor-user',
  management: 'management-user',
  domains: 'domains-user',
  admin: 'admin-user',
  messaging: 'messaging-user',
} as const

async function resolveBackOfficeAccess(to: RouteLocationNormalized) {
  const userId = await resolveRuntimeUserId({
    waitMs: 2500,
    pollIntervalMs: 75,
  })

  if (userId) {
    const targetName = typeof to.name === 'string'
      ? BACK_OFFICE_USER_ROUTE_BY_ENTRY_NAME[to.name as keyof typeof BACK_OFFICE_USER_ROUTE_BY_ENTRY_NAME]
      : undefined

    if (targetName) {
      return {
        name: targetName,
        params: { userId },
        query: to.query,
        hash: to.hash,
      }
    }

    return true
  }

  return {
    name: 'sign-in',
    query: { redirect_url: to.fullPath },
  }
}

// Réponse de l'API attendue au plus ce temps : au-delà, « Mes annonces » (l'administration reste
// dans le menu). À l'ouverture de la page, l'écran de chargement ne couvre que 5 s
// (`useBootLoader.ts`) : l'attente de Clerk et celle de l'API tiennent ensemble dans 4,5 s.
const ADMIN_CHECK_TIMEOUT_MS = 2500
const PAGE_LOAD_ENTRY_BUDGET_MS = 4500
const MIN_ADMIN_CHECK_MS = 800

function adminCheckTimeout(isPageLoad: boolean): number {
  if (!isPageLoad || typeof performance === 'undefined') return ADMIN_CHECK_TIMEOUT_MS
  // `performance.now()` part de l'ouverture de la page.
  return Math.min(ADMIN_CHECK_TIMEOUT_MS, Math.max(MIN_ADMIN_CHECK_MS, PAGE_LOAD_ENTRY_BUDGET_MS - performance.now()))
}

async function isAdminAccount(timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const me = await Promise.race([
      fetchMyUser(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
    return Boolean(me?.isAdmin)
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Arrivée d'un compte connecté sans destination précise (après la connexion, ou à l'ouverture
 * d'indiehost.fr avec une session) : l'administration pour un administrateur (dev@indiehost.fr,
 * demande du 2026-11-12), « Mes annonces » pour tous les autres. Les droits viennent de l'API
 * (`/users/me`), comme sur la page d'administration elle-même.
 */
async function resolveSignedInEntry(to: RouteLocationNormalized, from: RouteLocationNormalized) {
  const isPageLoad = from === START_LOCATION
  const userId = await resolveRuntimeUserId({
    waitMs: 2500,
    pollIntervalMs: 75,
  })
  if (!userId) {
    return {
      name: 'sign-in',
      query: { redirect_url: to.fullPath },
    }
  }
  return {
    name: (await isAdminAccount(adminCheckTimeout(isPageLoad))) ? 'admin-user' : 'editor-user',
    params: { userId },
    query: to.query,
    hash: to.hash,
  }
}

async function resolveCreateListingEntryRedirect(to: RouteLocationNormalized) {
  const userId = await resolveRuntimeUserId({
    waitMs: 1500,
    pollIntervalMs: 75,
  })

  if (userId) {
    return {
      name: 'create-listing-user',
      params: { userId },
      query: to.query,
    }
  }

  return {
    name: 'create-listing-public',
    query: to.query,
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
      meta: { navVariant: 'landing', title: HOME_TITLE },
    },
    {
      path: '/sign-in/:step(.*)*',
      name: 'sign-in',
      component: SignInView,
      meta: { navVariant: 'public', title: 'Connexion' },
    },
    {
      path: '/sign-up/:step(.*)*',
      name: 'sign-up',
      component: SignUpView,
      meta: { navVariant: 'public', title: 'Inscription' },
    },
    {
      path: '/pricing',
      name: 'pricing',
      component: PricingView,
      meta: { navVariant: 'public', title: 'Tarifs' },
    },
    {
      path: '/pricing/callback',
      name: 'pricing-callback',
      component: PricingChecklistCallbackView,
      meta: { navVariant: 'public', title: 'Finalisation de votre abonnement' },
    },
    {
      path: '/pricing/callback/auth',
      name: 'pricing-callback-auth',
      redirect: (to) => ({
        name: 'pricing-callback',
        query: {
          ...to.query,
          action: 'auth',
        },
        hash: to.hash,
      }),
      meta: { navVariant: 'public' },
    },
    {
      path: '/pricing/callback/checkout',
      name: 'pricing-callback-checkout',
      redirect: (to) => ({
        name: 'pricing-callback',
        query: {
          ...to.query,
          action: 'checkout',
        },
        hash: to.hash,
      }),
      meta: { navVariant: 'public' },
    },
    {
      path: '/pricing/callback/connect',
      name: 'pricing-callback-connect',
      redirect: (to) => ({
        name: 'pricing-callback',
        query: {
          ...to.query,
          action: 'connect',
        },
        hash: to.hash,
      }),
      meta: { navVariant: 'public' },
    },
    {
      path: '/listing/guide/:id',
      name: 'listing-guide',
      component: ListingGuide,
      meta: { hideNav: true, title: "Guide d'arrivée" },
    },
    {
      path: '/booking/confirmation/:reservationId',
      name: 'booking-confirmation',
      component: BookingConfirmationView,
      meta: { navVariant: 'public', hideNav: true, title: 'Confirmation de réservation' },
    },
    {
      path: '/donation',
      name: 'Donation',
      component: () => import('@/views/Donation/_DonationPage.vue'),
      meta: { navVariant: 'landing', title: 'Faire un don' },
    },
    {
      path: '/legal',
      redirect: { name: 'legal', params: { page: legalPages[0]?.slug ?? 'mentions-legales' } },
    },
    {
      path: `/legal/:page(${legalSlugPattern})`,
      name: 'legal',
      component: LegalPage,
      // LegalPage.vue précise le titre du document via useHead.
      meta: { navVariant: 'landing', title: 'Informations légales' },
    },
    {
      path: '/dashboard/editor/create',
      name: 'create-listing',
      component: CreateListingPublicRoute,
      meta: { navVariant: 'public', hideNav: true, title: 'Créer une annonce' },
      beforeEnter: resolveCreateListingEntryRedirect,
    },
    {
      path: '/create-listing',
      name: 'create-listing-public',
      component: CreateListingPublicRoute,
      meta: { navVariant: 'public', hideNav: true, title: 'Créer une annonce' },
    },
    {
      path: '/dashboard/editor/:userId/create',
      name: 'create-listing-user',
      component: CreateListingRoute,
      meta: { navVariant: 'host', hideNav: true, title: 'Créer une annonce' },
    },
    {
      // Arrivée sur le tableau de bord : jamais affichée, sa garde choisit la page (voir resolveSignedInEntry).
      path: '/dashboard',
      name: 'dashboard-entry',
      component: EditorRoute,
      meta: { navVariant: 'host', title: 'Tableau de bord' },
      beforeEnter: resolveSignedInEntry,
    },
    {
      path: '/dashboard/editor',
      name: 'editor',
      component: EditorRoute,
      meta: { navVariant: 'host', title: 'Mes annonces' },
      beforeEnter: resolveBackOfficeAccess,
    },
    {
      path: '/dashboard/editor/:userId',
      name: 'editor-user',
      component: EditorRoute,
      meta: { navVariant: 'host', title: 'Mes annonces' },
    },
    {
      // Page de présentation d'une page principale, modifiable sur place (docs/editeur-de-page.md).
      path: '/dashboard/page/:listingId',
      name: 'page-editor',
      component: HubPageEditRoute,
      meta: { navVariant: 'host', hideNav: true, title: 'Modifier ma page' },
      beforeEnter: resolveBackOfficeAccess,
    },
    {
      path: '/dashboard/management',
      name: 'management',
      component: ManagementRoute,
      meta: { navVariant: 'host', title: 'Gestion' },
      beforeEnter: resolveBackOfficeAccess,
    },
    {
      path: '/dashboard/management/:userId',
      name: 'management-user',
      component: ManagementRoute,
      meta: { navVariant: 'host', title: 'Gestion' },
    },
    {
      path: '/dashboard/domains',
      name: 'domains',
      component: DomainsRoute,
      meta: { navVariant: 'host', title: 'Domaines' },
      beforeEnter: resolveBackOfficeAccess,
    },
    {
      path: '/dashboard/domains/:userId',
      name: 'domains-user',
      component: DomainsRoute,
      meta: { navVariant: 'host', title: 'Domaines' },
    },
    {
      // Synthèse des revenus : compte d'encaissement, solde, virements, paiements des réservations.
      path: '/dashboard/revenues',
      name: 'revenues',
      component: () => import('@/views/Revenues/RevenuesRoute.vue'),
      meta: { navVariant: 'host', title: 'Mes revenus' },
      beforeEnter: resolveBackOfficeAccess,
    },
    {
      path: '/dashboard/admin',
      name: 'admin',
      component: AdminRoute,
      meta: { navVariant: 'host', title: 'Administration' },
      beforeEnter: resolveBackOfficeAccess,
    },
    {
      path: '/dashboard/admin/:userId',
      name: 'admin-user',
      component: AdminRoute,
      meta: { navVariant: 'host', title: 'Administration' },
    },
    {
      path: '/dashboard/messages',
      name: 'messaging',
      component: MessagingRoute,
      meta: { navVariant: 'host', title: 'Messagerie' },
      beforeEnter: resolveBackOfficeAccess,
    },
    {
      path: '/dashboard/messages/:userId',
      name: 'messaging-user',
      component: MessagingRoute,
      meta: { navVariant: 'host', title: 'Messagerie' },
    },
    {
      path: '/editor/create',
      redirect: (to) => ({
        name: 'create-listing',
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/editor/:userId/create',
      redirect: (to) => ({
        name: 'create-listing-user',
        params: to.params,
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/editor',
      redirect: (to) => ({
        name: 'editor',
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/editor/:userId',
      redirect: (to) => ({
        name: 'editor-user',
        params: to.params,
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/management',
      redirect: (to) => ({
        name: 'management',
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/management/:userId',
      redirect: (to) => ({
        name: 'management-user',
        params: to.params,
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/messagerie',
      redirect: (to) => ({
        name: 'messaging',
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/messagerie/:userId',
      redirect: (to) => ({
        name: 'messaging-user',
        params: to.params,
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/domains',
      redirect: (to) => ({
        name: 'domains',
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/domains/:userId',
      redirect: (to) => ({
        name: 'domains-user',
        params: to.params,
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/listing',
      redirect: { name: 'home' },
    },
    {
      path: '/listing/:slug',
      redirect: (to) => {
        const raw = to.params.slug
        const slug = normalizeListingSlug(typeof raw === 'string' ? raw : '')
        if (!slug) return { name: 'home' }
        return {
          name: 'listing',
          params: { slug },
          query: to.query,
          hash: to.hash,
        }
      },
    },
    // Éditeur sur données en mémoire, sans compte ni API : seulement en développement.
    ...(import.meta.env.DEV
      ? [{
          path: '/dev/editor',
          name: 'dev-editor',
          component: () => import('@/views/Editor/dev/DevEditorRoute.vue'),
          meta: { navVariant: 'host', hideNav: true, title: 'Éditeur (dev)' },
        }, {
          // Réservations sur les mêmes annonces en mémoire (une réservation, des dates importées).
          path: '/dev/management',
          name: 'dev-management',
          component: () => import('@/views/Management/dev/DevManagementRoute.vue'),
          meta: { navVariant: 'host', hideNav: true, title: 'Réservations (dev)' },
        }, {
          // « Mes revenus » sur de faux chiffres (`?state=verifying|none|empty|offline`).
          path: '/dev/revenues',
          name: 'dev-revenues',
          component: () => import('@/views/Revenues/dev/DevRevenuesRoute.vue'),
          meta: { navVariant: 'host', hideNav: true, title: 'Mes revenus (dev)' },
        }, {
          // Administration sur de fausses données (`?onglet=…`, `?etat=panne`, `?acces=refuse`).
          path: '/dev/admin',
          name: 'dev-admin',
          component: () => import('@/views/Admin/dev/DevAdminRoute.vue'),
          meta: { navVariant: 'host', hideNav: true, title: 'Administration (dev)' },
        }, {
          // Page publique d'un logement sur l'annonce en mémoire (rendu téléphone, calendrier de réservation).
          path: '/dev/listing',
          name: 'dev-listing',
          component: () => import('@/views/Listing/dev/DevListingRoute.vue'),
          meta: { hideNav: true, title: 'Annonce (dev)' },
        }, {
          // Thèmes de la page de présentation et mode édition, sur du faux contenu (docs/editeur-de-page.md).
          path: '/dev/page-themes',
          name: 'dev-page-themes',
          component: () => import('@/views/ListingHub/dev/DevPageThemesRoute.vue'),
          meta: { navVariant: 'public', hideNav: true, title: 'Thèmes de page (dev)' },
        }]
      : []),
    {
      path: '/:slug([a-z0-9-]+)',
      name: 'listing',
      component: Listing,
      // _Listing.vue remplace ce titre par celui de l'annonce via useHead.
      meta: { hideNav: true, title: 'Annonce' },
    },
  ],
})

router.beforeEach(async (to, from) => {
  if (typeof window === 'undefined') return true
  if (!isListingHostname(window.location.hostname)) {
    if (to.name !== 'home') return true
    // Lien à jeton Clerk qui pointe sur l'accueil : la page de connexion consomme le jeton
    // puis ouvre le tableau de bord, sans passer par la landing.
    const ticketRoute = resolveTicketEntryRoute(to.query)
    if (ticketRoute) return ticketRoute
    // Hôte connecté qui ouvre indiehost.fr : son tableau de bord (l'administration pour un
    // administrateur), sans voir la landing. On attend Clerk (sous l'écran de chargement) seulement
    // si son cookie annonce une session, et seulement à l'ouverture de la page : un lien interne
    // vers la landing l'affiche toujours.
    if (from === START_LOCATION && hasClerkSessionCookie()) {
      const userId = await waitForClerkUserId(LANDING_SESSION_WAIT_MS)
      if (userId) return SIGNED_IN_ENTRY_PATH
    }
    return true
  }
  // Les documents légaux restent accessibles aux voyageurs sur le domaine de l'hôte.
  if (to.name === 'home' || to.name === 'listing' || to.name === 'listing-guide' || to.name === 'booking-confirmation' || to.name === 'legal') return true
  return { name: 'home' }
})

// Titre d'onglet : une seule entrée unhead, posée à l'installation puis mise à jour à chaque
// navigation. Les vues qui appellent `useHead` (annonce, documents légaux) passent devant, et
// leur départ rend la main à ce titre au lieu de celui capturé par unhead au premier rendu.
// Le head est fourni par le plugin @nuxt/ui, installé avant le routeur dans main.ts.
const installRouter = router.install
router.install = (app) => {
  installRouter.call(router, app)

  let head: VueHeadClient | null = null
  try {
    head = app.runWithContext(() => injectHead())
  } catch {
    head = null
  }

  if (head) {
    const titleEntry = head.push({ title: resolveRouteTitle(router.currentRoute.value) })
    router.afterEach((to) => {
      titleEntry.patch({ title: resolveRouteTitle(to) })
    })
    return
  }

  router.afterEach((to) => {
    if (typeof document !== 'undefined') document.title = resolveRouteTitle(to)
  })
}

export default router
