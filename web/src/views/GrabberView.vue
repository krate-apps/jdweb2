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

const menuItems = computed<ContextMenuItem[]>(() => [
  { id: 'confirm', label: t('context.confirm') },
  { id: 'openurl', label: t('context.openUrl') },
  { id: 'remove', label: t('common.remove'), danger: true },
])

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
  <div class="p-3 space-y-3" @click="hideMenu">
    <div class="flex flex-wrap gap-2 items-center">
      <h1 class="text-lg font-semibold mr-auto">{{ t('grabber.title') }}</h1>
      <button type="button" class="px-2 py-1 text-sm rounded-[10px] bg-primary text-primary-fg" @click="confirmAll">
        {{ t('grabber.confirmAll') }}
      </button>
      <button
        type="button"
        class="px-2 py-1 text-sm rounded-[10px] border border-border"
        :disabled="!grabber.selected.size"
        @click="confirmSelected"
      >
        {{ t('grabber.confirmSelected') }}
      </button>
      <button
        type="button"
        class="px-2 py-1 text-sm rounded-[10px] border border-border"
        :disabled="!grabber.selected.size"
        @click="grabber.removeSelected()"
      >
        {{ t('grabber.removeSelected') }}
      </button>
      <button type="button" class="px-2 py-1 text-sm rounded-[10px] bg-accent text-primary-fg" @click="app.showAddLinks = true">
        {{ t('grabber.addLinks') }}
      </button>
    </div>

    <table v-if="grabber.links.length" class="w-full text-sm">
      <thead>
        <tr class="text-left text-xs text-muted border-b border-border">
          <th class="w-8 py-1" />
          <th class="py-1">{{ t('downloads.name') }}</th>
          <th class="py-1 text-right hidden md:table-cell">{{ t('downloads.size') }}</th>
          <th class="py-1 hidden md:table-cell">{{ t('downloads.hoster') }}</th>
          <th class="py-1">{{ t('downloads.status') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="link in grabber.links"
          :key="link.uuid"
          class="border-b border-border/50 hover:bg-surface-2/50"
          @contextmenu.prevent="showMenu($event, link.uuid)"
        >
          <td class="py-1.5">
            <input
              type="checkbox"
              :checked="grabber.selected.has(link.uuid)"
              @change="grabber.toggleSelect(link.uuid)"
            />
          </td>
          <td class="py-1.5 truncate max-w-[320px]" :title="link.name">{{ link.name }}</td>
          <td class="py-1.5 text-right hidden md:table-cell">{{ formatSize(link.bytesTotal) }}</td>
          <td class="py-1.5 hidden md:table-cell">{{ link.host || '—' }}</td>
          <td class="py-1.5 text-muted">{{ link.availability || '—' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="text-sm text-muted text-center py-10">{{ t('grabber.empty') }}</p>

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
