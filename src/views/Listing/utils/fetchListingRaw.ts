// File: src/views/Listing/utils/fetchListingRaw.ts

import coreJSON from '@/content/fr/ListingTest/core.json';
import bookingsJSON from '@/content/fr/ListingTest/bookings.json';
import mediasJSON from '@/content/fr/ListingTest/medias.json';
import notesJSON from '@/content/fr/ListingTest/notes.json';
import commentsJSON from '@/content/fr/ListingTest/comments.json';
import hostJSON from '@/content/fr/ListingTest/host.json';

import clerkToken from '@/utils/clerkToken'

// Typages "bruts" déduits des JSON exemples
type RawCoreBase = typeof coreJSON;
export type RawCore = RawCoreBase & { lat?: number; lng?: number; zoom?: number };
export type RawBookings = typeof bookingsJSON;
export type RawMedias = typeof mediasJSON;
export type RawNotes = typeof notesJSON;
export type RawComments = typeof commentsJSON;
export type RawHost = typeof hostJSON;

const RAW_BASE_API_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const BASE_API_URL = normalizeApiBaseUrl(RAW_BASE_API_URL);
const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
const listingIdFromRoute = currentPath.match(/^\/listing-test\/([^/]+)\/?$/)?.[1];
const USE_REMOTE = Boolean(listingIdFromRoute);
const listingId = listingIdFromRoute || coreJSON.id;

const buildUrl = (resource: string) => `${BASE_API_URL}/listings/${resource}/${listingId}`;

function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  if (!trimmed) return '';

  if (import.meta.env.DEV) {
    try {
      const parsed = new URL(trimmed);
      return parsed.pathname.replace(/\/$/, '') || '/';
    } catch {
      // ignore: base URL may be relative (e.g. /v1)
    }
  }

  return trimmed;
}

function waitForClerkToken({
  timeoutMs,
  pollEveryMs,
}: {
  timeoutMs: number;
  pollEveryMs: number;
}): Promise<string | null> {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const tick = () => {
      const token = (clerkToken.value ?? '').trim();
      if (token) return resolve(token);
      if (Date.now() - startedAt >= timeoutMs) return resolve(null);
      setTimeout(tick, pollEveryMs);
    };

    tick();
  });
}

async function fetchRemote<T>(url: string): Promise<T> {
  const resolvedUrl =
    typeof window !== 'undefined' ? new URL(url, window.location.origin).toString() : url;
  console.log(`ℹ️[fetchListingRaw] fetching remote ${url}`);
  console.log(`🌐[fetchListingRaw] browser actually requests ${resolvedUrl}`);
  const { default: axios } = await import('axios'); // import dynamique

  const doRequest = async (token: string | null) => {
    const { data } = await axios.get<T>(url, {
      withCredentials: false,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return data;
  };

  let token = (clerkToken.value ?? '').trim() || null;
  if (!token) {
    console.log('🔐[fetchListingRaw] waiting for Clerk token…');
    token = await waitForClerkToken({ timeoutMs: 2000, pollEveryMs: 50 });
  }
  console.log(`🔐[fetchListingRaw] token present: ${Boolean(token)}`);

  try {
    const data = await doRequest(token);
    console.log('✅[fetchListingRaw] fetched data :', data);
    return data;
  } catch (err: any) {
    const status = err?.response?.status;
    const shouldRetryAuth = (status === 401 || status === 403) && !token;

    // if (shouldRetryAuth) {
    //   console.warn(`⚠️[fetchListingRaw] got ${status} without token, retrying once after token…`);
    //   const retryToken = await waitForClerkToken({ timeoutMs: 3000, pollEveryMs: 50 });
    //   console.log(`🔐[fetchListingRaw] retry token present: ${Boolean(retryToken)}`);
    //   const data = await doRequest(retryToken);
    //   console.log('✅[fetchListingRaw] fetched data :', data);
    //   return data;
    // }

    throw err;
  }
}

export async function loadCore(): Promise<RawCore> {
  if (!USE_REMOTE) return coreJSON as RawCore;
  try {
    return await fetchRemote<RawCore>(buildUrl('core'));
  } catch (err) {
    console.warn('[fetchListingRaw] loadCore fallback to local JSON', err);
    return coreJSON as RawCore;
  }
}

export async function loadBookings(): Promise<RawBookings> {
  if (!USE_REMOTE) return bookingsJSON as RawBookings;
  try {
    return await fetchRemote<RawBookings>(buildUrl('bookings'));
  } catch (err) {
    console.warn('[fetchListingRaw] loadBookings fallback to local JSON', err);
    return bookingsJSON as RawBookings;
  }
}

export async function loadMedias(): Promise<RawMedias> {
  if (!USE_REMOTE) return mediasJSON as RawMedias;
  try {
    return await fetchRemote<RawMedias>(buildUrl('medias'));
  } catch (err) {
    console.warn('[fetchListingRaw] loadMedias fallback to local JSON', err);
    return mediasJSON as RawMedias;
  }
}

export async function loadNotes(): Promise<RawNotes> {
  if (!USE_REMOTE) return notesJSON as RawNotes;
  try {
    return await fetchRemote<RawNotes>(buildUrl('notes'));
  } catch (err) {
    console.warn('[fetchListingRaw] loadNotes fallback to local JSON', err);
    return notesJSON as RawNotes;
  }
}

export async function loadComments(): Promise<RawComments> {
  if (!USE_REMOTE) return commentsJSON as RawComments;
  try {
    return await fetchRemote<RawComments>(buildUrl('comments'));
  } catch (err) {
    console.warn('[fetchListingRaw] loadComments fallback to local JSON', err);
    return commentsJSON as RawComments;
  }
}

export async function loadHost(): Promise<RawHost> {
  if (!USE_REMOTE) return hostJSON as RawHost;
  try {
    return await fetchRemote<RawHost>(buildUrl('host'));
  } catch (err) {
    console.warn('[fetchListingRaw] loadHost fallback to local JSON', err);
    return hostJSON as RawHost;
  }
}
