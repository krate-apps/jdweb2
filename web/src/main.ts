import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { applyTheme, resolveTheme } from './lib/theme'
import './style.css'

applyTheme(resolveTheme())

createApp(App).use(createPinia()).use(router).use(i18n).mount('#app')

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = document.querySelector('meta[name="jdweb-base-path"]')?.getAttribute('content') ?? ''
    const swUrl = `${base || ''}/sw.js`.replace(/\/{2,}/g, '/').replace(':/', '://')
    void navigator.serviceWorker.register(swUrl).catch(() => undefined)
  })
}
