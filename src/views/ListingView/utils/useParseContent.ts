// File: src/views/ListingView/utils/useParseContent.ts

// --- MODE: "local-json" pour le MVP / "remote" pour le backend ---
const USE_REMOTE = false;

// ---- LOCAL JSON (MVP) ----
import coreJSON from '@/content/fr/ListingTest/core.json';
import bookingsJSON from '@/content/fr/ListingTest/bookings.json';
import mediasJSON from '@/content/fr/ListingTest/medias.json';
import amenitiesJSON from '@/content/fr/ListingTest/amenities.json';
import notesJSON from '@/content/fr/ListingTest/notes.json';
import commentsJSON from '@/content/fr/ListingTest/comments.json';

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
} from '@/views/ListingView/types/listing';

// Typages "bruts" déduits des JSON exemples
type RawCore = typeof coreJSON;
type RawBookings = typeof bookingsJSON;
type RawMedias = typeof mediasJSON;
type RawAmenities = typeof amenitiesJSON;
type RawNotes = typeof notesJSON;
type RawComments = typeof commentsJSON;

// ---- FETCH distant (inactif tant que USE_REMOTE=false) ----
async function fetchRemote<T>(url: string): Promise<T> {
  const { default: axios } = await import('axios'); // import dynamique
  const { data } = await axios.get<T>(url, { withCredentials: false });
  return data;
}

// ---- LOADERS ----
async function loadCore(): Promise<RawCore> {
  if (USE_REMOTE) return fetchRemote<RawCore>('/api/listings/53028879/core');
  return coreJSON as RawCore;
}
async function loadBookings(): Promise<RawBookings> {
  if (USE_REMOTE) return fetchRemote<RawBookings>('/api/listings/53028879/bookings');
  return bookingsJSON as RawBookings;
}
async function loadMedias(): Promise<RawMedias> {
  if (USE_REMOTE) return fetchRemote<RawMedias>('/api/listings/53028879/medias');
  return mediasJSON as RawMedias;
}
async function loadAmenities(): Promise<RawAmenities> {
  if (USE_REMOTE) return fetchRemote<RawAmenities>('/api/listings/53028879/amenities');
  return amenitiesJSON as RawAmenities;
}
async function loadNotes(): Promise<RawNotes> {
  if (USE_REMOTE) return fetchRemote<RawNotes>('/api/listings/53028879/notes');
  return notesJSON as RawNotes;
}
async function loadComments(): Promise<RawComments> {
  if (USE_REMOTE) return fetchRemote<RawComments>('/api/listings/53028879/comments');
  return commentsJSON as RawComments;
}

/* ------------------------------------------------------------------ */
/* ----------------------- HELPERS “ROOMS” -------------------------- */
/* ------------------------------------------------------------------ */

// Normalise les rooms brutes du core.json -> RoomItem[]
function normalizeRooms(core: RawCore): RoomItem[] {
  return (core.rooms ?? []).map(r => ({
    name: r['room-name'],
    type: r['room-type'],
    beds: (r.beds ?? []).map(b => ({
      type: b.type,
      capacity: b.capacity,
      quantity: b.quantity,
    })),
  }));
}

// Regroupe les rooms par type et calcule beds / capacity cumulés
function groupRoomsByType(rooms: RoomItem[]): RoomsByType {
  const byType: RoomsByType = {};
  for (const r of rooms) {
    const key = r.type; // ex: 'bedroom', 'living-room'
    if (!byType[key]) byType[key] = { rooms: [], length: 0, beds: 0, capacity: 0 };
    byType[key].rooms.push(r);
    byType[key].length += 1;
    if (byType[key].beds) { byType[key].beds += r.beds.reduce((acc, b) => acc + b.quantity, 0); }
    byType[key].capacity += r.beds.reduce((acc, b) => acc + b.capacity * b.quantity, 0);
  }
  return byType;
}

// Résumé global (toutes pièces)
function summarizeAll(rooms: RoomItem[]) {
  const bedsCount = rooms.reduce(
    (acc, r) => acc + r.beds.reduce((a, b) => a + b.quantity, 0),
    0,
  );
  const capacityTotal = rooms.reduce(
    (acc, r) => acc + r.beds.reduce((a, b) => a + b.capacity * b.quantity, 0),
    0,
  );
  return {
    roomsCount: rooms.length,
    bedsCount,
    capacityTotal,
  };
}

// Utilitaires d’agrégation par type
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
    location: {
      city: core.city ?? '',
      region: core.region ?? '',
      country: core.country ?? '',
    },
    capacity: core.capacity,
    bedrooms: { quantity: bedroom.length, bed: bedroom.beds },
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
    brief: core.brief,
    blocks: core.description.map(b => ({ title: b.title, content: b.content })),
  };
}

function parseAmenities(amenities: RawAmenities): AmenitiesModel {
  return amenities.amenities.map(a => ({ name: a.name, description: a.description, icon: a.icon }));
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
  };
}

function parseMedias(medias: RawMedias): MediasModel {
  return {
    images: medias.images.map(i => ({ src: i.src, alt: i.alt })),
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

function parseComments(raw: RawComments): CommentsModel {
  return raw.comments.map(c => ({
    avatar: c['profile-pic'],
    name: c.name,
    note: c.note,
    comment: c.comment,
    stayDates: c['stay-dates'],
  }));
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

  return {
    title: parseTitle(core),
    perks: parsePerks(core),
    hostProfile: parseHost(core),
    description: parseDescription(core),
    amenities: parseAmenities(amenities),
    rooms: parseRooms(core),
    bookings: parseBookings(bookings),
    medias: parseMedias(medias),
    notes: parseNotes(notes),
    comments: parseComments(comments),
  };
}

// ---- EXEMPLE D’USAGE ----
// const data = await listingCore();
// const bedroom = data.rooms.byType['bedroom']; // accès direct demandé
// console.log(bedroom.length, bedroom.beds, data.rooms.summary.capacityTotal);
