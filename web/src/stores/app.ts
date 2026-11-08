import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getJdVersion } from '@/api/jd'
import { apiJson } from '@/api/http'
import { applyTheme, resolveTheme, toggleTheme, type Theme } from '@/lib/theme'

export const useAppStore = defineStore('app', () => {
  const connected = ref(false)
  const theme = ref<Theme>(resolveTheme())
  const pollInterval = ref(Number(localStorage.getItem('jdweb.poll') ?? 2000))
  const showAddLinks = ref(false)
  const publicConfig = ref<{
    stagingDir: string
    moviesDir: string
    showsDir: string
    otherDir: string
    moverEnabled: boolean
  } | null>(null)

  applyTheme(theme.value)

  async function checkConnection() {
    try {
      await getJdVersion()
      connected.value = true
    } catch {
      connected.value = false
    }
  }

  function setTheme(next: Theme) {
    theme.value = next
    applyTheme(next)
  }

  function flipTheme() {
    theme.value = toggleTheme()
  }

  function setPollInterval(ms: number) {
    const clamped = Math.max(500, Math.min(10_000, ms))
    pollInterval.value = clamped
    localStorage.setItem('jdweb.poll', String(clamped))
  }

  async function loadPublicConfig() {
    publicConfig.value = await apiJson('api/config/public')
  }

  return {
    connected,
    theme,
    pollInterval,
    showAddLinks,
    publicConfig,
    checkConnection,
    setTheme,
    flipTheme,
    setPollInterval,
    loadPublicConfig,
  }
})
