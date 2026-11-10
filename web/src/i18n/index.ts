import { createI18n } from 'vue-i18n'
import en from './en'
import fr from './fr'

const saved = localStorage.getItem('jdweb.locale')
const browser = navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
const locale = saved === 'fr' || saved === 'en' ? saved : browser

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'en',
  messages: { en, fr },
})

export function setLocale(next: 'en' | 'fr') {
  i18n.global.locale.value = next
  localStorage.setItem('jdweb.locale', next)
  document.documentElement.lang = next
}

document.documentElement.lang = locale
