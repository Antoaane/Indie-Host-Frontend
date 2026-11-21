import { fileURLToPath, URL } from 'node:url'
import { existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
// Désactivé temporairement : provoque "localStorage.getItem is not a function" au chargement de la config (Node.js)
// import vueDevTools from 'vite-plugin-vue-devtools'
import ui from '@nuxt/ui/vite'
import svgToVuePlugin from './plugins/svg-to-vue/vite-plugin-svg-to-vue.ts'
import fileCommentInjector from './plugins/file-path-comment/vite-plugin-file-comment.ts'
import legalPrerender from './plugins/legal-prerender/vite-plugin-legal-prerender.ts'
import marketingPrerender from './plugins/marketing-prerender/vite-plugin-marketing-prerender.ts'

type ParsedEndpoint = {
  origin?: string
  path?: string
}

function normalizePathPrefix(rawPath: string): string {
  const trimmed = (rawPath ?? '').trim()
  if (!trimmed) return '/'

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const noTrailingSlash = withLeadingSlash.replace(/\/+$/, '')
  return noTrailingSlash || '/'
}

function parseEndpoint(raw: string): ParsedEndpoint {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return {}

  try {
    const parsed = new URL(trimmed)
    return {
      origin: parsed.origin,
      path: normalizePathPrefix(parsed.pathname),
    }
  } catch {
    if (trimmed.startsWith('/')) {
      return { path: normalizePathPrefix(trimmed) }
    }
    return {}
  }
}

function stripPrefix(path: string, prefix: string): string {
  if (!prefix || prefix === '/') return path
  if (path === prefix) return ''
  if (path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)) return path.slice(prefix.length)
  return path
}

function joinBasePath(basePath: string, rest: string): string {
  const normalizedBase = normalizePathPrefix(basePath)
  if (!rest) return normalizedBase
  if (normalizedBase === '/') return rest.startsWith('/') ? rest : `/${rest}`
  return rest.startsWith('/') ? `${normalizedBase}${rest}` : `${normalizedBase}/${rest}`
}

function inferApiTargetBasePath({
  apiBasePath,
  proxyTargetPath,
}: {
  apiBasePath?: string
  proxyTargetPath?: string
}): string {
  const normalizedProxyTargetPath = normalizePathPrefix(proxyTargetPath ?? '/')
  if (normalizedProxyTargetPath !== '/') return normalizedProxyTargetPath

  const normalizedApiBasePath = normalizePathPrefix(apiBasePath ?? '/')

  // In local dev we often expose `/api/*` from frontend and hit backend routes under `/*`.
  // Example: `/api/v1/...` on Vite should target `/v1/...` on Fastify.
  if (normalizedApiBasePath === '/api') return '/'
  if (normalizedApiBasePath.startsWith('/api/')) {
    return normalizePathPrefix(normalizedApiBasePath.slice('/api'.length))
  }

  return normalizedApiBasePath
}

// Cherche .env dans frontend/ d'abord, sinon remonte à la racine du monorepo.
// Permet de lancer `npm run dev` depuis frontend/ sans créer de .env local.
function resolveEnvDir(): string {
  const localEnv = resolve(process.cwd(), '.env')
  if (existsSync(localEnv)) return process.cwd()
  const rootEnv = resolve(process.cwd(), '..', '.env')
  if (existsSync(rootEnv)) return resolve(process.cwd(), '..')
  return process.cwd()
}

// Redémarre le serveur de développement quand un SVG de src/assets/media change : svgToVuePlugin
// les convertit en composants au démarrage. Remplace vite-plugin-restart, qui ne suit pas Vite 8.
function restartOnMediaSvgChange(): Plugin {
  const mediaDir = fileURLToPath(new URL('./src/assets/media/', import.meta.url)).replace(/\\/g, '/')
  return {
    name: 'indiehost:restart-on-media-svg',
    apply: 'serve',
    configureServer(server) {
      const onFileEvent = (file: string) => {
        const normalized = file.replace(/\\/g, '/')
        if (!normalized.startsWith(mediaDir) || !normalized.endsWith('.svg')) return
        server.config.logger.info(`SVG modifié (${basename(file)}) : redémarrage de Vite`, { timestamp: true })
        void server.restart()
      }
      server.watcher.on('add', onFileEvent)
      server.watcher.on('change', onFileEvent)
      server.watcher.on('unlink', onFileEvent)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = resolveEnvDir()
  const env = loadEnv(mode, envDir, '')
  const rawApiBaseUrl = (env.VITE_API_BASE_URL ?? '').trim()
  const rawApiProxyTarget = (env.VITE_API_PROXY_TARGET ?? '').trim()
  const rawScrapingBaseUrl = (env.VITE_SCRAPING_API_URL ?? '/scraping').trim()
  const rawScrapingProxyTarget = (env.VITE_SCRAPING_PROXY_TARGET ?? '').trim()
  const usePolling = (env.CHOKIDAR_USEPOLLING ?? '').toLowerCase() === 'true'
  const parsedPollingInterval = Number.parseInt(env.CHOKIDAR_INTERVAL ?? '300', 10)
  const pollingInterval = Number.isFinite(parsedPollingInterval) && parsedPollingInterval > 0 ? parsedPollingInterval : 300

  const parsedBase = parseEndpoint(rawApiBaseUrl)
  const parsedProxyTarget = parseEndpoint(rawApiProxyTarget)
  const parsedScrapingBase = parseEndpoint(rawScrapingBaseUrl)
  const parsedScrapingProxyTarget = parseEndpoint(rawScrapingProxyTarget)

  const apiProxyPath = parsedBase.path
  const scrapingProxyPath = parsedScrapingBase.path

  const apiTargetOrigin = parsedBase.origin || parsedProxyTarget.origin
  const apiTargetBasePath = inferApiTargetBasePath({
    apiBasePath: parsedBase.path,
    proxyTargetPath: parsedProxyTarget.path,
  })
  const scrapingTargetOrigin = parsedScrapingBase.origin || parsedScrapingProxyTarget.origin
  const scrapingTargetBasePath =
    parsedScrapingProxyTarget.path && parsedScrapingProxyTarget.path !== '/'
      ? parsedScrapingProxyTarget.path
      : '/'

  const proxy: Record<string, any> = {}

  if (apiProxyPath && apiTargetOrigin) {
    proxy[apiProxyPath] = {
      target: apiTargetOrigin,
      changeOrigin: true,
      secure: true,
      rewrite: (path: string) => {
        const proxyPrefix = normalizePathPrefix(apiProxyPath)
        const targetPrefix = normalizePathPrefix(apiTargetBasePath ?? proxyPrefix)

        const remainder = stripPrefix(path, proxyPrefix)
        if (
          targetPrefix !== '/' &&
          (remainder === targetPrefix ||
            remainder.startsWith(`${targetPrefix}/`) ||
            remainder.startsWith(`${targetPrefix}?`))
        ) {
          return remainder
        }

        return joinBasePath(targetPrefix, remainder)
      },
    }
  }

  if (scrapingProxyPath && scrapingTargetOrigin) {
    proxy[scrapingProxyPath] = {
      target: scrapingTargetOrigin,
      changeOrigin: true,
      secure: true,
      rewrite: (path: string) => {
        const proxyPrefix = normalizePathPrefix(scrapingProxyPath)
        const targetPrefix = normalizePathPrefix(scrapingTargetBasePath ?? proxyPrefix)

        const remainder = stripPrefix(path, proxyPrefix)
        if (
          targetPrefix !== '/' &&
          (remainder === targetPrefix ||
            remainder.startsWith(`${targetPrefix}/`) ||
            remainder.startsWith(`${targetPrefix}?`))
        ) {
          return remainder
        }

        return joinBasePath(targetPrefix, remainder)
      },
    }
  }

  return {
    envDir,
    plugins: [
      fileCommentInjector(),
      svgToVuePlugin(),
      restartOnMediaSvgChange(),
      vue(),
      // Pas de mode de couleur automatique : le site n'a pas de thème sombre. Sinon @nuxt/ui
      // pose `html.dark` d'après le système et passe `body` en `color-scheme: dark`, ce qui
      // affiche les contrôles natifs (radios, cases, listes) en sombre sur fond clair.
      ui({ colorMode: false }),
      // vueDevTools(),
      legalPrerender(),
      // Après legalPrerender : réécrit dist/index.html (accueil) et génère dist/pricing/index.html.
      marketingPrerender(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5179,
      allowedHosts: true,
      watch: {
        usePolling,
        interval: usePolling ? pollingInterval : undefined,
      },
      proxy: Object.keys(proxy).length ? proxy : undefined,
    },
    // Les instructions `debugger` sont retirées du build par le minifieur Oxc de Vite 8 (réglage
    // par défaut), qui remplace l'ancienne option `esbuild.drop`.
    build: {
      rolldownOptions: {
        output: {
          // Le worker de la carte (MapLibre) est livré en .mjs. nginx ne connaît pas cette extension :
          // servi en application/octet-stream avec nosniff, le navigateur refusait de l'exécuter et la
          // carte restait vide en production (2026-11-11). Publié en .js, il est servi en JavaScript.
          assetFileNames: (asset) => (asset.names.some((name) => name.endsWith('.mjs'))
            ? 'assets/[name]-[hash].js'
            : 'assets/[name]-[hash][extname]'),
        },
      },
    },
  }
})
