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
    base,
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
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
