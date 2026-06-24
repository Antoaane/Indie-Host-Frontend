// File: src/domain/api/aiDescription.ts

import axios from 'axios'

import type { RawCore } from '@/domain/listings/types'
import clerkToken from '@/utils/clerkToken'

export async function generateAiDescription(
  core: Partial<RawCore>,
  lengthLevel: number = 2,
  getToken?: (() => Promise<string | null>) | null,
): Promise<string> {
  const fromStore = (clerkToken.value ?? '').trim()
  const token = fromStore || (getToken ? ((await getToken())?.trim() ?? '') : '')

  const { data } = await axios.post<{ html: string }>(
    '/api/v1/ai/description',
    {
      title: core.title,
      type: core.type,
      city: core.city,
      country: core.country,
      region: core.region,
      guest_capacity: core.guest_capacity,
      rooms: core.rooms,
      amenities: core.amenities,
      length_level: lengthLevel,
    },
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      timeout: 30_000,
    },
  )

  return data.html
}
