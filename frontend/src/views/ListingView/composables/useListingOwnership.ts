// File: src/views/ListingView/composables/useListingOwnership.ts

import { computed, reactive, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router'

import type { UserListingCard } from '@/domain/listings/types'

type FetchListings = (payload: { userId: string; includeDeleted: boolean }) => Promise<UserListingCard[]>

type UseListingOwnershipOptions = {
  route: RouteLocationNormalizedLoaded
  listingId: ComputedRef<string | null>
  isCheckout: ComputedRef<boolean>
  isSignedIn: Ref<boolean | null | undefined>
  currentUserId: ComputedRef<string | null>
  fetchListings: FetchListings
}

export function normalizeListingId(value: unknown): string | null {
  if (Array.isArray(value)) return normalizeListingId(value[0])
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function buildOwnedListingIdSet(listings: UserListingCard[]): Set<string> {
  const listingIds = listings
    .map((listing) => normalizeListingId(listing.listingId))
    .filter((id): id is string => Boolean(id))
  return new Set(listingIds)
}

export function useListingOwnership(options: UseListingOwnershipOptions) {
  const ownedListingIds = ref<Set<string>>(new Set())
  const ownershipLookup = reactive({
    isLoading: false,
  })
  const isPublicListingRoute = computed(() => options.route.name === 'listing')
  const isOwnerListing = computed(() => {
    const targetListingId = options.listingId.value
    if (!targetListingId) return false
    return ownedListingIds.value.has(targetListingId)
  })
  const canEditListing = computed(() => isPublicListingRoute.value && !options.isCheckout.value && isOwnerListing.value)
  const editListingRoute = computed<RouteLocationRaw>(() => {
    const targetListingId = options.listingId.value
    const targetUserId = options.currentUserId.value
    const query = targetListingId ? { listingId: targetListingId } : undefined

    if (targetUserId) {
      return {
        name: 'editor',
        query,
      }
    }

    const fallbackRedirectUrl = targetListingId
      ? `/dashboard/editor?listingId=${encodeURIComponent(targetListingId)}`
      : '/dashboard/editor'

    return {
      name: 'sign-in',
      query: { redirect_url: fallbackRedirectUrl },
    }
  })

  let ownershipLookupToken = 0

  watch(
    () => [isPublicListingRoute.value, Boolean(options.isSignedIn.value), options.currentUserId.value] as const,
    async ([isPublicRoute, signedIn, userId]) => {
      const lookupToken = ++ownershipLookupToken

      if (!isPublicRoute || !signedIn || !userId) {
        ownershipLookup.isLoading = false
        ownedListingIds.value = new Set()
        return
      }

      ownershipLookup.isLoading = true
      try {
        const listings = await options.fetchListings({ userId, includeDeleted: true })
        if (lookupToken !== ownershipLookupToken) return
        ownedListingIds.value = buildOwnedListingIdSet(listings)
      } catch (error) {
        console.warn('[ListingView] could not resolve owned listings', error)
        if (lookupToken !== ownershipLookupToken) return
        ownedListingIds.value = new Set()
      } finally {
        if (lookupToken === ownershipLookupToken) {
          ownershipLookup.isLoading = false
        }
      }
    },
    { immediate: true },
  )

  return {
    ownershipLookup,
    canEditListing,
    editListingRoute,
  }
}
