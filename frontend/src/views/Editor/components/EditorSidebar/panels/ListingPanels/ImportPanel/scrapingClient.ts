const BASE_URL = (import.meta.env.VITE_SCRAPING_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export type ScrapeListingOptions = {
  url: string
  currency?: string
  checkIn?: string
  checkOut?: string
  proxyUrl?: string
}

export async function scrapeListing(options: ScrapeListingOptions): Promise<Record<string, unknown>> {
  const { url, currency = 'EUR', checkIn = '', checkOut = '', proxyUrl = '' } = options
  const trimmedUrl = (url ?? '').trim()
  if (!trimmedUrl) {
    throw new Error("L'URL est requise.")
  }

  const res = await fetch(`${BASE_URL}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: trimmedUrl,
      currency,
      check_in: checkIn ?? '',
      check_out: checkOut ?? '',
      proxy_url: proxyUrl ?? '',
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((json.detail ?? json.error ?? "Impossible de récupérer l'annonce.").toString())
  }
  return json as Record<string, unknown>
}
