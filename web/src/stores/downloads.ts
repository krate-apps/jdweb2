import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DownloadLink, PackageInfo } from '@/api/jd'
import * as jd from '@/api/jd'
import { i18n } from '@/i18n'
import { useAppStore } from './app'

export const useDownloadsStore = defineStore('downloads', () => {
  const links = ref<DownloadLink[]>([])
  const packages = ref<PackageInfo[]>([])
  const engineState = ref('UNKNOWN')
  const selected = ref<Set<number>>(new Set())
  let timer: ReturnType<typeof setInterval> | null = null

  const engineStopped = computed(() => /STOP/i.test(engineState.value))
  const totalSpeed = computed(() => links.value.reduce((s, l) => s + (l.speed ?? 0), 0))
  const remainingBytes = computed(() =>
    links.value.reduce((s, l) => {
      if (l.finished) return s
      const left = (l.bytesTotal ?? 0) - (l.bytesLoaded ?? 0)
      return s + Math.max(0, left)
    }, 0),
  )
  const activeConnections = computed(() => links.value.filter((l) => l.running).length)

  function linksForPackage(pkgUuid: number) {
    return links.value.filter((l) => l.packageUUID === pkgUuid)
  }

  async function refresh() {
    const app = useAppStore()
    const prevFinished = new Set(packages.value.filter((p) => p.finished).map((p) => p.uuid))
    const [l, p, state] = await Promise.all([
      jd.queryLinks(),
      jd.queryPackages(),
      jd.getControllerState(),
    ])
    links.value = l ?? []
    packages.value = p ?? []
    engineState.value = state ?? 'UNKNOWN'
    app.connected = true
    if (app.showCompletionToasts) {
      for (const pkg of packages.value) {
        if (pkg.finished && !prevFinished.has(pkg.uuid)) {
          app.addToast(i18n.global.t('settings.downloadComplete', { name: pkg.name }))
        }
      }
    }
  }

  function startPolling() {
    stopPolling()
    const app = useAppStore()
    const tick = async () => {
      if (document.hidden) return
      try {
        await refresh()
      } catch {
        app.connected = false
      }
    }
    void tick()
    timer = setInterval(() => void tick(), app.pollInterval)
  }

  function stopPolling() {
    if (timer) clearInterval(timer)
    timer = null
  }

  function restartPolling() {
    startPolling()
  }

  function toggleSelect(uuid: number) {
    const next = new Set(selected.value)
    if (next.has(uuid)) next.delete(uuid)
    else next.add(uuid)
    selected.value = next
  }

  async function startEngine() {
    await jd.startController()
    await refresh()
  }

  async function stopEngine() {
    await jd.stopController()
    await refresh()
  }

  async function pauseAll() {
    await jd.setLinksEnabled(
      false,
      links.value.map((l) => l.uuid),
    )
    await refresh()
  }

  async function resumeAll() {
    await jd.setLinksEnabled(
      true,
      links.value.map((l) => l.uuid),
    )
    await refresh()
  }

  async function cleanFinished() {
    await jd.cleanupFinished()
    await refresh()
  }

  async function removeSelected() {
    const ids = [...selected.value]
    if (!ids.length) return
    await jd.removeLinks(ids)
    selected.value = new Set()
    await refresh()
  }

  async function forceSelected() {
    const ids = [...selected.value]
    if (!ids.length) return
    await jd.forceDownload(ids)
    await refresh()
  }

  async function forceLinks(ids: number[]) {
    if (!ids.length) return
    await jd.forceDownload(ids)
    await refresh()
  }

  async function setLinksEnabled(enabled: boolean, ids: number[]) {
    if (!ids.length) return
    await jd.setLinksEnabled(enabled, ids)
    await refresh()
  }

  async function removeLinkIds(ids: number[], packageIds: number[] = []) {
    if (!ids.length && !packageIds.length) return
    await jd.removeLinks(ids, packageIds)
    selected.value = new Set()
    await refresh()
  }

  return {
    links,
    packages,
    engineState,
    selected,
    engineStopped,
    totalSpeed,
    remainingBytes,
    activeConnections,
    linksForPackage,
    refresh,
    startPolling,
    stopPolling,
    restartPolling,
    toggleSelect,
    startEngine,
    stopEngine,
    pauseAll,
    resumeAll,
    cleanFinished,
    removeSelected,
    forceSelected,
    forceLinks,
    setLinksEnabled,
    removeLinkIds,
  }
})
