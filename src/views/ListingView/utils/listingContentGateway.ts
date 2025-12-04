// File: src/views/ListingView/utils/listingContentGateway.ts

// Static fallbacks
import coreJSON from '@/content/fr/ListingTest/core.json';
import bookingsJSON from '@/content/fr/ListingTest/bookings.json';
import mediasJSON from '@/content/fr/ListingTest/medias.json';
import amenitiesJSON from '@/content/fr/ListingTest/amenities.json';
import notesJSON from '@/content/fr/ListingTest/notes.json';
import commentsJSON from '@/content/fr/ListingTest/comments.json';

export type RawCore = (typeof coreJSON) & { lat?: number; lng?: number; zoom?: number };
export type RawBookings = typeof bookingsJSON;
export type RawMedias = typeof mediasJSON;
export type RawAmenities = typeof amenitiesJSON;
export type RawNotes = typeof notesJSON;
export type RawComments = typeof commentsJSON;

export type RawSegments = {
  core: RawCore;
  bookings: RawBookings;
  medias: RawMedias;
  amenities: RawAmenities;
  notes: RawNotes;
  comments: RawComments;
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

type FieldSchema = {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'custom';
  source?: string | string[] | string[][];
  target?: string;
  required?: boolean;
  domVisible?: boolean;
  expected?: string;
  fields?: Record<string, FieldSchema>;
  element?: FieldSchema;
  minItems?: number;
  sanitizer?: (value: unknown) => unknown | undefined;
};

const toPathOptions = (schema: FieldSchema, defaultKey: string): string[][] => {
  const provided = schema.source;
  if (!provided) return [[defaultKey]];
  if (Array.isArray(provided) && typeof provided[0] === 'string') return [provided as string[]];
  if (typeof provided === 'string') return [[provided]];
  return provided as string[][];
};

const resolveValue = (source: unknown, paths: string[][]): { value: unknown; provided: boolean } => {
  for (const path of paths) {
    let current: unknown = source;
    let provided = true;
    for (const key of path) {
      if (isObject(current) && key in current) {
        current = (current as Record<string, unknown>)[key];
      }
      else {
        provided = false;
        break;
      }
    }
    if (provided) return { value: current, provided: true };
  }
  return { value: undefined, provided: false };
};

type SanitizedValue<T> = { value?: T; issues: Issue[]; provided: boolean };

const sanitizeValue = <T>(
  schema: FieldSchema,
  rawParent: unknown,
  key: string,
  silentIssues = false,
): SanitizedValue<T> => {
  const { value: rawValue, provided } = resolveValue(rawParent, toPathOptions(schema, key));
  const issues: Issue[] = [];
  const expected = schema.expected ?? schema.type;

  const pushIssue = (received: unknown) => {
    if (!silentIssues) issues.push({ key, expected, received });
  };

  const sanitizedInput = schema.sanitizer ? schema.sanitizer(rawValue) : rawValue;

  if (schema.type === 'string') {
    const value = asString(sanitizedInput);
    if (value !== undefined) return { value: value as T, issues, provided };
    if (schema.required || provided) pushIssue(rawValue ?? 'absent');
    return { issues, provided };
  }

  if (schema.type === 'number') {
    const value = asNumber(sanitizedInput);
    if (value !== undefined) return { value: value as T, issues, provided };
    if (schema.required || provided) pushIssue(rawValue ?? 'absent');
    return { issues, provided };
  }

  if (schema.type === 'boolean') {
    const value = asBoolean(sanitizedInput);
    if (value !== undefined) return { value: value as T, issues, provided };
    if (schema.required || provided) pushIssue(rawValue ?? 'absent');
    return { issues, provided };
  }

  if (schema.type === 'custom') {
    const value = schema.sanitizer ? (schema.sanitizer(sanitizedInput) as T | undefined) : undefined;
    if (value !== undefined) return { value, issues, provided };
    if (schema.required || provided) pushIssue(rawValue ?? 'absent');
    return { issues, provided };
  }

  if (schema.type === 'object') {
    if (!isObject(sanitizedInput)) {
      if (schema.required || provided) pushIssue(rawValue ?? 'absent');
      return { issues, provided };
    }

    const collected: Record<string, unknown> = {};
    Object.entries(schema.fields ?? {}).forEach(([fieldKey, fieldSchema]) => {
      const targetKey = fieldSchema.target ?? fieldKey;
      const result = sanitizeValue(fieldSchema, sanitizedInput, targetKey, silentIssues);
      issues.push(...result.issues);
      if (result.value !== undefined) collected[targetKey] = result.value;
    });

    return {
      value: Object.keys(collected).length ? (collected as T) : undefined,
      issues,
      provided,
    };
  }

  if (schema.type === 'array') {
    if (!Array.isArray(sanitizedInput)) {
      if (schema.required || provided) pushIssue(rawValue ?? 'absent');
      return { issues, provided };
    }

    const items = sanitizedInput
      .map(item => sanitizeValue(schema.element!, item, key, true).value)
      .filter(value => value !== undefined) as unknown[];

    const minItems = schema.minItems ?? 1;
    if (items.length >= minItems) return { value: items as T, issues, provided };

    if (schema.required || provided) pushIssue(rawValue);
    return { issues, provided };
  }

  return { issues, provided };
};

const mergeValue = (schema: FieldSchema, staticValue: unknown, partialValue: unknown, fallback: boolean): unknown => {
  if (schema.type === 'string') {
    const value = (partialValue ?? staticValue) as string | undefined;
    if (value === undefined) return undefined;
    const shouldWrap = fallback || partialValue === undefined;
    return schema.domVisible ? wrapFallbackText(value, shouldWrap) : value;
  }

  if (schema.type === 'number' || schema.type === 'boolean' || schema.type === 'custom') {
    return partialValue ?? staticValue;
  }

  if (schema.type === 'object') {
    const base: Record<string, unknown> = isObject(staticValue)
      ? { ...(staticValue as Record<string, unknown>) }
      : {};
    const partialObject = isObject(partialValue) ? (partialValue as Record<string, unknown>) : undefined;
    const staticObject = isObject(staticValue) ? (staticValue as Record<string, unknown>) : undefined;

    Object.entries(schema.fields ?? {}).forEach(([fieldKey, fieldSchema]) => {
      const targetKey = fieldSchema.target ?? fieldKey;
      const merged = mergeValue(
        fieldSchema,
        staticObject ? staticObject[targetKey] : undefined,
        partialObject ? partialObject[targetKey] : undefined,
        fallback || (partialObject ? partialObject[targetKey] === undefined : true),
      );
      if (merged !== undefined) base[targetKey] = merged;
    });

    return base;
  }

  if (schema.type === 'array') {
    const usePartial = Array.isArray(partialValue) && (partialValue as unknown[]).length > 0;
    const sourceArray = usePartial
      ? (partialValue as unknown[])
      : Array.isArray(staticValue)
        ? (staticValue as unknown[])
        : [];
    const childFallback = fallback || !usePartial;

    return sourceArray.map(item =>
      mergeValue(schema.element!, usePartial ? undefined : item, usePartial ? item : undefined, childFallback),
    );
  }

  return partialValue ?? staticValue;
};

const sanitizeSegment = <T>(schema: FieldSchema, input: unknown, segmentKey: SegmentKey): SanitizeResult<T> => {
  const issues: Issue[] = [];
  if (!isObject(input)) {
    return { data: {} as Partial<T>, issues: [{ key: segmentKey, expected: 'object', received: input ?? 'absent' }] };
  }

  const result = sanitizeValue<T>(schema, input, segmentKey);
  issues.push(...result.issues);
  return { data: (result.value ?? {}) as Partial<T>, issues };
};

const mergeSegment = <T>(schema: FieldSchema, staticSegment: T, partial: Partial<T>): T =>
  mergeValue(schema, staticSegment, partial, false) as T;

const segmentSchemas: Record<SegmentKey, FieldSchema> = {
  core: {
    type: 'object',
    fields: {
      id: { type: 'string', required: true },
      title: { type: 'string', required: true, domVisible: true },
      type: { type: 'string', required: true, domVisible: true },
      brief: { type: 'string', required: true, domVisible: true },
      city: {
        type: 'string',
        required: true,
        domVisible: true,
        source: [
          ['city'],
          ['address', 'city'],
        ],
      },
      region: {
        type: 'string',
        required: true,
        domVisible: true,
        source: [
          ['region'],
          ['address', 'region'],
        ],
      },
      country: {
        type: 'string',
        required: true,
        domVisible: true,
        source: [
          ['country'],
          ['address', 'country'],
        ],
      },
      capacity: { type: 'number', required: true },
      latitude: { type: 'number', required: true, source: [['latitude'], ['lat']] },
      longitude: { type: 'number', required: true, source: [['longitude'], ['lng']] },
      zoom: { type: 'number' },
      rooms: {
        type: 'array',
        required: true,
        expected: 'array<room>',
        element: {
          type: 'object',
          fields: {
            type: { type: 'string', required: true, domVisible: true },
            'room-name': { type: 'string', domVisible: true, source: [['room-name'], ['name']] },
            beds: {
              type: 'array',
              element: {
                type: 'object',
                fields: {
                  type: { type: 'string', required: true, domVisible: true },
                  capacity: { type: 'number', required: true },
                  quantity: { type: 'number', required: true },
                },
              },
            },
          },
        },
      },
      perks: {
        type: 'array',
        required: true,
        expected: 'array<perk>',
        element: {
          type: 'object',
          fields: {
            icon: { type: 'string', required: true },
            name: { type: 'string', required: true, domVisible: true },
            description: { type: 'string', domVisible: true },
          },
        },
      },
      host: {
        type: 'object',
        required: true,
        fields: {
          name: { type: 'string', domVisible: true },
          seniority: { type: 'number' },
          status: { type: 'string', domVisible: true },
          'global-note': { type: 'number', source: [['global-note'], ['globalNote']] },
          avatar: { type: 'string', source: [['avatar'], ['picture']] },
          'catalog-link': { type: 'string', source: [['catalog-link'], ['catalogLink']] },
        },
      },
      description: {
        type: 'array',
        required: true,
        expected: 'array<block>',
        element: {
          type: 'object',
          fields: {
            title: { type: 'string', required: true, domVisible: true },
            content: { type: 'string', required: true, domVisible: true },
          },
        },
      },
    },
  },
  bookings: {
    type: 'object',
    fields: {
      price: { type: 'number', required: true },
      'booked-days': {
        type: 'array',
        required: true,
        expected: 'array<range>',
        source: [['booked-days'], ['bookedDays']],
        element: {
          type: 'object',
          fields: {
            start: { type: 'string', required: true },
            end: { type: 'string', required: true },
          },
        },
      },
      fees: {
        type: 'array',
        expected: 'array<fee>',
        element: {
          type: 'object',
          fields: {
            name: { type: 'string', required: true, domVisible: true },
            amount: { type: 'number', required: true },
          },
        },
      },
    },
  },
  medias: {
    type: 'object',
    fields: {
      images: {
        type: 'array',
        required: true,
        expected: 'array<image>',
        element: {
          type: 'object',
          fields: {
            src: { type: 'string', required: true, source: [['src'], ['url']] },
            alt: {
              type: 'string',
              required: true,
              domVisible: true,
              source: [
                ['alt'],
                ['title'],
                ['description'],
              ],
            },
            cover: { type: 'boolean' },
          },
        },
      },
      videos: {
        type: 'array',
        element: {
          type: 'object',
          sanitizer: (value: unknown) => (typeof value === 'string' ? { src: value } : value),
          fields: {
            src: { type: 'string', required: true, source: [['src'], ['url']] },
            poster: { type: 'string' },
            alt: { type: 'string', domVisible: true },
          },
        },
      },
    },
  },
  amenities: {
    type: 'object',
    fields: {
      amenities: {
        type: 'array',
        required: true,
        expected: 'array<amenity>',
        element: {
          type: 'object',
          fields: {
            icon: { type: 'string', required: true },
            name: { type: 'string', required: true, domVisible: true },
            description: { type: 'string', domVisible: true },
          },
        },
      },
    },
  },
  notes: {
    type: 'object',
    fields: {
      note: {
        type: 'object',
        required: true,
        fields: {
          note: { type: 'number', source: [['note'], ['overall']] },
          distribution: { type: 'custom', sanitizer: sanitizeDistribution },
        },
      },
      'otas-note': {
        type: 'array',
        source: [['otas-note']],
        element: {
          type: 'object',
          fields: {
            ota: { type: 'string', required: true },
            note: { type: 'number', required: true },
            distribution: { type: 'custom', sanitizer: sanitizeDistribution },
          },
        },
      },
    },
  },
  comments: {
    type: 'object',
    fields: {
      comments: {
        type: 'array',
        required: true,
        expected: 'array<comment[]>',
        element: {
          type: 'array',
          expected: 'array<comment>',
          element: {
            type: 'object',
            fields: {
              name: { type: 'string', required: true, domVisible: true },
              note: { type: 'number', required: true },
              comment: { type: 'string', required: true, domVisible: true, source: [['comment'], ['text']] },
              'profile-pic': {
                type: 'string',
                source: [
                  ['profile-pic'],
                  ['avatar'],
                  ['profilePic'],
                ],
              },
              'stay-dates': {
                type: 'object',
                fields: {
                  start: { type: 'string', required: true },
                  end: { type: 'string', required: true },
                },
              },
            },
          },
        },
      },
    },
  },
};

const sanitizers: Record<SegmentKey, (input: unknown) => SanitizeResult<RawSegments[SegmentKey]>> = {
  core: input => sanitizeSegment(segmentSchemas.core, input, 'core'),
  bookings: input => sanitizeSegment(segmentSchemas.bookings, input, 'bookings'),
  medias: input => sanitizeSegment(segmentSchemas.medias, input, 'medias'),
  amenities: input => sanitizeSegment(segmentSchemas.amenities, input, 'amenities'),
  notes: input => sanitizeSegment(segmentSchemas.notes, input, 'notes'),
  comments: input => sanitizeSegment(segmentSchemas.comments, input, 'comments'),
};

const mergers: Record<SegmentKey, (staticData: any, partial: any) => any> = {
  core: (staticData, partial) => mergeSegment(segmentSchemas.core, staticData, partial),
  bookings: (staticData, partial) => mergeSegment(segmentSchemas.bookings, staticData, partial),
  medias: (staticData, partial) => mergeSegment(segmentSchemas.medias, staticData, partial),
  amenities: (staticData, partial) => mergeSegment(segmentSchemas.amenities, staticData, partial),
  notes: (staticData, partial) => mergeSegment(segmentSchemas.notes, staticData, partial),
  comments: (staticData, partial) => mergeSegment(segmentSchemas.comments, staticData, partial),
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

const staticSegments: RawSegments = {
  core: coreJSON,
  bookings: bookingsJSON,
  medias: mediasJSON,
  amenities: amenitiesJSON,
  notes: notesJSON,
  comments: commentsJSON,
};

const rawCache = new Map<string, Promise<RawSegments>>();

async function loadSegmentsOnce(listingId: string): Promise<RawSegments> {
  const [coreRemote, bookingsRemote, mediasRemote, amenitiesRemote, notesRemote, commentsRemote] =
    await Promise.all([
      fetchSegment('core', listingId),
      fetchSegment('bookings', listingId),
      fetchSegment('medias', listingId),
      fetchSegment('amenities', listingId),
      fetchSegment('notes', listingId),
      fetchSegment('comments', listingId),
    ]);

  const sanitizedCore = sanitizers.core(coreRemote);
  const sanitizedBookings = sanitizers.bookings(bookingsRemote);
  const sanitizedMedias = sanitizers.medias(mediasRemote);
  const sanitizedAmenities = sanitizers.amenities(amenitiesRemote);
  const sanitizedNotes = sanitizers.notes(notesRemote);
  const sanitizedComments = sanitizers.comments(commentsRemote);

  logIssues('core', sanitizedCore.issues);
  logIssues('bookings', sanitizedBookings.issues);
  logIssues('medias', sanitizedMedias.issues);
  logIssues('amenities', sanitizedAmenities.issues);
  logIssues('notes', sanitizedNotes.issues);
  logIssues('comments', sanitizedComments.issues);

  return {
    core: mergers.core(staticSegments.core, sanitizedCore.data),
    bookings: mergers.bookings(staticSegments.bookings, sanitizedBookings.data),
    medias: mergers.medias(staticSegments.medias, sanitizedMedias.data),
    amenities: mergers.amenities(staticSegments.amenities, sanitizedAmenities.data),
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
