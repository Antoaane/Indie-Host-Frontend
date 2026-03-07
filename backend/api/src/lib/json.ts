export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asObject(value: unknown, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  return isObject(value) ? value : fallback;
}

export function deepMerge<T>(target: T, patch: unknown): T {
  if (patch === null || patch === undefined) return patch as T;
  if (Array.isArray(patch)) return patch as T;
  if (typeof patch !== 'object') return patch as T;

  const base = isObject(target) ? target : ({} as Record<string, unknown>);
  const output: Record<string, unknown> = { ...base };

  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = output[key];
    if (
      patchValue &&
      typeof patchValue === 'object' &&
      !Array.isArray(patchValue) &&
      baseValue &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      output[key] = deepMerge(baseValue as Record<string, unknown>, patchValue);
      continue;
    }

    output[key] = patchValue as unknown;
  }

  return output as T;
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}
