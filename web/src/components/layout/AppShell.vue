<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  CircleHelp,
  Download,
  Gauge,
  Link2,
  LogOut,
  Moon,
  Pause,
  Play,
  MessageCircleWarning,
  Plus,
  RefreshCw,
  Settings,
  Square,
  Sun,
  Trash2,
  Users,
  Wifi,
  WifiOff,
} from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useDownloadsStore } from '@/stores/downloads'
import { useRealtimeStore } from '@/stores/realtime'
import { formatSize, formatSpeed } from '@/lib/format'
import { setLocale } from '@/i18n'
import { CONTAINER_EXTENSIONS } from '@/api/jd'
import AddLinksModal from '@/components/modals/AddLinksModal.vue'
import AboutModal from '@/components/modals/AboutModal.vue'
import PasswordModal from '@/components/modals/PasswordModal.vue'
import CaptchaModal from '@/components/modals/CaptchaModal.vue'
import DialogPromptModal from '@/components/modals/DialogPromptModal.vue'
import BrandMark from '@/components/ui/BrandMark.vue'
import ToastNotification from '@/components/ui/ToastNotification.vue'

const { t, locale } = useI18n()
const auth = useAuthStore()
const app = useAppStore()
const downloads = useDownloadsStore()
const realtime = useRealtimeStore()
const router = useRouter()
const passwordDialogId = ref<number | null>(null)
const captchaDialog = ref<{ id: number; type: string; properties?: Record<string, string> } | null>(null)
const genericDialog = ref<{ id: number; type: string; properties?: Record<string, string> } | null>(null)
const showSpeedPopover = ref(false)
const speedInputKbps = ref(0)
const draggingDlc = ref(false)
let dragDepth = 0

watch(
  () => realtime.dialogs,
  (list) => {
    const password = list.find((d) => /password/i.test(d.type))
    const captcha = list.find((d) => /captcha/i.test(d.type))
    const other = list.find((d) => !/password/i.test(d.type) && !/captcha/i.test(d.type))
    passwordDialogId.value = password?.id ?? null
    captchaDialog.value = captcha ?? null
    genericDialog.value = other && !password && !captcha ? other : null
  },
  { deep: true },
)

const navItems = computed(() => [
  { name: 'downloads' as const, label: t('nav.downloads'), icon: Download },
  { name: 'grabber' as const, label: t('nav.grabber'), icon: Link2 },
  { name: 'accounts' as const, label: t('nav.accounts'), icon: Users },
  { name: 'settings' as const, label: t('nav.settings'), icon: Settings },
])

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

onMounted(async () => {
  realtime.connect()
  await app.checkConnection()
  void app.fetchSpeedLimit()
  try {
    await app.loadPublicConfig()
  } catch {
    /* public config requires a warm session */
  }
  document.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onWindowDrop)
})

onUnmounted(() => {
  realtime.disconnect()
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
  <div class="min-h-screen flex flex-col text-foreground pb-16 md:pb-0">
    <header class="sticky top-0 z-40 border-b border-border/70 bg-surface/80 backdrop-blur-xl px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <RouterLink
        :to="{ name: 'downloads' }"
        class="mr-1 inline-flex items-center rounded-[10px] outline-offset-2"
        :title="t('app.name')"
      >
        <BrandMark :size="22" />
      </RouterLink>

      <nav class="hidden md:flex flex-wrap gap-1 text-sm">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="{ name: item.name }"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[12px] text-muted hover:bg-surface-2/80 hover:text-foreground transition-colors"
          active-class="!bg-primary/15 !text-accent-text !font-medium !shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--jd-primary)_35%,transparent)]"
        >
          <component :is="item.icon" class="size-3.5 shrink-0 opacity-80" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-1.5 sm:gap-2 text-xs">
        <span
          class="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-[10px] bg-surface-2"
          :title="
            app.connected
              ? t('app.connected')
              : app.lastJdError
                ? t('app.disconnectedDetail', { detail: app.lastJdError })
                : t('app.disconnected')
          "
        >
          <Wifi v-if="app.connected" class="size-3.5 text-state-seed" aria-hidden="true" />
          <WifiOff v-else class="size-3.5 text-state-error" aria-hidden="true" />
          <span class="hidden sm:inline">{{ app.connected ? t('app.connected') : t('app.disconnected') }}</span>
        </span>
        <button
          type="button"
          class="inline-flex items-center justify-center size-8 rounded-[10px] border border-border text-muted hover:bg-surface-2 hover:text-foreground"
          :title="t('app.retryJd')"
          :aria-label="t('app.retryJd')"
          @click="app.checkConnection()"
        >
          <RefreshCw class="size-3.5" aria-hidden="true" />
        </button>
        <span
          v-if="realtime.dialogs.length"
          class="inline-flex items-center gap-1 px-2 py-1.5 rounded-[10px] bg-primary/15 text-accent-text"
          :title="t('dialog.pending', { n: realtime.dialogs.length })"
        >
          <MessageCircleWarning class="size-3.5" aria-hidden="true" />
          <span class="tabular-nums">{{ realtime.dialogs.length }}</span>
        </span>

        <select
          class="bg-input border border-border rounded-[10px] px-2 py-1.5"
          :value="locale"
          :aria-label="t('lang.label')"
          @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'fr')"
        >
          <option value="en">{{ t('lang.en') }}</option>
          <option value="fr">{{ t('lang.fr') }}</option>
        </select>

        <button
          type="button"
          class="inline-flex items-center justify-center size-8 bg-input border border-border rounded-[10px] hover:bg-surface-2"
          :title="app.theme === 'dark' ? t('theme.light') : t('theme.dark')"
          @click="app.flipTheme()"
        >
          <Sun v-if="app.theme === 'dark'" class="size-3.5" aria-hidden="true" />
          <Moon v-else class="size-3.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="inline-flex items-center justify-center size-8 bg-input border border-border rounded-[10px] hover:bg-surface-2"
          :title="t('about.open')"
          @click="app.showAbout = true"
        >
          <CircleHelp class="size-3.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2 border border-border rounded-[10px] hover:bg-surface-3"
          @click="onLogout"
        >
          <LogOut class="size-3.5" aria-hidden="true" />
          <span class="hidden sm:inline">{{ t('nav.logout') }}</span>
        </button>
      </div>
    </header>

    <div class="relative border-b border-border/70 bg-surface-2/55 backdrop-blur-md px-3 sm:px-4 py-2 flex flex-wrap gap-1.5 items-center text-sm">
      <button
        type="button"
        class="inline-flex items-center justify-center size-8 rounded-[12px] bg-primary text-primary-fg shadow-[0_8px_20px_var(--jd-glow)]"
        :title="downloads.engineStopped ? t('downloads.startEngine') : t('downloads.stopEngine')"
        @click="downloads.engineStopped ? downloads.startEngine() : downloads.stopEngine()"
      >
        <Play v-if="downloads.engineStopped" class="size-3.5 fill-current" aria-hidden="true" />
        <Square v-else class="size-3 fill-current" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-surface border border-border hover:bg-surface-3"
        @click="downloads.pauseAll()"
      >
        <Pause class="size-3.5" aria-hidden="true" />
        <span class="hidden md:inline">{{ t('downloads.pauseAll') }}</span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-surface border border-border hover:bg-surface-3"
        @click="downloads.resumeAll()"
      >
        <Play class="size-3.5" aria-hidden="true" />
        <span class="hidden md:inline">{{ t('downloads.resumeAll') }}</span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-surface border border-border hover:bg-surface-3"
        :title="t('downloads.cleanFinished')"
        @click="downloads.cleanFinished()"
      >
        <Trash2 class="size-3.5" aria-hidden="true" />
        <span class="hidden lg:inline">{{ t('downloads.cleanFinished') }}</span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-surface border border-border hover:bg-surface-3"
        :title="t('downloads.cleanFailed')"
        @click="downloads.cleanFailed()"
      >
        <Trash2 class="size-3.5 text-danger-text" aria-hidden="true" />
        <span class="hidden lg:inline">{{ t('downloads.cleanFailed') }}</span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-surface border border-border hover:bg-surface-3"
        :title="t('downloads.cleanOffline')"
        @click="downloads.cleanOffline()"
      >
        <WifiOff class="size-3.5" aria-hidden="true" />
        <span class="hidden lg:inline">{{ t('downloads.cleanOffline') }}</span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] bg-accent text-primary-fg"
        @click="app.showAddLinks = true"
      >
        <Plus class="size-3.5" aria-hidden="true" />
        {{ t('downloads.addLinks') }}
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] border border-border"
        :class="app.speedLimit > 0 ? 'bg-primary/20 text-accent-text' : 'bg-surface hover:bg-surface-3'"
        :title="app.speedLimit > 0 ? t('downloads.speedLimitOn', { n: Math.round(app.speedLimit / 1024) }) : t('downloads.speedLimitOff')"
        @click="openSpeedPopover"
      >
        <Gauge class="size-3.5" aria-hidden="true" />
        <span class="hidden sm:inline">{{ t('downloads.speedLimit') }}</span>
      </button>
      <div
        v-if="showSpeedPopover"
        class="jd-panel absolute top-full left-3 z-50 mt-1 min-w-52 rounded-[16px] p-3"
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
      <span class="ml-auto inline-flex items-center gap-1.5 text-muted tabular-nums">
        <Download class="size-3.5 opacity-70" aria-hidden="true" />
        {{ formatSpeed(downloads.totalSpeed) }}
      </span>
    </div>

    <main class="flex-1 overflow-auto">
      <RouterView />
    </main>

    <nav
      class="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-surface/90 backdrop-blur-xl px-2 py-1.5 flex justify-around gap-1"
      :aria-label="t('app.name')"
    >
      <RouterLink
        v-for="item in navItems"
        :key="item.name"
        :to="{ name: item.name }"
        class="flex flex-col items-center gap-0.5 px-2 py-1 rounded-[10px] text-[10px] text-muted min-w-0 flex-1"
        active-class="!text-accent-text !bg-primary/10"
      >
        <component :is="item.icon" class="size-4 shrink-0" aria-hidden="true" />
        <span class="truncate max-w-full">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <footer class="hidden md:flex border-t border-border/70 bg-surface/75 backdrop-blur-md px-3 sm:px-4 py-2 text-xs text-muted flex-wrap gap-x-4 gap-y-1 items-center">
      <span>{{ t('downloads.packages') }}: {{ downloads.packages.length }}</span>
      <span>{{ t('downloads.links') }}: {{ downloads.links.length }}</span>
      <span>{{ t('downloads.speed') }}: {{ formatSpeed(downloads.totalSpeed) }}</span>
      <span>{{ t('downloads.remaining') }}: {{ formatSize(downloads.remainingBytes) }}</span>
      <span>{{ t('downloads.connections') }}: {{ downloads.activeConnections }}</span>
      <span>{{ downloads.engineStopped ? t('downloads.engineStopped') : t('downloads.engineRunning') }}</span>
      <button
        type="button"
        class="ml-auto inline-flex items-center gap-1 hover:text-foreground"
        :title="t('about.open')"
        @click="app.showAbout = true"
      >
        <CircleHelp class="size-3.5" aria-hidden="true" />
        <span class="font-mono tabular-nums">v{{ app.publicConfig?.version ?? '…' }}</span>
      </button>
    </footer>

    <AddLinksModal v-if="app.showAddLinks" @close="app.showAddLinks = false" />
    <AboutModal v-if="app.showAbout" @close="app.showAbout = false" />
    <PasswordModal
      v-if="passwordDialogId != null"
      :dialog-id="passwordDialogId"
      @close="passwordDialogId = null"
    />
    <CaptchaModal
      v-if="captchaDialog"
      :dialog-id="captchaDialog.id"
      :type="captchaDialog.type"
      :properties="captchaDialog.properties"
      @close="captchaDialog = null"
    />
    <DialogPromptModal
      v-if="genericDialog"
      :dialog-id="genericDialog.id"
      :type="genericDialog.type"
      :properties="genericDialog.properties"
      @close="genericDialog = null"
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
