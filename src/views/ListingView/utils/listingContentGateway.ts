// File: src/views/ListingView/utils/listingContentGateway.ts

// Static fallbacks
import coreJSON from '@/content/fr/ListingTest/core.json';
import bookingsJSON from '@/content/fr/ListingTest/bookings.json';
import mediasJSON from '@/content/fr/ListingTest/medias.json';
import notesJSON from '@/content/fr/ListingTest/notes.json';
import commentsJSON from '@/content/fr/ListingTest/comments.json';
import hostJSON from '@/content/fr/ListingTest/host.json';

export type RawCore = (typeof coreJSON) & { lat?: number; lng?: number; zoom?: number };
export type RawBookings = typeof bookingsJSON;
export type RawMedias = typeof mediasJSON;
export type RawNotes = typeof notesJSON;
export type RawComments = typeof commentsJSON;
export type RawHost = typeof hostJSON;

export type RawSegments = {
  core: RawCore;
  bookings: RawBookings;
  medias: RawMedias;
  notes: RawNotes;
  comments: RawComments;
  host: RawHost;
};

export const DEFAULT_LISTING_ID = (coreJSON as { id?: string }).id || 'listing-test';

type SegmentKey = keyof RawSegments;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asString = (value: unknown) => (typeof value === 'string' ? value : undefined);
const asBoolean = (value: unknown) => (typeof value === 'boolean' ? value : undefined);
const asNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const wrapFallbackText = (value: string, useFallback: boolean) =>
  useFallback ? `<span class="fallback-warning">${value}</span>` : value;

type Issue = { key: string; expected: string; received: unknown };
type SanitizeResult<T> = { data: Partial<T>; issues: Issue[] };

const logIssues = (segment: SegmentKey, issues: Issue[]) => {
  if (!issues.length) return;
  console.log(`[listingContentGateway] fallback segment=${segment}`, {
    segment,
    issues: issues.map(issue => ({
      key: issue.key,
      expected: issue.expected,
      received: issue.received ?? 'absent',
    })),
  });
};

const sanitizeDistribution = (value: unknown) => {
  if (!isObject(value)) return undefined;
  const entries = Object.entries(value).reduce<Record<string, number>>((acc, [k, v]) => {
    const num = asNumber(v);
    if (num !== undefined) acc[k] = num;
    return acc;
  }, {});
  return Object.keys(entries).length ? entries : undefined;
};

function sanitizeCore(input: unknown): SanitizeResult<RawCore> {
  if (!isObject(input)) return { data: {}, issues: [{ key: 'core', expected: 'object', received: input ?? 'absent' }] };
  const safe: Partial<RawCore> = {};
  const issues: Issue[] = [];
  const address = isObject((input as Record<string, unknown>).address)
    ? ((input as Record<string, unknown>).address as Record<string, unknown>)
    : undefined;

  const idRaw = (input as Record<string, unknown>).id;
  const titleRaw = (input as Record<string, unknown>).title;
  const typeRaw = (input as Record<string, unknown>).type;
  const briefRaw = (input as Record<string, unknown>).brief;
  const cityRaw = (input as Record<string, unknown>).city ?? address?.city;
  const regionRaw = (input as Record<string, unknown>).region ?? address?.region;
  const countryRaw = (input as Record<string, unknown>).country ?? address?.country;

  const id = asString(idRaw);
  const title = asString(titleRaw);
  const type = asString(typeRaw);
  const brief = asString(briefRaw);
  const city = asString(cityRaw);
  const region = asString(regionRaw);
  const country = asString(countryRaw);

  if (id) safe.id = id as never;
  else issues.push({ key: 'id', expected: 'string', received: idRaw ?? 'absent' });

  if (title) safe.title = title as never;
  else issues.push({ key: 'title', expected: 'string', received: titleRaw ?? 'absent' });

  if (type) safe.type = type as never;
  else issues.push({ key: 'type', expected: 'string', received: typeRaw ?? 'absent' });

  if (city) safe.city = city as never;
  else issues.push({ key: 'city', expected: 'string', received: cityRaw ?? 'absent' });

  if (region) safe.region = region as never;
  else issues.push({ key: 'region', expected: 'string', received: regionRaw ?? 'absent' });

  if (country) safe.country = country as never;
  else issues.push({ key: 'country', expected: 'string', received: countryRaw ?? 'absent' });

  if (brief) safe.brief = brief as never;
  else issues.push({ key: 'brief', expected: 'string', received: briefRaw ?? 'absent' });

  const capacity = asNumber((input as Record<string, unknown>).capacity);
  if (capacity !== undefined) safe.capacity = capacity as never;
  else issues.push({ key: 'capacity', expected: 'number', received: (input as Record<string, unknown>).capacity ?? 'absent' });

  const latitude = asNumber((input as Record<string, unknown>).latitude ?? (input as Record<string, unknown>).lat);
  if (latitude !== undefined) safe.latitude = latitude as never;
  else issues.push({ key: 'latitude', expected: 'number', received: (input as Record<string, unknown>).latitude ?? (input as Record<string, unknown>).lat ?? 'absent' });

  const longitude = asNumber((input as Record<string, unknown>).longitude ?? (input as Record<string, unknown>).lng);
  if (longitude !== undefined) safe.longitude = longitude as never;
  else issues.push({ key: 'longitude', expected: 'number', received: (input as Record<string, unknown>).longitude ?? (input as Record<string, unknown>).lng ?? 'absent' });

  const zoom = asNumber((input as Record<string, unknown>).zoom);
  if (zoom !== undefined) safe.zoom = zoom as never;

  const roomsSource = (input as Record<string, unknown>).rooms;
  if (Array.isArray(roomsSource)) {
    const rooms = (roomsSource as unknown[])
      .map((room: unknown) => {
        if (!isObject(room)) return null;
        const roomObj = room as Record<string, unknown>;
        const type = asString(roomObj.type);
        if (!type) return null;

        const normalized: Record<string, unknown> = { type };
        const roomName = asString(roomObj['room-name'] ?? roomObj.name);
        if (roomName) normalized['room-name'] = roomName;

        if (Array.isArray(roomObj.beds)) {
          const beds = roomObj.beds
            .map((bed: unknown) => {
              if (!isObject(bed)) return null;
              const bedObj = bed as Record<string, unknown>;
              const bedType = asString(bedObj.type);
              const capacity = asNumber(bedObj.capacity);
              const quantity = asNumber(bedObj.quantity);
              if (!bedType || capacity === undefined || quantity === undefined) return null;
              return { type: bedType, capacity, quantity };
            })
            .filter(Boolean);

          if (beds.length) normalized.beds = beds;
        }

        return normalized as RawCore['rooms'][number];
      })
      .filter(Boolean);

    if (rooms.length) safe.rooms = rooms as RawCore['rooms'];
    else issues.push({ key: 'rooms', expected: 'array<room>', received: roomsSource });
  }
  else {
    issues.push({ key: 'rooms', expected: 'array', received: roomsSource ?? 'absent' });
  }

  const perksSource = (input as Record<string, unknown>).perks;
  if (Array.isArray(perksSource)) {
    const perks = (perksSource as unknown[])
      .map((perk: unknown) => {
        if (!isObject(perk)) return null;
        const perkObj = perk as Record<string, unknown>;
        const icon = asString(perkObj.icon);
        const name = asString(perkObj.name);
        const description = asString(perkObj.description);
        if (!icon || !name) return null;
        return description ? { icon, name, description } : { icon, name };
      })
      .filter(Boolean);

    if (perks.length) safe.perks = perks as RawCore['perks'];
    else issues.push({ key: 'perks', expected: 'array<perk>', received: perksSource });
  }
  else {
    issues.push({ key: 'perks', expected: 'array', received: perksSource ?? 'absent' });
  }

  const amenitiesSource = (input as Record<string, unknown>).amenities;
  if (Array.isArray(amenitiesSource)) {
    const amenities = (amenitiesSource as unknown[])
      .map((amenity: unknown) => {
        if (!isObject(amenity)) return null;
        const amenityObj = amenity as Record<string, unknown>;
        const name = asString(amenityObj.name);
        const description = asString(amenityObj.description);
        const icon = asString(amenityObj.icon);
        const category = asString(amenityObj.category);
        const relevance = asNumber(amenityObj.relevance);
        const pinned = asBoolean(amenityObj.pinned);
        if (!name || !icon || !category || relevance === undefined) return null;
        return {
          name,
          description,
          icon,
          category,
          relevance,
          pinned: Boolean(pinned),
        };
      })
      .filter(Boolean);

    if (amenities.length) safe.amenities = amenities as RawCore['amenities'];
    else issues.push({ key: 'amenities', expected: 'array<amenity>', received: amenitiesSource });
  }
  else {
    issues.push({ key: 'amenities', expected: 'array', received: amenitiesSource ?? 'absent' });
  }

  const descriptionSource = (input as Record<string, unknown>).description;
  if (Array.isArray(descriptionSource)) {
    const blocks = (descriptionSource as unknown[])
      .map((block: unknown) => {
        if (!isObject(block)) return null;
        const blockObj = block as Record<string, unknown>;
        const title = asString(blockObj.title);
        const content = asString(blockObj.content);
        if (!title || !content) return null;
        return { title, content };
      })
      .filter(Boolean);

    if (blocks.length) safe.description = blocks as RawCore['description'];
    else issues.push({ key: 'description', expected: 'array<block>', received: descriptionSource });
  }
  else {
    issues.push({ key: 'description', expected: 'array', received: descriptionSource ?? 'absent' });
  }

  return { data: safe, issues };
}

function sanitizeHost(input: unknown): SanitizeResult<RawHost> {
  if (!isObject(input)) return { data: {}, issues: [{ key: 'host', expected: 'object', received: input ?? 'absent' }] };
  const safe: Partial<RawHost> = {};
  const issues: Issue[] = [];

  const name = asString((input as Record<string, unknown>).name);
  const status = asString((input as Record<string, unknown>).status);
  const seniority = asNumber((input as Record<string, unknown>).seniority);
  const globalNote = asNumber(
    (input as Record<string, unknown>)['global-note'] ??
    (input as Record<string, unknown>).globalNote,
  );
  const avatar = asString(
    (input as Record<string, unknown>).avatar ??
    (input as Record<string, unknown>).picture,
  );
  const catalogLink = asString(
    (input as Record<string, unknown>)['catalog-link'] ??
    (input as Record<string, unknown>).catalogLink,
  );

  if (name) safe.name = name as never;
  if (status) safe.status = status as never;
  if (seniority !== undefined) safe.seniority = seniority as never;
  if (globalNote !== undefined) safe['global-note'] = globalNote as never;
  if (avatar) safe.avatar = avatar as never;
  if (catalogLink) safe['catalog-link'] = catalogLink as never;

  return { data: safe, issues };
}

function sanitizeBookings(input: unknown): SanitizeResult<RawBookings> {
  if (!isObject(input)) return { data: {}, issues: [{ key: 'bookings', expected: 'object', received: input ?? 'absent' }] };
  const safe: Partial<RawBookings> = {};
  const issues: Issue[] = [];

  const price = asNumber((input as Record<string, unknown>).price);
  if (price !== undefined) safe.price = price as never;
  else issues.push({ key: 'price', expected: 'number', received: (input as Record<string, unknown>).price ?? 'absent' });

  const bookedSource =
    (input as Record<string, unknown>)['booked-days'] ??
    (input as Record<string, unknown>).bookedDays;

  if (Array.isArray(bookedSource)) {
    const bookedDays = (bookedSource as unknown[])
      .map((item: unknown) => {
        if (!isObject(item)) return null;
        const itemObj = item as Record<string, unknown>;
        const start = asString(itemObj.start);
        const end = asString(itemObj.end);
        if (!start || !end) return null;
        return { start, end };
      })
      .filter(Boolean);

    if (bookedDays.length) safe['booked-days'] = bookedDays as RawBookings['booked-days'];
    else issues.push({ key: 'booked-days', expected: 'array<range>', received: bookedSource });
  }
  else {
    issues.push({ key: 'booked-days', expected: 'array', received: bookedSource ?? 'absent' });
  }

  const feesSource = (input as Record<string, unknown>).fees;
  if (Array.isArray(feesSource)) {
    const fees = (feesSource as unknown[])
      .map((fee: unknown) => {
        if (!isObject(fee)) return null;
        const feeObj = fee as Record<string, unknown>;
        const name = asString(feeObj.name);
        const amount = asNumber(feeObj.amount);
        if (!name || amount === undefined) return null;
        return { name, amount };
      })
      .filter(Boolean);

    if (fees.length) safe.fees = fees as RawBookings['fees'];
    else issues.push({ key: 'fees', expected: 'array<fee>', received: feesSource });
  }
  else if (feesSource !== undefined) {
    issues.push({ key: 'fees', expected: 'array', received: feesSource });
  }

  return { data: safe, issues };
}

function sanitizeMedias(input: unknown): SanitizeResult<RawMedias> {
  if (!isObject(input)) return { data: {}, issues: [{ key: 'medias', expected: 'object', received: input ?? 'absent' }] };
  const safe: Partial<RawMedias> = {};
  const issues: Issue[] = [];

  const imagesSource = (input as Record<string, unknown>).images;
  if (Array.isArray(imagesSource)) {
    const images = (imagesSource as unknown[])
      .map((image: unknown) => {
        if (!isObject(image)) return null;
        const imageObj = image as Record<string, unknown>;
        const src = asString(imageObj.src ?? imageObj.url);
        const alt = asString(
          imageObj.alt ?? imageObj.title ?? imageObj.description,
        );
        const cover = asBoolean(imageObj.cover);
        if (!src || !alt) return null;
        return cover !== undefined ? { src, alt, cover } : { src, alt };
      })
      .filter(Boolean);

    if (images.length) safe.images = images as RawMedias['images'];
    else issues.push({ key: 'images', expected: 'array<image>', received: imagesSource });
  }
  else {
    issues.push({ key: 'images', expected: 'array', received: imagesSource ?? 'absent' });
  }

  const videosSource = (input as Record<string, unknown>).videos;
  if (Array.isArray(videosSource)) {
    const videos = (videosSource as unknown[])
      .map((video: unknown) => {
        if (typeof video === 'string') return { src: video };
        if (!isObject(video)) return null;
        const videoObj = video as Record<string, unknown>;
        const src = asString(videoObj.src ?? videoObj.url);
        if (!src) return null;
        const poster = asString(videoObj.poster);
        const alt = asString(videoObj.alt);
        return {
          src,
          ...(poster ? { poster } : {}),
          ...(alt ? { alt } : {}),
        };
      })
      .filter(Boolean);

    if (videos.length) safe.videos = videos as RawMedias['videos'];
    else issues.push({ key: 'videos', expected: 'array<video>', received: videosSource });
  }
  else if (videosSource !== undefined) {
    issues.push({ key: 'videos', expected: 'array', received: videosSource });
  }

  return { data: safe, issues };
}

function sanitizeNotes(input: unknown): SanitizeResult<RawNotes> {
  if (!isObject(input)) return { data: {}, issues: [{ key: 'notes', expected: 'object', received: input ?? 'absent' }] };
  const safe: Partial<RawNotes> = {};
  const issues: Issue[] = [];

  if (isObject((input as Record<string, unknown>).note)) {
    const noteNode = (input as Record<string, unknown>).note as Record<string, unknown>;
    const noteValue = asNumber(noteNode.note ?? noteNode.overall);
    const distribution = sanitizeDistribution(noteNode.distribution);
    const payload: Record<string, unknown> = {};
    if (noteValue !== undefined) payload.note = noteValue;
    if (distribution) payload.distribution = distribution;
    if (Object.keys(payload).length) safe.note = payload as RawNotes['note'];
  }
  else {
    issues.push({ key: 'note', expected: 'object', received: (input as Record<string, unknown>).note ?? 'absent' });
  }

  if (Array.isArray((input as Record<string, unknown>)['otas-note'])) {
    const otas = ((input as Record<string, unknown>)['otas-note'] as unknown[])
      .map((ota: unknown) => {
        if (!isObject(ota)) return null;
        const otaObj = ota as Record<string, unknown>;
        const otaName = asString(otaObj.ota);
        const note = asNumber(otaObj.note);
        const distribution = sanitizeDistribution(otaObj.distribution);
        if (!otaName || note === undefined) return null;
        return {
          ota: otaName,
          note,
          ...(distribution ? { distribution } : {}),
        };
      })
      .filter(Boolean);

    if (otas.length) safe['otas-note'] = otas as RawNotes['otas-note'];
  }
  else if ((input as Record<string, unknown>)['otas-note'] !== undefined) {
    issues.push({ key: 'otas-note', expected: 'array', received: (input as Record<string, unknown>)['otas-note'] });
  }

  return { data: safe, issues };
}

function sanitizeComments(input: unknown): SanitizeResult<RawComments> {
  if (!isObject(input)) return { data: {}, issues: [{ key: 'comments', expected: 'object', received: input ?? 'absent' }] };
  const safe: Partial<RawComments> = {};
  const issues: Issue[] = [];

  const commentsSource = (input as Record<string, unknown>).comments;
  if (Array.isArray(commentsSource)) {
    const pages = (commentsSource as unknown[])
      .map((page: unknown) => {
        if (!Array.isArray(page)) return null;
        const items = (page as unknown[])
          .map((comment: unknown) => {
            if (!isObject(comment)) return null;
            const commentObj = comment as Record<string, unknown>;
            const name = asString(commentObj.name);
            const note = asNumber(commentObj.note);
            const text = asString(commentObj.comment ?? commentObj.text);
            const avatar = asString(
              commentObj['profile-pic'] ??
              commentObj.avatar ??
              commentObj.profilePic,
            );
            const stayNode =
              commentObj['stay-dates'] ??
              commentObj.stayDates;
            const stayDates = isObject(stayNode)
              ? {
                start: asString((stayNode as Record<string, unknown>).start),
                end: asString((stayNode as Record<string, unknown>).end),
              }
              : undefined;

            if (!name || note === undefined || !text) return null;
            return {
              name,
              note,
              comment: text,
              ...(avatar ? { 'profile-pic': avatar } : {}),
              ...(stayDates?.start && stayDates.end ? { 'stay-dates': stayDates } : {}),
            };
          })
          .filter(Boolean);

        return items.length ? items : null;
      })
      .filter(Boolean);

    if (pages.length) safe.comments = pages as RawComments['comments'];
    else issues.push({ key: 'comments', expected: 'array<comment[]>', received: commentsSource });
  }
  else {
    issues.push({ key: 'comments', expected: 'array', received: commentsSource ?? 'absent' });
  }

  return { data: safe, issues };
}

const sanitizers: Record<SegmentKey, (input: unknown) => SanitizeResult<RawSegments[SegmentKey]>> = {
  core: sanitizeCore,
  host: sanitizeHost,
  bookings: sanitizeBookings,
  medias: sanitizeMedias,
  notes: sanitizeNotes,
  comments: sanitizeComments,
};

async function fetchSegment(segment: SegmentKey, listingId: string) {
  if (!API_BASE_URL) return null;
  const sanitizedId = encodeURIComponent(listingId);
  const url = `${API_BASE_URL}/listings/${segment}/${sanitizedId}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (_error) {
    return null;
  }
}

function mergeCore(staticData: RawCore, partial: Partial<RawCore>): RawCore {
  const fallbackTitle = partial.title === undefined;
  const fallbackType = partial.type === undefined;
  const fallbackCity = partial.city === undefined;
  const fallbackRegion = partial.region === undefined;
  const fallbackCountry = partial.country === undefined;
  const fallbackBrief = partial.brief === undefined;
  const fallbackRooms = !partial.rooms?.length;
  const fallbackPerks = !partial.perks?.length;
  const fallbackAmenities = !partial.amenities?.length;
  const fallbackDescription = !partial.description?.length;
  return {
    ...staticData,
    ...(partial.id ? { id: partial.id } : {}),
    title: wrapFallbackText(partial.title ?? staticData.title, fallbackTitle),
    type: wrapFallbackText(partial.type ?? staticData.type, fallbackType),
    city: wrapFallbackText(partial.city ?? staticData.city, fallbackCity),
    region: wrapFallbackText(partial.region ?? staticData.region, fallbackRegion),
    country: wrapFallbackText(partial.country ?? staticData.country, fallbackCountry),
    capacity: partial.capacity ?? staticData.capacity,
    latitude: partial.latitude ?? staticData.latitude,
    longitude: partial.longitude ?? staticData.longitude,
    ...(partial.zoom !== undefined ? { zoom: partial.zoom } : {}),
    rooms: (partial.rooms?.length ? partial.rooms : staticData.rooms).map(room => ({
      ...room,
      ['room-name']: room['room-name']
        ? wrapFallbackText(room['room-name'] as string, fallbackRooms)
        : room['room-name'],
      type: wrapFallbackText(room.type, fallbackRooms),
      ...(room.beds
        ? {
          beds: room.beds.map(bed => ({
            ...bed,
            type: wrapFallbackText(bed.type, fallbackRooms),
          })),
        }
        : {}),
    })),
    perks: (partial.perks?.length ? partial.perks : staticData.perks).map(perk => ({
      ...perk,
      name: wrapFallbackText(perk.name, fallbackPerks),
      ...(perk.description ? { description: wrapFallbackText(perk.description, fallbackPerks) } : {}),
    })),
    amenities: (partial.amenities?.length ? partial.amenities : staticData.amenities).map(amenity => ({
      ...amenity,
      name: wrapFallbackText(amenity.name, fallbackAmenities),
      ...(amenity.description ? { description: wrapFallbackText(amenity.description, fallbackAmenities) } : {}),
    })),
    brief: wrapFallbackText(partial.brief ?? staticData.brief, fallbackBrief),
    description: (partial.description?.length ? partial.description : staticData.description).map(desc => ({
      title: wrapFallbackText(desc.title, fallbackDescription),
      content: wrapFallbackText(desc.content, fallbackDescription),
    })),
  };
}

function mergeHost(staticData: RawHost, partial: Partial<RawHost>): RawHost {
  const fallbackHostName = partial.name === undefined;
  const fallbackHostStatus = partial.status === undefined;

  return {
    ...staticData,
    ...(partial.name ? { name: wrapFallbackText(partial.name, false) } : {}),
    ...(partial.status ? { status: wrapFallbackText(partial.status, false) } : {}),
    ...(partial.seniority !== undefined ? { seniority: partial.seniority } : {}),
    ...(partial['global-note'] !== undefined ? { 'global-note': partial['global-note'] } : {}),
    ...(partial.avatar ? { avatar: partial.avatar } : {}),
    ...(partial['catalog-link'] ? { 'catalog-link': partial['catalog-link'] } : {}),
    ...(fallbackHostName && staticData.name
      ? { name: wrapFallbackText(staticData.name, true) }
      : {}),
    ...(fallbackHostStatus && staticData.status
      ? { status: wrapFallbackText(staticData.status, true) }
      : {}),
  };
}

function mergeBookings(staticData: RawBookings, partial: Partial<RawBookings>): RawBookings {
  const fallbackFees = !partial.fees;
  const feesSource = partial.fees ?? staticData.fees;
  const merged: RawBookings = {
    price: partial.price ?? staticData.price,
    'booked-days': partial['booked-days']?.length
      ? partial['booked-days']
      : staticData['booked-days'],
    ...(feesSource
      ? {
        fees: feesSource.map(fee => ({
          ...fee,
          name: wrapFallbackText(fee.name, fallbackFees),
        })),
      }
      : {}),
  };

  return merged;
}

function mergeMedias(staticData: RawMedias, partial: Partial<RawMedias>): RawMedias {
  const fallbackImages = !partial.images?.length;
  const fallbackVideos = !partial.videos;
  return {
    images: (partial.images?.length ? partial.images : staticData.images).map(image => ({
      ...image,
      alt: wrapFallbackText(image.alt, fallbackImages),
    })),
    videos: (partial.videos ?? staticData.videos ?? []).map(video => ({
      ...video,
      ...(video.alt ? { alt: wrapFallbackText(video.alt, fallbackVideos) } : {}),
    })),
  };
}

function mergeNotes(staticData: RawNotes, partial: Partial<RawNotes>): RawNotes {
  const merged: RawNotes = {
    note: partial.note ?? staticData.note,
    'otas-note': partial['otas-note']?.length ? partial['otas-note'] : staticData['otas-note'],
  };
  return merged;
}

function mergeComments(staticData: RawComments, partial: Partial<RawComments>): RawComments {
  const fallbackComments = !partial.comments?.length;
  return {
    comments: (partial.comments?.length ? partial.comments : staticData.comments).map(page =>
      page.map(comment => ({
        ...comment,
        name: wrapFallbackText(comment.name, fallbackComments),
        comment: wrapFallbackText(comment.comment, fallbackComments),
      })),
    ),
  };
}

const mergers: Record<SegmentKey, (staticData: any, partial: any) => any> = {
  core: mergeCore,
  host: mergeHost,
  bookings: mergeBookings,
  medias: mergeMedias,
  notes: mergeNotes,
  comments: mergeComments,
};

const staticSegments: RawSegments = {
  core: coreJSON,
  host: hostJSON,
  bookings: bookingsJSON,
  medias: mediasJSON,
  notes: notesJSON,
  comments: commentsJSON,
};

const rawCache = new Map<string, Promise<RawSegments>>();

async function loadSegmentsOnce(listingId: string): Promise<RawSegments> {
  const [coreRemote, hostRemote, bookingsRemote, mediasRemote, notesRemote, commentsRemote] =
    await Promise.all([
      fetchSegment('core', listingId),
      fetchSegment('host', listingId),
      fetchSegment('bookings', listingId),
      fetchSegment('medias', listingId),
      fetchSegment('notes', listingId),
      fetchSegment('comments', listingId),
    ]);

  const sanitizedCore = sanitizers.core(coreRemote);
  const sanitizedHost = sanitizers.host(hostRemote);
  const sanitizedBookings = sanitizers.bookings(bookingsRemote);
  const sanitizedMedias = sanitizers.medias(mediasRemote);
  const sanitizedNotes = sanitizers.notes(notesRemote);
  const sanitizedComments = sanitizers.comments(commentsRemote);

  logIssues('core', sanitizedCore.issues);
  logIssues('host', sanitizedHost.issues);
  logIssues('bookings', sanitizedBookings.issues);
  logIssues('medias', sanitizedMedias.issues);
  logIssues('notes', sanitizedNotes.issues);
  logIssues('comments', sanitizedComments.issues);

  return {
    core: mergers.core(staticSegments.core, sanitizedCore.data),
    host: mergers.host(staticSegments.host, sanitizedHost.data),
    bookings: mergers.bookings(staticSegments.bookings, sanitizedBookings.data),
    medias: mergers.medias(staticSegments.medias, sanitizedMedias.data),
    notes: mergers.notes(staticSegments.notes, sanitizedNotes.data),
    comments: mergers.comments(staticSegments.comments, sanitizedComments.data),
  };
}

export async function loadListingSegments(slug?: string): Promise<RawSegments> {
  const listingId = (slug || '').toString().trim() || DEFAULT_LISTING_ID;
  if (!rawCache.has(listingId)) {
    rawCache.set(listingId, loadSegmentsOnce(listingId));
  }
  return rawCache.get(listingId)!;
}
