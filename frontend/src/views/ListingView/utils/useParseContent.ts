// File: src/views/ListingView/utils/useParseContent.ts

import type {
  RawCore,
  RawBookings,
  RawMedias,
  RawNotes,
  RawComments,
  RawHost,
  RawListingBundle,
} from '@/domain/listings/types';
import { getSynchronizedBookedDays } from '@/domain/listings/bookings';
import { resolveWeekendPricing } from '@/domain/listings/pricing';
import { buildPerkCandidates, selectTopPerkCandidates } from '@/domain/listings/perks';
import { normalizeFeeItems, resolveListingReservationRules } from '@/domain/listings/reservationRules';
import { getKnownAmenityCatalogItem, sanitizeKnownAmenities } from '@/utils/amenitiesCatalog';

// ---- TYPES ----
import type {
  ListingParsed,
  TitleModel,
  PerksModel,
  HostProfileModel,
  DescriptionModel,
  AmenitiesModel,
  RoomItem,
  RoomsModel,
  RoomsByType,
  BookingsModel,
  MediasModel,
  NotesModel,
  CommentsModel,
  CommentsPagesModel,
  MapModel,
  ReviewsVisibilityModel,
} from '@/views/ListingView/types/listing';

export type { RawListingBundle };

type Maybe<T> = T | null | undefined;
const NON_SLEEPING_ROOM_TYPES = new Set([
  'kitchen',
  'bathroom',
]);

function normalizeRoomType(type: unknown): string {
  return String(type ?? '').trim().toLowerCase();
}

function isNonSleepingRoomType(type: unknown): boolean {
  return NON_SLEEPING_ROOM_TYPES.has(normalizeRoomType(type));
}

/* ------------------------------------------------------------------ */
/* ----------------------- HELPERS ƒ?oROOMSƒ?? -------------------------- */
/* ------------------------------------------------------------------ */

// Normalise les rooms brutes du core.json -> RoomItem[]
function normalizeRooms(core: Maybe<Partial<RawCore>>): RoomItem[] {
  return (core?.rooms ?? []).map(r => ({
    name: r['room-name'],
    type: r.type,
    // ƒªÎ‹÷? NE PAS forcer [] : on ne met "beds" que s'il y en a
    ...(isNonSleepingRoomType(r.type)
      ? {}
      : r.beds && r.beds.length
      ? {
        beds: r.beds.map(b => ({
          type: b.type,
          capacity: b.capacity,
          quantity: b.quantity,
        })),
      }
      : {}),
  }));
}


// Regroupe les rooms par type et calcule beds / capacity cumulÇ¸s
function groupRoomsByType(rooms: RoomItem[]): RoomsByType {
  const byType: RoomsByType = {};
  for (const r of rooms) {
    const key = r.type;
    if (!byType[key]) byType[key] = { rooms: [], length: 0, beds: 0, capacity: 0 };

    byType[key].rooms.push(r);
    byType[key].length += 1;

    // ƒªÎ‹÷? Supporte rooms sans beds
    const bedsQty = r.beds?.reduce((acc, b) => acc + (b.quantity ?? 0), 0) ?? 0;
    const cap = r.beds?.reduce((acc, b) => acc + (b.capacity ?? 0) * (b.quantity ?? 0), 0) ?? 0;

    // "beds" peut rester 0 (mÇ¦me si optionnel cÇïtÇ¸ type)
    byType[key].beds = (byType[key].beds ?? 0) + bedsQty;
    byType[key].capacity += cap;
  }
  return byType;
}

// RÇ¸sumÇ¸ global (toutes piÇùces)
function summarizeAll(rooms: RoomItem[]) {
  const bedsCount =
    rooms.reduce((acc, r) => acc + (r.beds?.reduce((a, b) => a + (b.quantity ?? 0), 0) ?? 0), 0);
  const capacityTotal =
    rooms.reduce(
      (acc, r) =>
        acc + (r.beds?.reduce((a, b) => a + (b.capacity ?? 0) * (b.quantity ?? 0), 0) ?? 0),
      0,
    );
  return { roomsCount: rooms.length, bedsCount, capacityTotal };
}

// Utilitaires dƒ?TagrÇ¸gation par type
const getTypeEntry = (byType: RoomsByType, key: string) =>
  byType[key] ?? { rooms: [], length: 0, beds: 0, capacity: 0 };

const sumLengthsMatching = (byType: RoomsByType, predicate: (key: string) => boolean) =>
  Object.entries(byType).reduce((sum, [k, v]) => (predicate(k) ? sum + v.length : sum), 0);

/* ------------------------------------------------------------------ */
/* --------------------------- PARSEURS ----------------------------- */
/* ------------------------------------------------------------------ */

// Aligne sur les props du composant <Title>
function parseTitle(core: Maybe<Partial<RawCore>>): TitleModel {
  const type = (core?.type ?? '').split(' / ')[0].trim() || core?.type || '';

  const rooms = normalizeRooms(core);
  const byType = groupRoomsByType(rooms);

  const bedroom = getTypeEntry(byType, 'bedroom');
  const bathrooms = sumLengthsMatching(byType, k => k.toLowerCase().includes('bath'));

  return {
    title: core?.title ?? '',
    type,
    location: { city: core?.city ?? '', region: core?.region ?? '', country: core?.country ?? '' },
    guest_capacity: core?.guest_capacity ?? 0,
    bedrooms: { quantity: bedroom.length, bed: bedroom.beds ?? 0 }, // ƒª.‹÷? safe
    bathrooms,
  };
}


function parsePerks(raw: RawListingBundle): PerksModel {
  const candidates = selectTopPerkCandidates(
    buildPerkCandidates({
      core: raw.core,
      bookings: raw.bookings,
    }),
    2,
  )

  return candidates.map((candidate) => ({
    icon: candidate.icon,
    name: candidate.name,
    description: candidate.description,
    score: candidate.score,
    source: candidate.source,
    sourceId: candidate.sourceId,
  }))
}

function parseHost(host: Maybe<Partial<RawHost>>): HostProfileModel {
  return {
    name: host?.name ?? '',
    status: host?.status,
    seniority: host?.seniority ?? 0,
    globalNote: host?.['global-note'],
    avatar: host?.avatar,
    catalogLink: host?.['catalog-link'],
  };
}

function parseDescription(core: Maybe<Partial<RawCore>>): DescriptionModel {
  return {
    description: core?.description ?? '',
    // blocks: core.description.map(b => ({ title: b.title, content: b.content })),
  };
}

function normalizeMapText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function parseCoordinate(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMap(core: Maybe<Partial<RawCore>>): MapModel {
  const latitude = parseCoordinate(core?.latitude ?? core?.lat);
  const coreRecord = (core ?? {}) as Record<string, unknown>;
  const longitude = parseCoordinate(core?.longitude ?? core?.lng ?? coreRecord.lon);
  const zoom = typeof core?.zoom === 'number' ? core.zoom : undefined;
  const preciseAddress = normalizeMapText(core?.precise_address);
  const city = normalizeMapText(core?.city);
  const region = normalizeMapText(core?.region);
  const country = normalizeMapText(core?.country);
  const query = [preciseAddress, city, region, country]
    .filter((value, index, list) => Boolean(value) && list.indexOf(value) === index)
    .join(', ');

  return {
    latitude: latitude ?? 0,
    longitude: longitude ?? 0,
    ...(zoom ? { zoom } : {}),
    ...(query ? { query } : {}),
  };
}

function parseAmenities(core: Maybe<Partial<RawCore>>): AmenitiesModel {
  return sanitizeKnownAmenities(core?.amenities ?? [])
    .flatMap((a) => {
      const catalogItem = getKnownAmenityCatalogItem(a.id);

      return [{
        id: a.id,
        name: a.name ?? catalogItem?.name ?? '',
        description: a.description ?? catalogItem?.description,
        category: a.category ?? catalogItem?.category ?? '',
        relevance: Number.isFinite(Number(a.relevance)) ? Number(a.relevance) : 0,
        pinned: Boolean(a.pinned),
        perkEligible: typeof a.perkEligible === 'boolean' ? a.perkEligible : undefined,
        perkScore: Number.isFinite(Number(a.perkScore)) ? Number(a.perkScore) : undefined,
        perkPriority: Number.isFinite(Number(a.perkPriority)) ? Number(a.perkPriority) : undefined,
      }];
    });
}

function parseRooms(core: Maybe<Partial<RawCore>>): RoomsModel {
  const rooms = normalizeRooms(core);
  const byType = groupRoomsByType(rooms);
  const summary = summarizeAll(rooms);

  return {
    rooms,
    summary,
    byType,
  };
}

function parseBookings(core: Maybe<Partial<RawCore>>, bookings: Maybe<Partial<RawBookings>>): BookingsModel {
  const bookedDays = getSynchronizedBookedDays(bookings ?? null)
  const basePrice = Math.max(0, Number(bookings?.price ?? 0) || 0)
  const weekend = resolveWeekendPricing(bookings?.pricing ?? null, basePrice)
  const rules = resolveListingReservationRules({
    core: core ?? null,
    bookings: bookings ?? null,
  })
  return {
    price: basePrice,
    bookedDays: bookedDays.map(d => ({ start: d.start, end: d.end })),
    fees: normalizeFeeItems(bookings?.fees),
    rules,
    ...(weekend
      ? {
        weekend: {
          enabled: weekend.enabled,
          price: weekend.price,
        },
      }
      : {}),
  };
}

function parseMedias(medias: Maybe<Partial<RawMedias>>): MediasModel {
  const rawImages = Array.isArray(medias?.images) ? medias.images : []
  const validImages = rawImages.filter((image) => typeof image?.src === 'string' && image.src.trim())

  return {
    images: validImages.map((i, idx) => ({
      src: i.src.trim(),
      alt: i.alt,
      position: typeof i.position === 'number' ? i.position : idx,
    })),
    videos: medias?.videos ?? [],
  };
}

function parseNotes(notes: Maybe<Partial<RawNotes>>): NotesModel {
  return {
    overall: notes?.note?.note,
    distribution: notes?.note?.distribution,
    source: notes?.note?.source,
    reviewCount: notes?.note?.reviewCount,
    otas: (notes?.['otas-note'] || [])
      .filter((n) => typeof n?.note === 'number' && !Number.isNaN(n.note))
      .map(n => ({
        ota: n.ota as any,
        note: n.note as number,
        distribution: n.distribution,
        reviewCount: n.reviewCount,
        sourceLabel: n.sourceLabel,
      })),
  };
}

function parseReviewsVisibility(core: Maybe<Partial<RawCore>>): ReviewsVisibilityModel {
  const raw = (core as Record<string, unknown> | null | undefined)?.['reviews-display']
  if (raw && typeof raw === 'object') {
    const typed = raw as Record<string, unknown>
    return {
      indiehost: typed.indiehost !== false,
      airbnb: typed.airbnb !== false,
      booking: typed.booking !== false,
    }
  }

  return {
    indiehost: true,
    airbnb: true,
    booking: true,
  }
}

function parseComments(raw: Maybe<Partial<RawComments>>): { pages: CommentsPagesModel; flat: CommentsModel } {
  const pages = (raw?.comments || []).map(page =>
    page.map(c => ({
      avatar: c['profile-pic'],
      name: c.name,
      note: c.note,
      comment: c.comment,
      stayDates: c['stay-dates'],
    })),
  );

  const flat = pages.flat();

  if (import.meta.env.DEV) {
    console.log(`${flat.length ? 'ƒo.' : 'ƒ?O'} [useParseContent.ts](parseComments) comments:parse parsedCount=${flat.length} ready`);
    console.log(`${'ƒ"û‹÷?'} [useParseContent.ts](parseComments) comments:pagesDetected pagesCount=${pages.length} loaded`);
  }

  return { pages, flat };
}

// ---- UTIL PRINCIPAL ----
export function core(raw: RawListingBundle): ListingParsed {
  const parsedComments = parseComments(raw.comments);
  // if (import.meta.env.DEV) {
  //   console.log(`${parsedComments.flat.length ? 'ƒo.' : 'ƒ?O'} [useParseContent.ts](core) core:load commentsCount=${parsedComments.flat.length} aggregated`);
  //   console.log(`${'ƒ"û‹÷?'} [useParseContent.ts](core) core:commentsPages available=${parsedComments.pages.length} cached`);
  // }

  return {
    title: parseTitle(raw.core),
    perks: parsePerks(raw),
    hostProfile: parseHost(raw.host),
    description: parseDescription(raw.core),
    map: parseMap(raw.core),
    amenities: parseAmenities(raw.core),
    rooms: parseRooms(raw.core),
    bookings: parseBookings(raw.core, raw.bookings),
    medias: parseMedias(raw.medias),
    notes: parseNotes(raw.notes),
    comments: parsedComments.flat,
    commentsPages: parsedComments.pages,
    reviewsVisibility: parseReviewsVisibility(raw.core),
  };
}

// ---- EXEMPLE Dƒ?TUSAGE ----
// const data = core({ core, host, bookings, medias, notes, comments });
// const bedroom = data.rooms.byType['bedroom']; // accÇùs direct demandÇ¸
// console.log(bedroom.length, bedroom.beds, data.rooms.summary.capacityTotal);
