<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDownloadsStore } from '@/stores/downloads'
import { formatEta, formatSize, formatSpeed } from '@/lib/format'
import MoveModal from '@/components/modals/MoveModal.vue'
import PasswordModal from '@/components/modals/PasswordModal.vue'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'

const { t } = useI18n()
const downloads = useDownloadsStore()
const expanded = ref<Set<number>>(new Set())
const moveTarget = ref<{ uuid: number; saveTo?: string } | null>(null)
const passwordTarget = ref<number | null>(null)

const menu = ref<{
  visible: boolean
  x: number
  y: number
  type: 'package' | 'link'
  uuid: number
} | null>(null)

const menuItems = computed<ContextMenuItem[]>(() => {
  if (!menu.value) return []
  if (menu.value.type === 'package') {
    return [
      { id: 'force', label: t('downloads.force') },
      { id: 'resume', label: t('downloads.resumeAll') },
      { id: 'pause', label: t('downloads.pauseAll') },
      { id: 'move', label: t('downloads.move') },
      { id: 'password', label: t('password.retry') },
      { id: 'remove', label: t('common.remove'), danger: true },
    ]
  }
  return [
    { id: 'force', label: t('downloads.force') },
    { id: 'resume', label: t('context.resume') },
    { id: 'pause', label: t('context.pause') },
    { id: 'remove', label: t('common.remove'), danger: true },
  ]
})

function toggleExpand(uuid: number) {
  const next = new Set(expanded.value)
  if (next.has(uuid)) next.delete(uuid)
  else next.add(uuid)
  expanded.value = next
}

function statusClass(status?: string, finished?: boolean, running?: boolean) {
  if (finished) return 'text-state-seed'
  if (running) return 'text-state-down'
  if (status && /error|offline/i.test(status)) return 'text-state-error'
  if (status && /pause/i.test(status)) return 'text-state-paused'
  return 'text-muted'
}

function progress(loaded?: number, total?: number) {
  if (!total || total <= 0) return 0
  return Math.min(100, Math.round(((loaded ?? 0) / total) * 100))
}

function showMenu(event: MouseEvent, type: 'package' | 'link', uuid: number) {
  menu.value = { visible: true, x: event.clientX, y: event.clientY, type, uuid }
}

function hideMenu() {
  menu.value = null
}

function linkIdsForPackage(pkgUuid: number) {
  return downloads.linksForPackage(pkgUuid).map((l) => l.uuid)
}

async function onMenuSelect(action: string) {
  const current = menu.value
  hideMenu()
  if (!current) return
  const { type, uuid } = current

  if (type === 'package') {
    const ids = linkIdsForPackage(uuid)
    const pkg = downloads.packages.find((p) => p.uuid === uuid)
    if (action === 'move') {
      moveTarget.value = { uuid, saveTo: pkg?.saveTo }
      return
    }
    if (action === 'password') {
      passwordTarget.value = uuid
      return
    }
    if (action === 'force') await downloads.forceLinks(ids)
    else if (action === 'resume') await downloads.setLinksEnabled(true, ids)
    else if (action === 'pause') await downloads.setLinksEnabled(false, ids)
    else if (action === 'remove') await downloads.removeLinkIds([], [uuid])
    return
  }

  if (action === 'force') await downloads.forceLinks([uuid])
  else if (action === 'resume') await downloads.setLinksEnabled(true, [uuid])
  else if (action === 'pause') await downloads.setLinksEnabled(false, [uuid])
  else if (action === 'remove') await downloads.removeLinkIds([uuid])
}

</script>

<template>
  <div class="p-3 overflow-x-auto" @click="hideMenu">
    <table class="w-full text-sm border-collapse min-w-[720px]">
      <thead>
        <tr class="text-left text-xs text-muted border-b border-border">
          <th class="w-8 py-1" />
          <th class="py-1 pr-2">{{ t('downloads.name') }}</th>
          <th class="py-1 px-1 text-right hidden md:table-cell">{{ t('downloads.size') }}</th>
          <th class="py-1 px-1 hidden md:table-cell">{{ t('downloads.hoster') }}</th>
          <th class="py-1 px-1">{{ t('downloads.status') }}</th>
          <th class="py-1 px-1 text-right hidden md:table-cell">{{ t('downloads.speed') }}</th>
          <th class="py-1 px-1 text-right hidden lg:table-cell">{{ t('downloads.eta') }}</th>
          <th class="py-1 px-1 min-w-[90px]">{{ t('downloads.progress') }}</th>
          <th class="py-1 px-1 hidden lg:table-cell">{{ t('downloads.comment') }}</th>
          <th class="w-20" />
        </tr>
      </thead>
      <tbody>
        <template v-for="pkg in downloads.packages" :key="pkg.uuid">
          <tr
            class="border-b border-border/60 hover:bg-surface-2/60"
            @contextmenu.prevent="showMenu($event, 'package', pkg.uuid)"
          >
            <td class="py-1.5">
              <button type="button" class="text-muted px-1" @click="toggleExpand(pkg.uuid)">
                {{ expanded.has(pkg.uuid) ? '▾' : '▸' }}
              </button>
            </td>
            <td class="py-1.5 font-medium truncate max-w-[280px]" :title="pkg.name">{{ pkg.name }}</td>
            <td class="py-1.5 px-1 text-right tabular-nums hidden md:table-cell">{{ formatSize(pkg.bytesTotal) }}</td>
            <td class="py-1.5 px-1 text-muted hidden md:table-cell truncate max-w-[120px]">
              {{ (pkg.hosts ?? []).join(', ') || '—' }}
            </td>
            <td class="py-1.5 px-1" :class="statusClass(pkg.status, pkg.finished)">{{ pkg.status || '—' }}</td>
            <td class="py-1.5 px-1 text-right tabular-nums hidden md:table-cell">{{ formatSpeed(pkg.speed) }}</td>
            <td class="py-1.5 px-1 text-right tabular-nums hidden lg:table-cell">{{ formatEta(pkg.eta) }}</td>
            <td class="py-1.5 px-1">
              <div class="h-2 rounded bg-surface-3 overflow-hidden">
                <div
                  class="h-full progress-fill"
                  :style="{ width: `${progress(pkg.bytesLoaded, pkg.bytesTotal)}%` }"
                />
              </div>
            </td>
            <td class="py-1.5 px-1 text-xs text-muted truncate max-w-[160px] hidden lg:table-cell" :title="pkg.comment">
              {{ pkg.comment || '' }}
            </td>
            <td class="py-1.5 text-right">
              <button
                type="button"
                class="text-xs text-accent-text hover:underline"
                @click="moveTarget = { uuid: pkg.uuid, saveTo: pkg.saveTo }"
              >
                {{ t('downloads.move') }}
              </button>
            </td>
          </tr>
          <tr
            v-for="link in expanded.has(pkg.uuid) ? downloads.linksForPackage(pkg.uuid) : []"
            :key="link.uuid"
            class="bg-surface/40 border-b border-border/40 text-xs"
            @contextmenu.prevent="showMenu($event, 'link', link.uuid)"
          >
            <td class="py-1 pl-2">
              <input
                type="checkbox"
                :checked="downloads.selected.has(link.uuid)"
                @change="downloads.toggleSelect(link.uuid)"
              />
            </td>
            <td class="py-1 pl-4 truncate max-w-[280px]" :title="link.name">{{ link.name }}</td>
            <td class="py-1 px-1 text-right hidden md:table-cell">{{ formatSize(link.bytesTotal) }}</td>
            <td class="py-1 px-1 hidden md:table-cell">{{ link.host || '—' }}</td>
            <td class="py-1 px-1" :class="statusClass(link.status, link.finished, link.running)">
              {{ link.status || '—' }}
            </td>
            <td class="py-1 px-1 text-right hidden md:table-cell">{{ formatSpeed(link.speed) }}</td>
            <td class="py-1 px-1 text-right hidden lg:table-cell">{{ formatEta(link.eta) }}</td>
            <td class="py-1 px-1">
              <div class="h-1.5 rounded bg-surface-3 overflow-hidden">
                <div
                  class="h-full progress-fill"
                  :style="{ width: `${progress(link.bytesLoaded, link.bytesTotal)}%` }"
                />
              </div>
            </td>
            <td class="hidden lg:table-cell" />
            <td />
          </tr>
        </template>
      </tbody>
    </table>

    <p v-if="!downloads.packages.length" class="text-sm text-muted p-6 text-center">{{ t('common.empty') }}</p>

    <div v-if="downloads.selected.size" class="fixed bottom-12 left-1/2 -translate-x-1/2 flex gap-2 bg-surface border border-border rounded-[14px] px-3 py-2 shadow-lg text-sm">
      <button type="button" class="px-2 py-1 rounded-[10px] bg-primary text-primary-fg" @click="downloads.forceSelected()">
        {{ t('downloads.force') }}
      </button>
      <button type="button" class="px-2 py-1 rounded-[10px] border border-border" @click="downloads.removeSelected()">
        {{ t('common.remove') }}
      </button>
    </div>

    <ContextMenu
      v-if="menu?.visible"
      :x="menu.x"
      :y="menu.y"
      :items="menuItems"
      @select="onMenuSelect"
      @close="hideMenu"
    />

    <MoveModal
      v-if="moveTarget"
      :package-uuid="moveTarget.uuid"
      :current-save-to="moveTarget.saveTo"
      @close="moveTarget = null"
    />

    <PasswordModal
      v-if="passwordTarget != null"
      :package-uuid="passwordTarget"
      @close="passwordTarget = null"
    />
  </div>
</template>
