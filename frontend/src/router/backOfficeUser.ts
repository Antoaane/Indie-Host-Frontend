// File: src/router/backOfficeUser.ts

import clerkToken from '@/utils/clerkToken'

type ClerkRuntime = Window & {
  Clerk?: {
    user?: {
      id?: string | null
    }
    session?: {
      getToken?: () => Promise<string | null>
    }
  }
}

type ResolveRuntimeUserIdOptions = {
  waitMs?: number
  pollIntervalMs?: number
}

export function normalizeUserId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

export function readRouteUserId(value: unknown): string | null {
  if (Array.isArray(value)) return readRouteUserId(value[0])
  return normalizeUserId(value)
}

export function requireRouteUserId(value: unknown): string {
  const userId = readRouteUserId(value)
  if (!userId) {
    throw new Error('[router] missing required route param: userId')
  }
  return userId
}

function decodeBase64(value: string): string | null {
  const atobImpl = typeof window !== 'undefined' && typeof window.atob === 'function'
    ? window.atob.bind(window)
    : (typeof atob === 'function' ? atob : null)

  if (!atobImpl) return null

  try {
    const normalized = value
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(value.length / 4) * 4, '=')
    return atobImpl(normalized)
  } catch {
    return null
  }
}

function readJwtPayload(token: string): Record<string, unknown> | null {
  const encodedPayload = token.split('.')[1]
  if (!encodedPayload) return null

  const decoded = decodeBase64(encodedPayload)
  if (!decoded) return null

  try {
    const payload = JSON.parse(decoded)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

function readUserIdFromJwtToken(token: string | null | undefined): string | null {
  const trimmedToken = normalizeUserId(token)
  if (!trimmedToken) return null

  const payload = readJwtPayload(trimmedToken)
  return normalizeUserId(payload?.sub)
}

function readClerkRuntimeUserId(): string | null {
  if (typeof window === 'undefined') return null

  const clerk = (window as ClerkRuntime).Clerk
  return normalizeUserId(clerk?.user?.id)
}

function readStoredTokenUserId(): string | null {
  return readUserIdFromJwtToken(clerkToken.value)
}

async function readSessionTokenUserId(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const clerk = (window as ClerkRuntime).Clerk
  const getToken = clerk?.session?.getToken
  if (typeof getToken !== 'function') return null

  try {
    const token = (await getToken())?.trim() ?? ''
    if (!token) return null
    clerkToken.value = token
    return readUserIdFromJwtToken(token)
  } catch {
    return null
  }
}

export function readRuntimeUserIdSync(): string | null {
  return readClerkRuntimeUserId() ?? readStoredTokenUserId()
}

export function readActiveUserId(value: unknown): string | null {
  return readRouteUserId(value) ?? readRuntimeUserIdSync()
}

export function requireActiveUserId(value: unknown): string {
  const userId = readActiveUserId(value)
  if (!userId) {
    throw new Error('[router] missing active user id in route params and runtime session')
  }
  return userId
}

export async function resolveRuntimeUserId(options?: ResolveRuntimeUserIdOptions): Promise<string | null> {
  const waitMs = Number.isFinite(options?.waitMs) ? Math.max(0, Number(options?.waitMs)) : 0
  const pollIntervalMs = Number.isFinite(options?.pollIntervalMs) ? Math.max(10, Number(options?.pollIntervalMs)) : 50
  const sessionPollIntervalMs = Math.max(250, pollIntervalMs * 3)

  const immediate = readRuntimeUserIdSync()
  if (immediate) return immediate

  const fromSessionToken = await readSessionTokenUserId()
  if (fromSessionToken) return fromSessionToken

  if (waitMs <= 0) return null

  const deadline = Date.now() + waitMs
  let nextSessionPollAt = Date.now()

  while (Date.now() < deadline) {
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, pollIntervalMs)
    })

    const fromRuntime = readRuntimeUserIdSync()
    if (fromRuntime) return fromRuntime

    const now = Date.now()
    if (now < nextSessionPollAt) continue

    nextSessionPollAt = now + sessionPollIntervalMs
    const fromSession = await readSessionTokenUserId()
    if (fromSession) return fromSession
  }

  return readRuntimeUserIdSync() ?? readSessionTokenUserId()
}
