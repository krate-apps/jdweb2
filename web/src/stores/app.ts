import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getJdVersion, getSpeedLimit, setSpeedLimit } from '@/api/jd'
import { apiJson } from '@/api/http'
import { applyTheme, resolveTheme, toggleTheme, type Theme } from '@/lib/theme'

export const useAppStore = defineStore('app', () => {
  const connected = ref(false)
  const theme = ref<Theme>(resolveTheme())
  const pollInterval = ref(Number(localStorage.getItem('jdweb.poll') ?? 2000))
  const showAddLinks = ref(false)
  /** Global download speed limit in bytes/s; 0 = unlimited. */
  const speedLimit = ref(0)
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

  async function fetchSpeedLimit() {
    try {
      speedLimit.value = (await getSpeedLimit()) ?? 0
    } catch {
      /* JD offline */
    }
  }

  async function applySpeedLimit(bytesPerSec: number) {
    const value = Math.max(0, Math.round(bytesPerSec))
    await setSpeedLimit(value)
    speedLimit.value = value
  }

  return {
    connected,
    theme,
    pollInterval,
    showAddLinks,
    speedLimit,
    publicConfig,
    checkConnection,
    setTheme,
    flipTheme,
    setPollInterval,
    loadPublicConfig,
    fetchSpeedLimit,
    applySpeedLimit,
  }
})
