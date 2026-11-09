<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useDownloadsStore } from '@/stores/downloads'
import { formatSize, formatSpeed } from '@/lib/format'
import { setLocale } from '@/i18n'
import { CONTAINER_EXTENSIONS, getDialog, listDialogs } from '@/api/jd'
import AddLinksModal from '@/components/modals/AddLinksModal.vue'
import AboutModal from '@/components/modals/AboutModal.vue'
import PasswordModal from '@/components/modals/PasswordModal.vue'
import BrandMark from '@/components/ui/BrandMark.vue'
import ToastNotification from '@/components/ui/ToastNotification.vue'

const { t, locale } = useI18n()
const auth = useAuthStore()
const app = useAppStore()
const downloads = useDownloadsStore()
const router = useRouter()
const passwordDialogId = ref<number | null>(null)
const showSpeedPopover = ref(false)
const speedInputKbps = ref(0)
const draggingDlc = ref(false)
let dragDepth = 0
let dialogTimer: ReturnType<typeof setInterval> | null = null

function openSpeedPopover() {
  speedInputKbps.value = Math.round(app.speedLimit / 1024)
  showSpeedPopover.value = true
}

async function applySpeedLimit() {
  await app.applySpeedLimit(speedInputKbps.value * 1024)
  showSpeedPopover.value = false
}

function onSpeedEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') showSpeedPopover.value = false
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

function onGlobalKeydown(e: KeyboardEvent) {
  onSpeedEscape(e)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l' && !isTypingTarget(e.target)) {
    e.preventDefault()
    app.showAddLinks = true
  }
}

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false
}

function onDragEnter(event: DragEvent) {
  if (!hasFiles(event)) return
  event.preventDefault()
  dragDepth++
  draggingDlc.value = true
}

function onDragOver(event: DragEvent) {
  if (hasFiles(event)) event.preventDefault()
}

function onDragLeave(event: DragEvent) {
  if (!hasFiles(event)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) draggingDlc.value = false
}

function onWindowDrop(event: DragEvent) {
  if (!hasFiles(event)) return
  event.preventDefault()
  dragDepth = 0
  draggingDlc.value = false
  const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
    CONTAINER_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)),
  )
  if (files.length) app.addContainerFiles(files)
  else app.addToast(t('addLinks.dlcOnly'))
}

async function pollDialogs() {
  try {
    const ids = (await listDialogs()) ?? []
    for (const id of ids) {
      const dialog = await getDialog(id)
      if (/password/i.test(dialog.type ?? '')) {
        passwordDialogId.value = id
        return
      }
    }
  } catch {
    /* ignore while JD is offline */
  }
}

onMounted(async () => {
  downloads.startPolling()
  await app.checkConnection()
  void app.fetchSpeedLimit()
  try {
    await app.loadPublicConfig()
  } catch {
    /* public config requires a warm session */
  }
  void pollDialogs()
  dialogTimer = setInterval(() => void pollDialogs(), 4000)
  document.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onWindowDrop)
})

onUnmounted(() => {
  downloads.stopPolling()
  if (dialogTimer) clearInterval(dialogTimer)
  document.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onWindowDrop)
})

async function onLogout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background text-foreground">
    <header class="border-b border-border bg-surface px-3 py-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="mr-2 inline-flex items-center rounded-[10px] hover:opacity-90"
        :title="t('about.open')"
        @click="app.showAbout = true"
      >
        <BrandMark :size="22" />
      </button>
      <nav class="flex flex-wrap gap-1 text-sm">
        <RouterLink
          v-for="item in [
            { name: 'downloads', label: t('nav.downloads') },
            { name: 'grabber', label: t('nav.grabber') },
            { name: 'accounts', label: t('nav.accounts') },
            { name: 'settings', label: t('nav.settings') },
          ]"
          :key="item.name"
          :to="{ name: item.name }"
          class="px-2.5 py-1 rounded-[10px] text-muted hover:bg-surface-2 hover:text-foreground"
          active-class="!bg-surface-3 !text-foreground"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="ml-auto flex items-center gap-2 text-xs">
        <span
          class="inline-flex items-center gap-1.5 px-2 py-1 rounded-[10px] bg-surface-2"
          :title="app.connected ? t('app.connected') : t('app.disconnected')"
        >
          <span
            class="size-2 rounded-full"
            :class="app.connected ? 'bg-state-seed' : 'bg-state-error'"
          />
          {{ app.connected ? t('app.connected') : t('app.disconnected') }}
        </span>
        <select
          class="bg-input border border-border rounded-[10px] px-2 py-1"
          :value="locale"
          @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'fr')"
        >
          <option value="en">{{ t('lang.en') }}</option>
          <option value="fr">{{ t('lang.fr') }}</option>
        </select>
        <button
          type="button"
          class="bg-input border border-border rounded-[10px] px-2 py-1"
          @click="app.flipTheme()"
        >
          {{ app.theme === 'dark' ? t('theme.light') : t('theme.dark') }}
        </button>
        <button
          type="button"
          class="bg-surface-2 border border-border rounded-[10px] px-2 py-1"
          @click="onLogout"
        >
          {{ t('nav.logout') }}
        </button>
      </div>
    </header>

    <div class="relative border-b border-border bg-surface-2 px-3 py-1.5 flex flex-wrap gap-2 items-center text-sm">
      <button
        type="button"
        class="px-2 py-1 rounded-[10px] bg-primary text-primary-fg"
        :title="downloads.engineStopped ? t('downloads.startEngine') : t('downloads.stopEngine')"
        @click="downloads.engineStopped ? downloads.startEngine() : downloads.stopEngine()"
      >
        {{ downloads.engineStopped ? '▶' : '■' }}
      </button>
      <button type="button" class="px-2 py-1 rounded-[10px] bg-surface border border-border" @click="downloads.pauseAll()">
        {{ t('downloads.pauseAll') }}
      </button>
      <button type="button" class="px-2 py-1 rounded-[10px] bg-surface border border-border" @click="downloads.resumeAll()">
        {{ t('downloads.resumeAll') }}
      </button>
      <button type="button" class="px-2 py-1 rounded-[10px] bg-surface border border-border" @click="downloads.cleanFinished()">
        {{ t('downloads.cleanFinished') }}
      </button>
      <button type="button" class="px-2 py-1 rounded-[10px] bg-surface border border-border" @click="downloads.cleanFailed()">
        {{ t('downloads.cleanFailed') }}
      </button>
      <button type="button" class="px-2 py-1 rounded-[10px] bg-surface border border-border" @click="downloads.cleanOffline()">
        {{ t('downloads.cleanOffline') }}
      </button>
      <button
        type="button"
        class="px-2 py-1 rounded-[10px] bg-accent text-primary-fg"
        @click="app.showAddLinks = true"
      >
        {{ t('downloads.addLinks') }}
      </button>
      <button
        type="button"
        class="px-2 py-1 rounded-[10px] border border-border"
        :class="app.speedLimit > 0 ? 'bg-primary/20 text-accent-text' : 'bg-surface'"
        :title="app.speedLimit > 0 ? t('downloads.speedLimitOn', { n: Math.round(app.speedLimit / 1024) }) : t('downloads.speedLimitOff')"
        @click="openSpeedPopover"
      >
        {{ t('downloads.speedLimit') }}
      </button>
      <div
        v-if="showSpeedPopover"
        class="absolute top-full left-3 z-50 mt-1 min-w-52 rounded-[14px] border border-border bg-surface p-3 shadow-lg"
        @click.stop
      >
        <div class="text-xs font-semibold mb-2">{{ t('downloads.speedLimitTitle') }}</div>
        <div class="flex items-center gap-2 mb-2">
          <input
            v-model.number="speedInputKbps"
            type="number"
            min="0"
            step="100"
            class="w-24 bg-input border border-border rounded-[10px] px-2 py-1 text-xs"
            :placeholder="t('downloads.speedLimitPlaceholder')"
            @keydown.enter="applySpeedLimit"
          />
          <span class="text-xs text-muted">KB/s</span>
        </div>
        <input
          v-model.number="speedInputKbps"
          type="range"
          min="0"
          max="102400"
          step="512"
          class="w-full mb-2"
        />
        <div class="text-xs text-muted mb-3">
          {{ speedInputKbps === 0 ? t('downloads.speedLimitUnlimited') : `${speedInputKbps} KB/s` }}
        </div>
        <div class="flex gap-2">
          <button type="button" class="flex-1 px-2 py-1 text-xs rounded-[10px] bg-primary text-primary-fg" @click="applySpeedLimit">
            {{ t('downloads.speedLimitApply') }}
          </button>
          <button type="button" class="flex-1 px-2 py-1 text-xs rounded-[10px] border border-border" @click="showSpeedPopover = false">
            {{ t('common.cancel') }}
          </button>
        </div>
      </div>
      <span class="ml-auto text-muted tabular-nums">{{ formatSpeed(downloads.totalSpeed) }}</span>
    </div>

    <main class="flex-1 overflow-auto">
      <RouterView />
    </main>

    <footer class="border-t border-border bg-surface px-3 py-1.5 text-xs text-muted flex flex-wrap gap-4">
      <span>{{ t('downloads.packages') }}: {{ downloads.packages.length }}</span>
      <span>{{ t('downloads.links') }}: {{ downloads.links.length }}</span>
      <span>{{ t('downloads.speed') }}: {{ formatSpeed(downloads.totalSpeed) }}</span>
      <span>{{ t('downloads.remaining') }}: {{ formatSize(downloads.remainingBytes) }}</span>
      <span>{{ t('downloads.connections') }}: {{ downloads.activeConnections }}</span>
      <span class="ml-auto">{{ downloads.engineStopped ? t('downloads.engineStopped') : t('downloads.engineRunning') }}</span>
    </footer>

    <AddLinksModal v-if="app.showAddLinks" @close="app.showAddLinks = false" />
    <AboutModal v-if="app.showAbout" @close="app.showAbout = false" />
    <PasswordModal
      v-if="passwordDialogId != null"
      :dialog-id="passwordDialogId"
      @close="passwordDialogId = null"
    />
    <ToastNotification />
    <div
      v-if="draggingDlc"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-accent/20 border-4 border-dashed border-accent pointer-events-none"
    >
      <div class="bg-surface border border-border rounded-[14px] shadow-lg px-6 py-4 text-sm font-medium text-accent-text">
        {{ t('addLinks.dropOverlay') }}
      </div>
    </div>
  </div>
</template>
