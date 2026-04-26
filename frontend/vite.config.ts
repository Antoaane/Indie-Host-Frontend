import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
// Désactivé temporairement : provoque "localStorage.getItem is not a function" au chargement de la config (Node.js)
// import vueDevTools from 'vite-plugin-vue-devtools'
import ViteRestart from 'vite-plugin-restart'
import ui from '@nuxt/ui/vite'
import svgLoader from 'vite-svg-loader'
import svgToVuePlugin from './plugins/svg-to-vue/vite-plugin-svg-to-vue';
import fileCommentInjector from './plugins/file-path-comment/vite-plugin-file-comment'

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

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rawApiBaseUrl = (env.VITE_API_BASE_URL ?? '').trim()
  const rawApiProxyTarget = (env.VITE_API_PROXY_TARGET ?? '').trim()
  const usePolling = (env.CHOKIDAR_USEPOLLING ?? '').toLowerCase() === 'true'
  const parsedPollingInterval = Number.parseInt(env.CHOKIDAR_INTERVAL ?? '300', 10)
  const pollingInterval = Number.isFinite(parsedPollingInterval) && parsedPollingInterval > 0 ? parsedPollingInterval : 300

  const parsedBase = parseEndpoint(rawApiBaseUrl)
  const parsedProxyTarget = parseEndpoint(rawApiProxyTarget)

  const apiProxyPath = parsedBase.path

  const apiTargetOrigin = parsedBase.origin || parsedProxyTarget.origin
  const apiTargetBasePath = inferApiTargetBasePath({
    apiBasePath: parsedBase.path,
    proxyTargetPath: parsedProxyTarget.path,
  })

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

  return {
    plugins: [
      fileCommentInjector(),
      svgToVuePlugin(),
      ViteRestart({
        restart: ['src/assets/media/**/*.svg'], // Restart vite si des SVG changent
      }),
      vue(),
      ui(),
      // vueDevTools(),
      svgLoader(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5179,
      watch: {
        usePolling,
        interval: usePolling ? pollingInterval : undefined,
      },
      proxy: Object.keys(proxy).length ? proxy : undefined,
    },
    esbuild: {
      drop: ['debugger'],
    },
  }
})
