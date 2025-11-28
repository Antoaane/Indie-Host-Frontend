// File: src/views/ListingView/types/listing.ts

// -------- MEDIAS --------
export type ImageItem = { src: string; alt: string };
export type VideoItem = { src: string; poster?: string; alt?: string };
export type MediasModel = { images: ImageItem[]; videos: VideoItem[] };

// -------- TITRE / EN-TÊTE --------
export type TitleModel = {
  title: string;
  type: string;        // ex: "Péniche"
  location: {
    city: string;
    region: string;
    country: string;
  };
  capacity: number;
  bedrooms: { quantity: number; bed?: number };
  bathrooms: number;
};

// -------- POLITIQUES --------
export type PerkItem = { icon: string; name: string; description?: string };
export type PerksModel = PerkItem[];

// -------- HÔTE --------
export type HostProfileModel = {
  name: string;
  status?: string;
  seniority: number;
  globalNote?: number;
  avatar?: string;
  catalogLink?: string;
};

// -------- DESCRIPTION --------
export type DescriptionBlock = { title: string; content: string };
export type DescriptionModel = {
  brief?: string;
  blocks: DescriptionBlock[];
};

// -------- ÉQUIPEMENTS --------
export type AmenityItem = {
  name: string;
  description?: string;
  icon: string;
  category: string;
  relevance: number;
  pinned: boolean;
};
export type AmenitiesModel = AmenityItem[];

// -------- CHAMBRES / LITS --------
export type BedItem = { type: string; capacity: number; quantity: number };
export type RoomItem = {
  name: string;           // "Chambre", "Salon"...
  type: string;           // "bedroom", "living-room"...
  beds?: BedItem[];
};

export type RoomsSummary = {
  roomsCount: number;     // nombre de pièces total
  bedsCount: number;      // total de lits (quantité)
  capacityTotal: number;  // capacité totale (capacité * quantité)
};

export type RoomsGroupSummary = {
  length: number;         // nombre de pièces pour ce type (ex: nb de "bedroom")
  beds?: number;           // total de lits pour ce type
  capacity: number;       // capacité totale pour ce type
};

// Accès direct souhaité : rooms.byType.bedroom.length, rooms.byType.bedroom.beds, etc.
export type RoomsByType = Record<string, { rooms: RoomItem[] } & RoomsGroupSummary>;

export type RoomsModel = {
  rooms: RoomItem[];
  summary: RoomsSummary;
  byType: RoomsByType;
};

// -------- RÉSERVATIONS / TARIFS --------
export type BookedRange = { start: string; end: string };
export type BookingsModel = {
  price: number;                   // prix / nuit (base)
  bookedDays: BookedRange[];       // périodes occupées
};

// -------- NOTES / COMMENTAIRES --------
export type NotesModel = {
  overall?: number;
  distribution?: Record<string, number>;
  otas?: Array<{
    ota: 'airbnb' | 'booking' | string;
    note: number;
    distribution?: Record<string, number>;
  }>;
};

export type CommentItem = {
  avatar?: string;
  name: string;
  note: number;
  comment: string;
  stayDates?: { start: string; end: string };
};
export type CommentsModel = CommentItem[];
export type CommentsPageModel = CommentItem[];
export type CommentsPagesModel = CommentsPageModel[];

// -------- BUNDLE GLOBAL --------
export type ListingParsed = {
  title: TitleModel;
  perks: PerksModel;
  hostProfile: HostProfileModel;
  description: DescriptionModel;
  amenities: AmenitiesModel;
  rooms: RoomsModel;
  bookings: BookingsModel;
  medias: MediasModel;
  notes: NotesModel;
  comments: CommentsModel;
  commentsPages: CommentsPagesModel;
};
