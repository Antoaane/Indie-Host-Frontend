// File: src/views/ListingView/utils/useParseContent.ts

import {
  loadCore,
  loadBookings,
  loadMedias,
  loadAmenities,
  loadNotes,
  loadComments,
} from './fetchListingRaw';

import type {
  RawCore,
  RawBookings,
  RawMedias,
  RawAmenities,
  RawNotes,
  RawComments,
} from './fetchListingRaw';

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
} from '@/views/ListingView/types/listing';

/* ------------------------------------------------------------------ */
/* ----------------------- HELPERS ƒ?oROOMSƒ?? -------------------------- */
/* ------------------------------------------------------------------ */

// Normalise les rooms brutes du core.json -> RoomItem[]
function normalizeRooms(core: RawCore): RoomItem[] {
  return (core.rooms ?? []).map(r => ({
    name: r['room-name'],
    type: r.type,
    // ƒªÎ‹÷? NE PAS forcer [] : on ne met "beds" que s'il y en a
    ...(r.beds && r.beds.length
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
function parseTitle(core: RawCore): TitleModel {
  const type = (core.type ?? '').split(' / ')[0].trim() || core.type;

  const rooms = normalizeRooms(core);
  const byType = groupRoomsByType(rooms);

  const bedroom = getTypeEntry(byType, 'bedroom');
  const bathrooms = sumLengthsMatching(byType, k => k.toLowerCase().includes('bath'));

  return {
    title: core.title,
    type,
    location: { city: core.city ?? '', region: core.region ?? '', country: core.country ?? '' },
    guest_capacity: core.guest_capacity,
    bedrooms: { quantity: bedroom.length, bed: bedroom.beds ?? 0 }, // ƒª.‹÷? safe
    bathrooms,
  };
}


function parsePerks(core: RawCore): PerksModel {
  return core.perks.map(p => ({ icon: p.icon, name: p.name, description: p.description }));
}

function parseHost(core: RawCore): HostProfileModel {
  return {
    name: core.host.name,
    status: core.host.status,
    seniority: core.host.seniority,
    globalNote: core.host['global-note'],
    avatar: core.host.avatar,
    catalogLink: core.host['catalog-link'],
  };
}

function parseDescription(core: RawCore): DescriptionModel {
  return {
    description: core.description,
    // blocks: core.description.map(b => ({ title: b.title, content: b.content })),
  };
}

function parseMap(core: RawCore): MapModel {
  const latitude = Number(core.latitude ?? core.lat ?? 0);
  const longitude = Number(core.longitude ?? core.lng ?? 0);
  const zoom = typeof core.zoom === 'number' ? core.zoom : undefined;

  return {
    latitude,
    longitude,
    ...(zoom ? { zoom } : {}),
  };
}

function parseAmenities(amenities: RawAmenities): AmenitiesModel {
  return amenities.amenities.map((a) => ({
    name: a.name,
    description: a.description,
    icon: a.icon,
    category: a.category,
    relevance: a.relevance,
    pinned: Boolean(a.pinned),
  }));
}

function parseRooms(core: RawCore): RoomsModel {
  const rooms = normalizeRooms(core);
  const byType = groupRoomsByType(rooms);
  const summary = summarizeAll(rooms);

  return {
    rooms,
    summary,
    byType,
  };
}

function parseBookings(bookings: RawBookings): BookingsModel {
  return {
    price: bookings.price,
    bookedDays: bookings['booked-days'].map(d => ({ start: d.start, end: d.end })),
    fees: (bookings.fees ?? []).map(fee => ({ name: fee.name, amount: fee.amount })),
  };
}

function parseMedias(medias: RawMedias): MediasModel {
  return {
    images: medias.images.map(i => ({
      src: i.src,
      alt: i.alt,
      ...(typeof i.cover === 'boolean' ? { cover: i.cover } : {}),
    })),
    videos: medias.videos ?? [],
  };
}

function parseNotes(notes: RawNotes): NotesModel {
  return {
    overall: notes.note?.note,
    distribution: notes.note?.distribution,
    otas: (notes['otas-note'] || []).map(n => ({
      ota: n.ota as any,
      note: n.note,
      distribution: n.distribution,
    })),
  };
}

function parseComments(raw: RawComments): { pages: CommentsPagesModel; flat: CommentsModel } {
  const pages = (raw.comments || []).map(page =>
    page.map(c => ({
      avatar: c['profile-pic'],
      name: c.name,
      note: c.note,
      comment: c.comment,
      stayDates: c['stay-dates'],
    })),
  );

  const flat = pages.flat();

  console.log(`${flat.length ? 'ƒo.' : 'ƒ?O'} [useParseContent.ts](parseComments) comments:parse parsedCount=${flat.length} ready`);
  console.log(`${'ƒ"û‹÷?'} [useParseContent.ts](parseComments) comments:pagesDetected pagesCount=${pages.length} loaded`);

  return { pages, flat };
}

// ---- UTIL PRINCIPAL ----
export async function listingCore(): Promise<ListingParsed> {
  const [core, bookings, medias, amenities, notes, comments] = await Promise.all([
    loadCore(),
    loadBookings(),
    loadMedias(),
    loadAmenities(),
    loadNotes(),
    loadComments(),
  ]);

  const parsedComments = parseComments(comments);
  console.log(`${parsedComments.flat.length ? 'ƒo.' : 'ƒ?O'} [useParseContent.ts](listingCore) listingCore:load commentsCount=${parsedComments.flat.length} aggregated`);
  console.log(`${'ƒ"û‹÷?'} [useParseContent.ts](listingCore) listingCore:commentsPages available=${parsedComments.pages.length} cached`);

  return {
    title: parseTitle(core),
    perks: parsePerks(core),
    hostProfile: parseHost(core),
    description: parseDescription(core),
    map: parseMap(core),
    amenities: parseAmenities(amenities),
    rooms: parseRooms(core),
    bookings: parseBookings(bookings),
    medias: parseMedias(medias),
    notes: parseNotes(notes),
    comments: parsedComments.flat,
    commentsPages: parsedComments.pages,
  };
}

// ---- EXEMPLE Dƒ?TUSAGE ----
// const data = await listingCore();
// const bedroom = data.rooms.byType['bedroom']; // accÇùs direct demandÇ¸
// console.log(bedroom.length, bedroom.beds, data.rooms.summary.capacityTotal);
