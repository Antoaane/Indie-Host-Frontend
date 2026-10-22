import type { FastifyReply, FastifyRequest } from 'fastify';

// Limiteur en mémoire à fenêtre fixe : suffisant tant que l'API tourne en une seule instance.
type Bucket = {
  count: number;
  resetAt: number;
};

const MAX_TRACKED_KEYS = 10_000;

// nginx écrase X-Real-IP avec l'adresse du client (restaurée derrière Cloudflare par real_ip) :
// le client ne peut pas la falsifier. Sans nginx (dev), on retombe sur l'adresse de la socket.
export function readClientIp(request: FastifyRequest): string {
  const header = request.headers['x-real-ip'];
  const value = Array.isArray(header) ? header[0] : header;
  return value?.trim() || request.ip;
}

export function createRateLimiter(options: { max: number; windowMs: number }) {
  const buckets = new Map<string, Bucket>();

  return function consume(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();

    if (buckets.size > MAX_TRACKED_KEYS) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    return {
      allowed: bucket.count <= options.max,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  };
}

export function rateLimitByIp(options: { max: number; windowMs: number; message: string }) {
  const consume = createRateLimiter(options);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = consume(readClientIp(request));
    if (result.allowed) return;

    return reply
      .header('Retry-After', String(result.retryAfterSeconds))
      .code(429)
      .send({ message: options.message });
  };
}
