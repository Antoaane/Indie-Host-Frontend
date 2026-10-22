// File: src/views/Editor/components/EditorSidebar/panels/ListingPanels/ImportPanel/scrapingClient.ts

// Le microservice de scraping n'est plus exposé : l'import passe par l'API, qui valide l'URL.
const BASE_URL = ((import.meta.env.VITE_API_BASE_URL ?? '').trim() || '/api/v1').replace(/\/$/, '')

/** Timeout en ms pour l'appel au serveur de scraping.
 * Certaines annonces Airbnb peuvent prendre plus de 90 s avec les fallbacks HTML/Playwright.
 */
const SCRAPE_TIMEOUT_MS = 180_000

export type ScrapeListingOptions = {
  url: string
  currency?: string
  checkIn?: string
  checkOut?: string
}

export async function scrapeListing(options: ScrapeListingOptions): Promise<Record<string, unknown>> {
  const { url, currency = 'EUR', checkIn = '', checkOut = '' } = options
  const trimmedUrl = (url ?? '').trim()
  if (!trimmedUrl) {
    throw new Error("L'URL est requise.")
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${BASE_URL}/imports/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: trimmedUrl,
        currency,
        check_in: checkIn ?? '',
        check_out: checkOut ?? '',
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error("Le serveur de scraping met trop de temps à répondre. Réessayez ou vérifiez que le service scraping est démarré.")
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((json.message ?? json.detail ?? "Impossible de récupérer l'annonce.").toString())
  }
  return json as Record<string, unknown>
}
