import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { GrabberLink } from '@/api/jd'
import * as jd from '@/api/jd'

export const useGrabberStore = defineStore('grabber', () => {
  const links = ref<GrabberLink[]>([])
  const selected = ref<Set<number>>(new Set())

  function applySnapshot(next: GrabberLink[]) {
    links.value = next
  }

  async function refresh() {
    links.value = (await jd.queryGrabberLinks()) ?? []
  }

  function toggleSelect(uuid: number) {
    const next = new Set(selected.value)
    if (next.has(uuid)) next.delete(uuid)
    else next.add(uuid)
    selected.value = next
  }

  async function confirmAll() {
    const ids = links.value.map((l) => l.uuid)
    if (!ids.length) return
    await jd.moveGrabberToDownloads(ids)
    selected.value = new Set()
    await refresh()
  }

  async function confirmSelected() {
    const ids = [...selected.value]
    if (!ids.length) return
    await jd.moveGrabberToDownloads(ids)
    selected.value = new Set()
    await refresh()
  }

  async function removeSelected() {
    const ids = [...selected.value]
    if (!ids.length) return
    await jd.removeGrabberLinks(ids)
    selected.value = new Set()
    await refresh()
  }

  return {
    links,
    selected,
    applySnapshot,
    refresh,
    toggleSelect,
    confirmAll,
    confirmSelected,
    removeSelected,
  }
})
