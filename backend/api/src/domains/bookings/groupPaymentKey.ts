import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/env.js';

// Clé d'une part d'un paiement à plusieurs (`gp_<part>_<signature>`) : elle sert de lien personnel à
// celui qui doit la régler, sans compte. Même secret que les guides d'arrivée, avec un préfixe propre
// à cet usage. La clé de l'organisateur (part n° 0) ouvre en plus la gestion du groupe.

// Sans point : un serveur de développement ou un proxy prendrait la fin de la clé pour une extension.
const SHARE_KEY_PATTERN = /^gp_([a-z0-9]{8,40})_([a-f0-9]{24})$/;

function sign(shareId: string): string {
  return createHmac('sha256', env.BOOKING_GUIDE_ACCESS_SECRET)
    .update(`group-payment-share:${shareId}`)
    .digest('hex')
    .slice(0, 24);
}

export function buildGroupShareKey(shareId: string): string {
  return `gp_${shareId}_${sign(shareId)}`;
}

/** Identifiant de la part si la clé est bien formée et signée par ce serveur, sinon `null`. */
export function parseGroupShareKey(key: string): string | null {
  const match = key.trim().match(SHARE_KEY_PATTERN);
  if (!match) return null;

  const shareId = match[1] ?? '';
  const expected = Buffer.from(sign(shareId));
  const received = Buffer.from(match[2] ?? '');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return shareId;
}

export function buildGroupSharePath(shareKey: string): string {
  return `/booking/group/${encodeURIComponent(shareKey)}`;
}
