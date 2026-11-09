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
  const showAbout = ref(false)
  /** Container files dropped on the window, picked up by the Add links dialog. */
  const droppedFiles = ref<File[]>([])
  /** Global download speed limit in bytes/s; 0 = unlimited. */
  const speedLimit = ref(0)
  const showCompletionToasts = ref(localStorage.getItem('jdweb.toasts') !== 'false')
  const toasts = ref<{ id: number; message: string }[]>([])
  let toastSeq = 0
  const publicConfig = ref<{
    version?: string
    basePath?: string
    stagingDir: string
    moviesDir: string
    showsDir: string
    otherDir: string
    moverEnabled: boolean
    moverIntervalMs?: number
    jdApiUrl?: string
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

  function addContainerFiles(files: File[]) {
    if (!files.length) return
    droppedFiles.value = [...droppedFiles.value, ...files]
    showAddLinks.value = true
  }

  function watchCompletionToasts() {
    localStorage.setItem('jdweb.toasts', String(showCompletionToasts.value))
  }

  function addToast(message: string) {
    const id = ++toastSeq
    toasts.value.push({ id, message })
    setTimeout(() => dismissToast(id), 5000)
  }

  function dismissToast(id: number) {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  return {
    connected,
    theme,
    pollInterval,
    showAddLinks,
    showAbout,
    droppedFiles,
    speedLimit,
    showCompletionToasts,
    toasts,
    publicConfig,
    checkConnection,
    setTheme,
    flipTheme,
    setPollInterval,
    loadPublicConfig,
    fetchSpeedLimit,
    applySpeedLimit,
    addContainerFiles,
    watchCompletionToasts,
    addToast,
    dismissToast,
  }
})
