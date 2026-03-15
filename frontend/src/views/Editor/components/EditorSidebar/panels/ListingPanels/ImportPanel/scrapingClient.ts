// File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel/scrapingClient.ts

const BASE_URL = (import.meta.env.VITE_SCRAPING_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

/** Timeout en ms pour l'appel au serveur de scraping.
 * Certaines annonces Airbnb peuvent prendre plus de 90 s avec les fallbacks HTML/Playwright.
 */
const SCRAPE_TIMEOUT_MS = 180_000

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

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${BASE_URL}/scrape`, {
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
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error("Le serveur de scraping met trop de temps à répondre. Réessayez ou vérifiez que le service tourne sur le port 8000.")
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((json.detail ?? json.error ?? "Impossible de récupérer l'annonce.").toString())
  }
  return json as Record<string, unknown>
}
