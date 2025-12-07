// File: src/views/ListingView/utils/fetchListingRaw.ts

import coreJSON from '@/content/fr/ListingTest/core.json';
import bookingsJSON from '@/content/fr/ListingTest/bookings.json';
import mediasJSON from '@/content/fr/ListingTest/medias.json';
import amenitiesJSON from '@/content/fr/ListingTest/amenities.json';
import notesJSON from '@/content/fr/ListingTest/notes.json';
import commentsJSON from '@/content/fr/ListingTest/comments.json';

// Typages "bruts" dÇ¸duits des JSON exemples
type RawCoreBase = typeof coreJSON;
export type RawCore = RawCoreBase & { lat?: number; lng?: number; zoom?: number };
export type RawBookings = typeof bookingsJSON;
export type RawMedias = typeof mediasJSON;
export type RawAmenities = typeof amenitiesJSON;
export type RawNotes = typeof notesJSON;
export type RawComments = typeof commentsJSON;

const BASE_API_URL = import.meta.env.VITE_API_BASE_URL;
const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
const listingIdFromRoute = currentPath.match(/^\/listing-test\/([^/]+)\/?$/)?.[1];
const USE_REMOTE = Boolean(listingIdFromRoute);
const listingId = listingIdFromRoute || coreJSON.id;

const buildUrl = (resource: string) => `${BASE_API_URL}/listings/${resource}/${listingId}`;

async function fetchRemote<T>(url: string): Promise<T> {
  const { default: axios } = await import('axios'); // import dynamique
  const { data } = await axios.get<T>(url, { withCredentials: false });
  console.log(`[fetchListingRaw] fetched remote ${url}`);
  return data;
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

export async function loadAmenities(): Promise<RawAmenities> {
  if (!USE_REMOTE) return amenitiesJSON as RawAmenities;
  try {
    return await fetchRemote<RawAmenities>(buildUrl('amenities'));
  } catch (err) {
    console.warn('[fetchListingRaw] loadAmenities fallback to local JSON', err);
    return amenitiesJSON as RawAmenities;
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
