export interface AuthUser {
  userId: string
  sessionId?: string
  email?: string
  raw: Record<string, unknown>
}
