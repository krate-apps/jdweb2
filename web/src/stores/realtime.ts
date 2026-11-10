import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiUrl } from '@/lib/base'
import type { DownloadLink, PackageInfo, GrabberLink } from '@/api/jd'
import { useAppStore } from './app'
import { useDownloadsStore } from './downloads'
import { useGrabberStore } from './grabber'

export type DialogInfo = {
  id: number
  type: string
  properties?: Record<string, string>
}

export const useRealtimeStore = defineStore('realtime', () => {
  const connected = ref(false)
  const dialogs = ref<DialogInfo[]>([])
  let source: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let fallbackTimer: ReturnType<typeof setInterval> | null = null
  let intentionalClose = false

  function applyDownloads(payload: {
    links?: DownloadLink[]
    packages?: PackageInfo[]
    engineState?: string
  }) {
    const downloads = useDownloadsStore()
    downloads.applySnapshot({
      links: payload.links ?? [],
      packages: payload.packages ?? [],
      engineState: payload.engineState ?? 'UNKNOWN',
    })
  }

  function applyGrabber(payload: { links?: GrabberLink[] }) {
    useGrabberStore().applySnapshot(payload.links ?? [])
  }

  function applyStatus(payload: { ok: boolean; error?: string }) {
    const app = useAppStore()
    if (payload.ok) {
      app.markJdOk()
      return
    }
    useDownloadsStore().clearLists()
    useGrabberStore().applySnapshot([])
    dialogs.value = []
    app.markJdError(payload.error)
  }

  function applyDialogs(payload: { dialogs?: DialogInfo[] }) {
    dialogs.value = payload.dialogs ?? []
  }

  function stopFallback() {
    if (fallbackTimer) {
      clearInterval(fallbackTimer)
      fallbackTimer = null
    }
    useDownloadsStore().stopPolling()
  }

  function startFallback() {
    if (fallbackTimer) return
    const app = useAppStore()
    const downloads = useDownloadsStore()
    downloads.startPolling()
    fallbackTimer = setInterval(() => {
      if (document.hidden) return
      void useGrabberStore().refresh().catch(() => undefined)
    }, app.pollInterval)
  }

  function clearReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function connect() {
    intentionalClose = false
    clearReconnect()
    if (source) {
      source.close()
      source = null
    }

    const url = apiUrl('api/events')
    source = new EventSource(url, { withCredentials: true })

    source.addEventListener('open', () => {
      connected.value = true
      stopFallback()
    })

    source.addEventListener('downloads', (ev) => {
      try {
        applyDownloads(JSON.parse((ev as MessageEvent).data) as Parameters<typeof applyDownloads>[0])
      } catch {
        /* ignore malformed */
      }
    })

    source.addEventListener('grabber', (ev) => {
      try {
        applyGrabber(JSON.parse((ev as MessageEvent).data) as Parameters<typeof applyGrabber>[0])
      } catch {
        /* ignore */
      }
    })

    source.addEventListener('dialogs', (ev) => {
      try {
        applyDialogs(JSON.parse((ev as MessageEvent).data) as Parameters<typeof applyDialogs>[0])
      } catch {
        /* ignore */
      }
    })

    source.addEventListener('jd.status', (ev) => {
      try {
        applyStatus(JSON.parse((ev as MessageEvent).data) as Parameters<typeof applyStatus>[0])
      } catch {
        /* ignore */
      }
    })

    source.onerror = () => {
      connected.value = false
      source?.close()
      source = null
      startFallback()
      if (intentionalClose) return
      clearReconnect()
      reconnectTimer = setTimeout(() => connect(), 3000)
    }
  }

  function disconnect() {
    intentionalClose = true
    clearReconnect()
    stopFallback()
    source?.close()
    source = null
    connected.value = false
  }

  return {
    connected,
    dialogs,
    connect,
    disconnect,
  }
})
