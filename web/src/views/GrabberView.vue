<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGrabberStore } from '@/stores/grabber'
import { useAppStore } from '@/stores/app'
import { useDownloadsStore } from '@/stores/downloads'
import { formatSize } from '@/lib/format'
import { moveGrabberToDownloads, removeGrabberLinks } from '@/api/jd'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'

const { t } = useI18n()
const grabber = useGrabberStore()
const app = useAppStore()
const downloads = useDownloadsStore()

const menu = ref<{ visible: boolean; x: number; y: number; uuid: number } | null>(null)
const search = ref('')

const menuItems = computed<ContextMenuItem[]>(() => [
  { id: 'confirm', label: t('context.confirm') },
  { id: 'openurl', label: t('context.openUrl') },
  { id: 'remove', label: t('common.remove'), danger: true },
])

const visibleLinks = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return grabber.links
  return grabber.links.filter((link) => {
    const hay = `${link.name ?? ''} ${link.host ?? ''} ${link.url ?? ''} ${link.availability ?? ''}`.toLowerCase()
    return hay.includes(q)
  })
})

onMounted(() => void grabber.refresh())

async function confirmAll() {
  await grabber.confirmAll()
  await downloads.refresh()
}

async function confirmSelected() {
  await grabber.confirmSelected()
  await downloads.refresh()
}

function showMenu(event: MouseEvent, uuid: number) {
  menu.value = { visible: true, x: event.clientX, y: event.clientY, uuid }
}

function hideMenu() {
  menu.value = null
}

async function onMenuSelect(action: string) {
  const current = menu.value
  hideMenu()
  if (!current) return
  const ids =
    grabber.selected.size > 1 && grabber.selected.has(current.uuid)
      ? [...grabber.selected]
      : [current.uuid]

  if (action === 'confirm') {
    await moveGrabberToDownloads(ids)
    grabber.selected = new Set()
    await grabber.refresh()
    await downloads.refresh()
  } else if (action === 'remove') {
    await removeGrabberLinks(ids)
    grabber.selected = new Set()
    await grabber.refresh()
  } else if (action === 'openurl') {
    const link = grabber.links.find((l) => l.uuid === current.uuid)
    if (link?.url) window.open(link.url, '_blank', 'noopener,noreferrer')
  }
}
</script>

<template>
  <div class="p-4 md:p-5 space-y-4" @click="hideMenu">
    <div class="flex flex-wrap gap-2 items-center">
      <h1 class="text-2xl font-semibold tracking-tight mr-auto">{{ t('grabber.title') }}</h1>
      <label class="inline-flex items-center gap-2 min-w-0 flex-1 max-w-xs order-last sm:order-none basis-full sm:basis-auto">
        <span class="sr-only">{{ t('downloads.search') }}</span>
        <input
          v-model="search"
          type="search"
          class="jd-field py-1.5 w-full"
          :placeholder="t('downloads.searchPlaceholder')"
        />
      </label>
      <button type="button" class="jd-btn jd-btn-primary" @click="confirmAll">
        {{ t('grabber.confirmAll') }}
      </button>
      <button
        type="button"
        class="jd-btn jd-btn-ghost disabled:opacity-40"
        :disabled="!grabber.selected.size"
        @click="confirmSelected"
      >
        {{ t('grabber.confirmSelected') }}
      </button>
      <button
        type="button"
        class="jd-btn jd-btn-ghost disabled:opacity-40"
        :disabled="!grabber.selected.size"
        @click="grabber.removeSelected()"
      >
        {{ t('grabber.removeSelected') }}
      </button>
      <button type="button" class="jd-btn jd-btn-primary" @click="app.showAddLinks = true">
        {{ t('grabber.addLinks') }}
      </button>
    </div>

    <div v-if="visibleLinks.length" class="jd-panel rounded-[16px] overflow-hidden overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-muted border-b border-border bg-surface-2/40">
            <th class="w-10 px-3 py-2.5" />
            <th class="px-3 py-2.5 font-medium">{{ t('downloads.name') }}</th>
            <th class="px-3 py-2.5 font-medium text-right hidden md:table-cell">{{ t('downloads.size') }}</th>
            <th class="px-3 py-2.5 font-medium hidden md:table-cell">{{ t('downloads.hoster') }}</th>
            <th class="px-3 py-2.5 font-medium">{{ t('downloads.status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="link in visibleLinks"
            :key="link.uuid"
            class="border-b border-border/40 hover:bg-surface-2/35 transition-colors"
            @contextmenu.prevent="showMenu($event, link.uuid)"
          >
            <td class="px-3 py-2.5">
              <input
                type="checkbox"
                :checked="grabber.selected.has(link.uuid)"
                @change="grabber.toggleSelect(link.uuid)"
              />
            </td>
            <td class="px-3 py-2.5 truncate max-w-[320px] font-medium" :title="link.name">{{ link.name }}</td>
            <td class="px-3 py-2.5 text-right hidden md:table-cell tabular-nums">{{ formatSize(link.bytesTotal) }}</td>
            <td class="px-3 py-2.5 hidden md:table-cell">{{ link.host || '—' }}</td>
            <td class="px-3 py-2.5 text-muted">{{ link.availability || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="jd-panel rounded-[16px] text-sm text-muted text-center py-12">
      {{ grabber.links.length ? t('downloads.searchEmpty') : t('grabber.empty') }}
    </p>

    <ContextMenu
      v-if="menu?.visible"
      :x="menu.x"
      :y="menu.y"
      :items="menuItems"
      @select="onMenuSelect"
      @close="hideMenu"
    />
  </div>
</template>
