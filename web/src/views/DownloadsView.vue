<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronRight, FolderInput } from '@lucide/vue'
import { useDownloadsStore } from '@/stores/downloads'
import type { PackageInfo } from '@/api/jd'
import * as jd from '@/api/jd'
import { formatEta, formatSize, formatSpeed } from '@/lib/format'
import MoveModal from '@/components/modals/MoveModal.vue'
import PasswordModal from '@/components/modals/PasswordModal.vue'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'

type Filter = 'all' | 'running' | 'finished' | 'error'
type SortKey = 'name' | 'size' | 'eta'

const { t } = useI18n()
const downloads = useDownloadsStore()
const expanded = ref<Set<number>>(new Set())
const moveTarget = ref<{ uuid: number; saveTo?: string } | null>(null)
const passwordTarget = ref<number | null>(null)
const filter = ref<Filter>('all')
const sortKey = ref<SortKey>('name')
const search = ref('')

function packageMatches(pkg: PackageInfo): boolean {
  const q = search.value.trim().toLowerCase()
  if (q) {
    const hosts = (pkg.hosts ?? []).join(' ').toLowerCase()
    const hay = `${pkg.name ?? ''} ${hosts} ${pkg.status ?? ''} ${pkg.comment ?? ''}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (filter.value === 'all') return true
  if (filter.value === 'finished') return Boolean(pkg.finished)
  if (filter.value === 'running') {
    if (pkg.finished) return false
    if ((pkg.speed ?? 0) > 0) return true
    return downloads.linksForPackage(pkg.uuid).some((l) => l.running)
  }
  return Boolean(pkg.status && /error|offline|failed/i.test(pkg.status))
}

const visiblePackages = computed(() => {
  const list = downloads.packages.filter(packageMatches)
  const sorted = [...list]
  sorted.sort((a, b) => {
    if (sortKey.value === 'size') return (b.bytesTotal ?? 0) - (a.bytesTotal ?? 0)
    if (sortKey.value === 'eta') {
      const ae = a.eta == null || a.eta < 0 ? Number.POSITIVE_INFINITY : a.eta
      const be = b.eta == null || b.eta < 0 ? Number.POSITIVE_INFINITY : b.eta
      return ae - be
    }
    return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
  })
  return sorted
})

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
      { id: 'rename', label: t('downloads.rename') },
      { id: 'comment', label: t('downloads.setComment') },
      { id: 'stopAfter', label: t('downloads.stopAfter') },
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

function showMenu(event: MouseEvent | TouchEvent, type: 'package' | 'link', uuid: number) {
  const point =
    'touches' in event && event.touches[0]
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY }
  menu.value = { visible: true, x: point.x, y: point.y, type, uuid }
}

function hideMenu() {
  menu.value = null
}

let longPressTimer: ReturnType<typeof setTimeout> | null = null

function onLongPressStart(event: TouchEvent, type: 'package' | 'link', uuid: number) {
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    showMenu(event, type, uuid)
  }, 480)
}

function onLongPressEnd() {
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = null
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
    if (action === 'rename') {
      const next = window.prompt(t('downloads.renamePrompt'), pkg?.name ?? '')
      if (next == null || !next.trim() || next.trim() === pkg?.name) return
      await jd.renamePackage(uuid, next.trim())
      await downloads.refresh()
      return
    }
    if (action === 'comment') {
      const next = window.prompt(t('downloads.commentPrompt'), pkg?.comment ?? '')
      if (next == null) return
      await jd.setPackageComment(uuid, next)
      await downloads.refresh()
      return
    }
    if (action === 'stopAfter') {
      await jd.stopAfterCurrentLinks()
      await downloads.refresh()
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
  <div class="p-3 sm:p-4 space-y-3" @click="hideMenu">
    <div class="jd-panel rounded-[16px] px-3 py-2 flex flex-nowrap items-center gap-3 text-sm overflow-x-auto">
      <label class="inline-flex items-center gap-2 shrink-0 min-w-0 flex-1 max-w-xs">
        <span class="text-xs font-medium text-muted shrink-0">{{ t('downloads.search') }}</span>
        <input
          v-model="search"
          type="search"
          class="jd-field py-1.5 w-full min-w-32"
          :placeholder="t('downloads.searchPlaceholder')"
        />
      </label>
      <label class="inline-flex items-center gap-2 shrink-0">
        <span class="text-xs font-medium text-muted">{{ t('downloads.filter') }}</span>
        <select v-model="filter" class="jd-field min-w-28 py-1.5">
          <option value="all">{{ t('downloads.filterAll') }}</option>
          <option value="running">{{ t('downloads.filterRunning') }}</option>
          <option value="finished">{{ t('downloads.filterFinished') }}</option>
          <option value="error">{{ t('downloads.filterError') }}</option>
        </select>
      </label>
      <label class="inline-flex items-center gap-2 shrink-0">
        <span class="text-xs font-medium text-muted">{{ t('downloads.sort') }}</span>
        <select v-model="sortKey" class="jd-field min-w-28 py-1.5">
          <option value="name">{{ t('downloads.name') }}</option>
          <option value="size">{{ t('downloads.size') }}</option>
          <option value="eta">{{ t('downloads.eta') }}</option>
        </select>
      </label>
      <span class="jd-chip ml-auto shrink-0 text-muted tabular-nums">{{ visiblePackages.length }}</span>
    </div>

    <!-- Mobile card stack -->
    <div class="md:hidden space-y-2">
      <article
        v-for="pkg in visiblePackages"
        :key="pkg.uuid"
        class="jd-panel rounded-[16px] p-3 space-y-2"
        @contextmenu.prevent="showMenu($event, 'package', pkg.uuid)"
        @touchstart.passive="onLongPressStart($event, 'package', pkg.uuid)"
        @touchend="onLongPressEnd"
        @touchmove="onLongPressEnd"
        @touchcancel="onLongPressEnd"
      >
        <div class="flex items-start gap-2">
          <button
            type="button"
            class="inline-flex items-center justify-center size-7 rounded-[8px] text-muted hover:bg-surface-3 hover:text-foreground shrink-0 mt-0.5"
            @click="toggleExpand(pkg.uuid)"
          >
            <ChevronDown v-if="expanded.has(pkg.uuid)" class="size-3.5" aria-hidden="true" />
            <ChevronRight v-else class="size-3.5" aria-hidden="true" />
          </button>
          <div class="min-w-0 flex-1 space-y-1.5">
            <p class="font-medium text-sm truncate" :title="pkg.name">{{ pkg.name }}</p>
            <div class="flex flex-wrap gap-1 items-center">
              <span class="jd-chip" :class="statusClass(pkg.status, pkg.finished)">{{ pkg.status || '—' }}</span>
              <span
                v-if="pkg.extraction && pkg.extraction !== 'none'"
                class="jd-chip"
                :class="{
                  'text-state-down': pkg.extraction === 'extracting',
                  'text-state-seed': pkg.extraction === 'ok',
                  'text-state-error': pkg.extraction === 'failed' || pkg.extraction === 'needPassword',
                }"
              >
                {{
                  pkg.extraction === 'extracting'
                    ? t('extraction.extracting')
                    : pkg.extraction === 'ok'
                      ? t('extraction.ok')
                      : pkg.extraction === 'needPassword'
                        ? t('extraction.needPassword')
                        : t('extraction.failed')
                }}
              </span>
            </div>
            <div class="h-2 rounded-full bg-surface-3 overflow-hidden">
              <div
                class="h-full progress-fill rounded-full"
                :style="{ width: `${progress(pkg.bytesLoaded, pkg.bytesTotal)}%` }"
              />
            </div>
            <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted tabular-nums">
              <span>{{ formatSize(pkg.bytesTotal) }}</span>
              <span>{{ formatSpeed(pkg.speed) }}</span>
              <span>{{ formatEta(pkg.eta) }}</span>
            </div>
          </div>
          <button
            type="button"
            class="jd-btn jd-btn-ghost !px-2 !py-1 text-xs text-accent-text shrink-0"
            @click="moveTarget = { uuid: pkg.uuid, saveTo: pkg.saveTo }"
          >
            <FolderInput class="size-3.5" aria-hidden="true" />
            {{ t('downloads.move') }}
          </button>
        </div>
        <ul v-if="expanded.has(pkg.uuid)" class="space-y-1.5 pl-9">
          <li
            v-for="link in downloads.linksForPackage(pkg.uuid)"
            :key="link.uuid"
            class="flex items-center gap-2 text-xs"
            @contextmenu.prevent="showMenu($event, 'link', link.uuid)"
          >
            <input
              type="checkbox"
              class="accent-[var(--jd-primary)] shrink-0"
              :checked="downloads.selected.has(link.uuid)"
              @change="downloads.toggleSelect(link.uuid)"
            />
            <span class="truncate flex-1 min-w-0" :title="link.name">{{ link.name }}</span>
            <span class="text-muted shrink-0" :class="statusClass(link.status, link.finished, link.running)">
              {{ link.status || '—' }}
            </span>
          </li>
        </ul>
      </article>
      <p v-if="!visiblePackages.length" class="text-sm text-muted p-8 text-center jd-panel rounded-[16px]">
        {{ downloads.packages.length ? t('downloads.searchEmpty') : t('common.empty') }}
      </p>
    </div>

    <!-- Desktop table -->
    <div class="hidden md:block jd-panel rounded-[16px] overflow-hidden">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="text-left text-[11px] uppercase tracking-wide text-muted bg-surface-2/50 border-b border-border">
            <th class="w-9 py-2.5 pl-2" />
            <th class="py-2.5 pr-2 font-medium">{{ t('downloads.name') }}</th>
            <th class="py-2.5 px-2 text-right font-medium">{{ t('downloads.size') }}</th>
            <th class="py-2.5 px-2 font-medium">{{ t('downloads.hoster') }}</th>
            <th class="py-2.5 px-2 font-medium">{{ t('downloads.status') }}</th>
            <th class="py-2.5 px-2 text-right font-medium">{{ t('downloads.speed') }}</th>
            <th class="py-2.5 px-2 text-right font-medium hidden lg:table-cell">{{ t('downloads.eta') }}</th>
            <th class="py-2.5 px-2 font-medium min-w-[110px]">{{ t('downloads.progress') }}</th>
            <th class="py-2.5 px-2 font-medium hidden lg:table-cell">{{ t('downloads.comment') }}</th>
            <th class="w-24" />
          </tr>
        </thead>
        <tbody>
          <template v-for="pkg in visiblePackages" :key="pkg.uuid">
            <tr
              class="border-b border-border/50 hover:bg-surface-2/40 transition-colors"
              @contextmenu.prevent="showMenu($event, 'package', pkg.uuid)"
              @touchstart.passive="onLongPressStart($event, 'package', pkg.uuid)"
              @touchend="onLongPressEnd"
              @touchmove="onLongPressEnd"
              @touchcancel="onLongPressEnd"
            >
              <td class="py-2.5 pl-2">
                <button
                  type="button"
                  class="inline-flex items-center justify-center size-7 rounded-[8px] text-muted hover:bg-surface-3 hover:text-foreground"
                  @click="toggleExpand(pkg.uuid)"
                >
                  <ChevronDown v-if="expanded.has(pkg.uuid)" class="size-3.5" aria-hidden="true" />
                  <ChevronRight v-else class="size-3.5" aria-hidden="true" />
                </button>
              </td>
              <td class="py-2.5 font-medium truncate max-w-[280px]" :title="pkg.name">{{ pkg.name }}</td>
              <td class="py-2.5 px-2 text-right tabular-nums text-muted">{{ formatSize(pkg.bytesTotal) }}</td>
              <td class="py-2.5 px-2 text-muted truncate max-w-[120px]">
                {{ (pkg.hosts ?? []).join(', ') || '—' }}
              </td>
              <td class="py-2.5 px-2">
                <div class="flex flex-wrap gap-1 items-center">
                  <span class="jd-chip" :class="statusClass(pkg.status, pkg.finished)">{{ pkg.status || '—' }}</span>
                  <span
                    v-if="pkg.extraction && pkg.extraction !== 'none'"
                    class="jd-chip"
                    :class="{
                      'text-state-down': pkg.extraction === 'extracting',
                      'text-state-seed': pkg.extraction === 'ok',
                      'text-state-error': pkg.extraction === 'failed' || pkg.extraction === 'needPassword',
                    }"
                  >
                    {{
                      pkg.extraction === 'extracting'
                        ? t('extraction.extracting')
                        : pkg.extraction === 'ok'
                          ? t('extraction.ok')
                          : pkg.extraction === 'needPassword'
                            ? t('extraction.needPassword')
                            : t('extraction.failed')
                    }}
                  </span>
                </div>
              </td>
              <td class="py-2.5 px-2 text-right tabular-nums">{{ formatSpeed(pkg.speed) }}</td>
              <td class="py-2.5 px-2 text-right tabular-nums hidden lg:table-cell">{{ formatEta(pkg.eta) }}</td>
              <td class="py-2.5 px-2">
                <div class="h-2 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    class="h-full progress-fill rounded-full"
                    :style="{ width: `${progress(pkg.bytesLoaded, pkg.bytesTotal)}%` }"
                  />
                </div>
              </td>
              <td class="py-2.5 px-2 text-xs text-muted truncate max-w-[160px] hidden lg:table-cell" :title="pkg.comment">
                {{ pkg.comment || '' }}
              </td>
              <td class="py-2.5 pr-2 text-right">
                <button
                  type="button"
                  class="jd-btn jd-btn-ghost !px-2 !py-1 text-xs text-accent-text"
                  @click="moveTarget = { uuid: pkg.uuid, saveTo: pkg.saveTo }"
                >
                  <FolderInput class="size-3.5" aria-hidden="true" />
                  {{ t('downloads.move') }}
                </button>
              </td>
            </tr>
            <tr
              v-for="link in expanded.has(pkg.uuid) ? downloads.linksForPackage(pkg.uuid) : []"
              :key="link.uuid"
              class="bg-surface-2/25 border-b border-border/40 text-xs"
              @contextmenu.prevent="showMenu($event, 'link', link.uuid)"
            >
              <td class="py-1.5 pl-3">
                <input
                  type="checkbox"
                  class="accent-[var(--jd-primary)]"
                  :checked="downloads.selected.has(link.uuid)"
                  @change="downloads.toggleSelect(link.uuid)"
                />
              </td>
              <td class="py-1.5 pl-4 truncate max-w-[280px]" :title="link.name">{{ link.name }}</td>
              <td class="py-1.5 px-2 text-right">{{ formatSize(link.bytesTotal) }}</td>
              <td class="py-1.5 px-2">{{ link.host || '—' }}</td>
              <td class="py-1.5 px-2" :class="statusClass(link.status, link.finished, link.running)">
                {{ link.status || '—' }}
              </td>
              <td class="py-1.5 px-2 text-right">{{ formatSpeed(link.speed) }}</td>
              <td class="py-1.5 px-2 text-right hidden lg:table-cell">{{ formatEta(link.eta) }}</td>
              <td class="py-1.5 px-2">
                <div class="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    class="h-full progress-fill rounded-full"
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

      <p v-if="!visiblePackages.length" class="text-sm text-muted p-10 text-center">
        {{ downloads.packages.length ? t('downloads.searchEmpty') : t('common.empty') }}
      </p>
    </div>

    <div
      v-if="downloads.selected.size"
      class="jd-panel fixed bottom-14 left-1/2 -translate-x-1/2 flex gap-2 rounded-[16px] px-3 py-2.5 text-sm z-30"
    >
      <button type="button" class="jd-btn jd-btn-primary" @click="downloads.forceSelected()">
        {{ t('downloads.force') }}
      </button>
      <button type="button" class="jd-btn jd-btn-ghost" @click="downloads.removeSelected()">
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
