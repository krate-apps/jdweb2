import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '')
  const basePath = (env.JDWEB_BASE_PATH || '').replace(/\/+$/, '')
  const base = basePath ? `${basePath}/` : '/'
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8787'

  return {
    // Prod builds use `/` + runtime asset base injected by the server so one
    // image works under any JDWEB_BASE_PATH. Dev keeps the env prefix for HMR.
    base: mode === 'production' ? '/' : base,
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    experimental: {
      renderBuiltUrl(filename, { hostType }) {
        if (mode !== 'production') return undefined
        if (hostType === 'js') {
          // Read the server-injected meta (CSP-safe). An inline
          // window.__JDWEB_ASSET_BASE__=… script is blocked by script-src 'self'.
          return {
            runtime: `((document.querySelector('meta[name="jdweb-base-path"]')||{content:""}).content||"")+${JSON.stringify('/' + filename)}`,
          }
        }
        // Fonts and other CSS urls must be relative so they resolve under any prefix.
        if (hostType === 'css') {
          return { relative: true }
        }
        // HTML keeps root-absolute paths; the server rewrites index.html href/src.
        return '/' + filename
      },
    },
    server: {
      port: 5173,
      proxy: {
        [`${basePath}/api`]: {
          target: proxyTarget,
          changeOrigin: true,
        },
        ...(basePath
          ? {}
          : {
              '/api': { target: proxyTarget, changeOrigin: true },
            }),
      },
    },
  }
})
