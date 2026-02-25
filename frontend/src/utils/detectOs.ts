// File: src/utils/detectOs.ts

// detectOs.ts

const SRC = {
  UA: 'ua',
  UACH: 'ua-ch',
  UACH_LOW: 'ua-ch-low',
  HEUR: 'heuristic',
  UAD: 'userAgentData',
} as const

export default async function detectOS(): Promise<OSInfo> {
  // cast pour éviter l’erreur TS
  const nav = navigator as Navigator & { userAgentData?: any }

  if (nav.userAgentData && nav.userAgentData.platform) {
    try {
      const high = await nav.userAgentData.getHighEntropyValues(['platform', 'platformVersion'])
      return { os: high.platform || nav.userAgentData.platform, version: high.platformVersion || 'unknown', source: 'userAgentData' }
    } catch (e) {
      return { os: nav.userAgentData.platform || 'unknown', version: 'unknown', source: 'userAgentData-fallback' }
    }
  }

  // fallback classique
  const ua = (navigator.userAgent || '').toLowerCase()
  const platform = (navigator.platform || '').toLowerCase()

  if (platform === 'macintel' && navigator.maxTouchPoints > 1) {
    return { os: 'iPadOS', version: 'unknown', source: 'heuristic' }
  }

  if (/windows/.test(ua) || /win/.test(platform)) return { os: 'Windows', version: 'unknown', source: 'ua' }
  if (/mac os x|macintosh/.test(ua) || /mac/.test(platform)) return { os: 'macOS', version: 'unknown', source: 'ua' }
  if (/android/.test(ua)) return { os: 'Android', version: (ua.match(/android\s([0-9\.]+)/) || [])[1] || 'unknown', source: 'ua' }
  if (/iphone|ipad|ipod/.test(ua)) {
    return { os: /ipad/.test(ua) ? 'iPadOS' : 'iOS', version: (ua.match(/os\s([0-9\_]+)/) || [])[1]?.replace(/_/g, '.') || 'unknown', source: 'ua' }
  }
  if (/linux/.test(ua) || /linux/.test(platform)) return { os: 'Linux', version: 'unknown', source: 'ua' }
  if (/cros/.test(ua) || /chromeos/.test(ua)) return { os: 'ChromeOS', version: 'unknown', source: 'ua' }

  return { os: 'Unknown', version: 'unknown', source: 'ua' }
}
