import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Vérification de la signature Svix des webhooks Clerk, sans dépendance :
 * contenu signé `${svix-id}.${svix-timestamp}.${corps brut}`, HMAC-SHA256 avec la clé
 * `whsec_<base64>`, comparée à chacune des valeurs `v1,<base64>` de l'en-tête `svix-signature`.
 */

const SVIX_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export type SvixHeaders = {
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
};

export type SvixVerificationResult =
  | { ok: true }
  | { ok: false; reason: 'missing_headers' | 'invalid_secret' | 'timestamp_out_of_range' | 'signature_mismatch' };

function decodeSecret(secret: string): Buffer | null {
  const trimmed = secret.trim();
  const encoded = trimmed.startsWith('whsec_') ? trimmed.slice('whsec_'.length) : trimmed;
  if (!encoded) return null;
  try {
    const key = Buffer.from(encoded, 'base64');
    return key.length ? key : null;
  } catch {
    return null;
  }
}

export function verifySvixSignature(
  secret: string,
  headers: SvixHeaders,
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): SvixVerificationResult {
  const id = headers.id?.trim();
  const timestamp = headers.timestamp?.trim();
  const signatureHeader = headers.signature?.trim();
  if (!id || !timestamp || !signatureHeader) return { ok: false, reason: 'missing_headers' };

  const key = decodeSecret(secret);
  if (!key) return { ok: false, reason: 'invalid_secret' };

  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > SVIX_TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp_out_of_range' };
  }

  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest();

  for (const candidate of signatureHeader.split(/\s+/)) {
    const [version, value] = candidate.split(',', 2);
    if (version !== 'v1' || !value) continue;

    let provided: Buffer;
    try {
      provided = Buffer.from(value, 'base64');
    } catch {
      continue;
    }

    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return { ok: true };
    }
  }

  return { ok: false, reason: 'signature_mismatch' };
}
