// File: src/views/ListingView/utils/useParseContent.ts

import type {
  RawCore,
  RawBookings,
  RawMedias,
  RawNotes,
  RawComments,
  RawHost,
} from '@/views/Listing/utils/fetchListingRaw';

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

export type RawListingBundle = {
  core?: Partial<RawCore> | null;
  bookings?: Partial<RawBookings> | null;
  medias?: Partial<RawMedias> | null;
  notes?: Partial<RawNotes> | null;
  comments?: Partial<RawComments> | null;
  host?: Partial<RawHost> | null;
};

type Maybe<T> = T | null | undefined;

/* ------------------------------------------------------------------ */
/* ----------------------- HELPERS ƒ?oROOMSƒ?? -------------------------- */
/* ------------------------------------------------------------------ */

// Normalise les rooms brutes du core.json -> RoomItem[]
function normalizeRooms(core: Maybe<Partial<RawCore>>): RoomItem[] {
  return (core?.rooms ?? []).map(r => ({
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


function parsePerks(core: Maybe<Partial<RawCore>>): PerksModel {
  return (core?.perks ?? []).map(p => ({ icon: p.icon, name: p.name, description: p.description }));
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

function parseMap(core: Maybe<Partial<RawCore>>): MapModel {
  const latitude = Number(core?.latitude ?? core?.lat ?? 0);
  const longitude = Number(core?.longitude ?? core?.lng ?? 0);
  const zoom = typeof core?.zoom === 'number' ? core.zoom : undefined;

  return {
    latitude,
    longitude,
    ...(zoom ? { zoom } : {}),
  };
}

function parseAmenities(core: Maybe<Partial<RawCore>>): AmenitiesModel {
  return (core?.amenities ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    category: a.category,
    relevance: a.relevance,
    pinned: Boolean(a.pinned),
  }));
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

function parseBookings(bookings: Maybe<Partial<RawBookings>>): BookingsModel {
  return {
    price: bookings?.price ?? 0,
    bookedDays: (bookings?.['booked-days'] ?? []).map(d => ({ start: d.start, end: d.end })),
    fees: (bookings?.fees ?? []).map(fee => ({ name: fee.name, amount: fee.amount })),
  };
}

function parseMedias(medias: Maybe<Partial<RawMedias>>): MediasModel {
  return {
    images: (medias?.images ?? []).map((i, idx) => ({
      src: i.src,
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
    otas: (notes?.['otas-note'] || []).map(n => ({
      ota: n.ota as any,
      note: n.note,
      distribution: n.distribution,
    })),
  };
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
    perks: parsePerks(raw.core),
    hostProfile: parseHost(raw.host),
    description: parseDescription(raw.core),
    map: parseMap(raw.core),
    amenities: parseAmenities(raw.core),
    rooms: parseRooms(raw.core),
    bookings: parseBookings(raw.bookings),
    medias: parseMedias(raw.medias),
    notes: parseNotes(raw.notes),
    comments: parsedComments.flat,
    commentsPages: parsedComments.pages,
  };
}

// ---- EXEMPLE Dƒ?TUSAGE ----
// const data = core({ core, host, bookings, medias, notes, comments });
// const bedroom = data.rooms.byType['bedroom']; // accÇùs direct demandÇ¸
// console.log(bedroom.length, bedroom.beds, data.rooms.summary.capacityTotal);
