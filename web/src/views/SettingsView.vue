<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bell, Download, KeyRound, Link2, Palette, Users } from '@lucide/vue'
import { useAppStore } from '@/stores/app'
import { useDownloadsStore } from '@/stores/downloads'
import * as jd from '@/api/jd'
import * as usersApi from '@/api/users'
import type { AppUser } from '@/api/users'
import * as sessionsApi from '@/api/sessions'
import type { AppSession } from '@/api/sessions'
import { setLocale } from '@/i18n'
import { ApiError, apiJson } from '@/api/http'
import * as webhooksApi from '@/api/webhooks'
import type { Webhook, WebhookEvent } from '@/api/webhooks'
import * as settingsApi from '@/api/settings'
import type { AppSettings } from '@/api/settings'

type SectionId = 'connection' | 'downloads' | 'account' | 'users' | 'notifications' | 'appearance'

const { t, locale } = useI18n()
const app = useAppStore()
const downloads = useDownloadsStore()

const section = ref<SectionId>('connection')
const poll = ref(app.pollInterval)
const maxDownloads = ref(3)
const maxChunks = ref(1)
const maxPerHost = ref(1)
const passwords = ref<string[]>([])
const newPassword = ref('')
const users = ref<AppUser[]>([])
const newUsername = ref('')
const newUserPassword = ref('')
const userError = ref<string | null>(null)
const currentPassword = ref('')
const myNewPassword = ref('')
const myPasswordMsg = ref<string | null>(null)
const sessions = ref<AppSession[]>([])
const sessionError = ref<string | null>(null)
const moverBusy = ref(false)
const appSettings = ref<AppSettings | null>(null)
const basePathForcedByEnv = ref(false)
const settingsForm = ref({
  basePath: '',
  jdApiUrl: '',
  stagingDir: '',
  moviesDir: '',
  showsDir: '',
  otherDir: '',
  moverIntervalMs: 15000,
})
const settingsBusy = ref(false)
const settingsMsg = ref<string | null>(null)
const settingsError = ref<string | null>(null)
const moveEvents = ref<
  {
    id: number
    packageName: string
    fromPath: string
    toPath: string
    status: string
    error: string | null
    createdAt: number
  }[]
>([])
const webhooks = ref<Webhook[]>([])
const newWebhookUrl = ref('')
const webhookError = ref<string | null>(null)
const webhookEventOptions: WebhookEvent[] = [
  'download.finished',
  'mover.succeeded',
  'mover.failed',
]
const error = ref<string | null>(null)

const nav = computed(() => [
  { id: 'connection' as const, label: t('settings.navConnection'), icon: Link2 },
  { id: 'downloads' as const, label: t('settings.navDownloads'), icon: Download },
  { id: 'account' as const, label: t('settings.navAccount'), icon: KeyRound },
  { id: 'users' as const, label: t('settings.navUsers'), icon: Users },
  { id: 'notifications' as const, label: t('settings.navNotifications'), icon: Bell },
  { id: 'appearance' as const, label: t('settings.navAppearance'), icon: Palette },
])

const moverEnabled = computed(() => settingsForm.value.moverIntervalMs > 0)

async function loadWebhooks() {
  webhookError.value = null
  try {
    webhooks.value = await webhooksApi.listWebhooks()
  } catch (err) {
    webhookError.value = err instanceof ApiError ? err.message : t('common.error')
  }
}

async function addWebhook() {
  const url = newWebhookUrl.value.trim()
  if (!url) return
  webhookError.value = null
  try {
    await webhooksApi.createWebhook(url, [...webhookEventOptions])
    newWebhookUrl.value = ''
    await loadWebhooks()
  } catch (err) {
    webhookError.value = err instanceof ApiError ? err.message : t('common.error')
  }
}

async function toggleWebhook(hook: Webhook) {
  webhookError.value = null
  try {
    await webhooksApi.updateWebhook(hook.id, { enabled: !hook.enabled })
    await loadWebhooks()
  } catch (err) {
    webhookError.value = err instanceof ApiError ? err.message : t('common.error')
  }
}

async function removeWebhook(hook: Webhook) {
  if (!confirm(t('settings.removeWebhookConfirm'))) return
  webhookError.value = null
  try {
    await webhooksApi.deleteWebhook(hook.id)
    await loadWebhooks()
  } catch (err) {
    webhookError.value = err instanceof ApiError ? err.message : t('common.error')
  }
}

async function loadAppSettings() {
  settingsError.value = null
  try {
    const res = await settingsApi.getSettings()
    appSettings.value = res.settings
    basePathForcedByEnv.value = res.basePathForcedByEnv
    settingsForm.value = { ...res.settings }
  } catch (err) {
    settingsError.value = err instanceof ApiError ? err.message : t('common.error')
  }
}

async function saveAppSettings() {
  settingsBusy.value = true
  settingsMsg.value = null
  settingsError.value = null
  try {
    const res = await settingsApi.patchSettings({ ...settingsForm.value })
    appSettings.value = res.settings
    basePathForcedByEnv.value = res.basePathForcedByEnv
    settingsForm.value = { ...res.settings }
    settingsMsg.value = res.restartRequired ? t('settings.savedRestart') : t('settings.saved')
    await app.loadPublicConfig()
  } catch (err) {
    if (err instanceof ApiError && err.message === 'base_path_forced_by_env') {
      settingsError.value = t('settings.basePathForced')
    } else {
      settingsError.value = err instanceof ApiError ? err.message : t('common.error')
    }
  } finally {
    settingsBusy.value = false
  }
}

async function detectJd() {
  settingsBusy.value = true
  settingsError.value = null
  try {
    const res = await settingsApi.probeJd()
    if ('candidates' in res && res.candidates?.length) {
      settingsForm.value.jdApiUrl = res.candidates[0].url
      settingsMsg.value = t('settings.jdDetected', { url: res.candidates[0].url })
    } else if ('ok' in res && res.ok) {
      settingsMsg.value = t('settings.jdOk')
    } else {
      settingsError.value = t('settings.jdNotFound')
    }
  } catch (err) {
    settingsError.value = err instanceof ApiError ? err.message : t('common.error')
  } finally {
    settingsBusy.value = false
  }
}

async function loadMoveHistory() {
  try {
    const result = await apiJson<{ events: typeof moveEvents.value }>('api/mover/history')
    moveEvents.value = result.events
  } catch {
    moveEvents.value = []
  }
}

async function runMover() {
  moverBusy.value = true
  try {
    const result = await apiJson<{ ok: boolean; moved: number; failed: number }>('api/mover/run', {
      method: 'POST',
      body: '{}',
    })
    app.addToast(t('settings.moverResult', { moved: result.moved, failed: result.failed }))
    await downloads.refresh()
    await loadMoveHistory()
  } catch (err) {
    app.addToast(err instanceof ApiError ? err.message : t('common.error'))
  } finally {
    moverBusy.value = false
  }
}

function formatMoveTime(ms: number): string {
  return new Date(ms).toLocaleString()
}

function formatErr(err: unknown): string {
  const message = err instanceof Error ? err.message : ''
  if (message === 'jdownloader_unreachable' || /fetch failed|unreachable/i.test(message)) {
    return t('common.jdOffline')
  }
  return message || t('common.error')
}

async function loadUsers() {
  userError.value = null
  try {
    users.value = (await usersApi.listUsers()).users
  } catch (err) {
    userError.value = err instanceof ApiError ? err.message : t('common.error')
  }
}

async function addUser() {
  userError.value = null
  try {
    await usersApi.createUser(newUsername.value.trim(), newUserPassword.value)
    newUsername.value = ''
    newUserPassword.value = ''
    await loadUsers()
  } catch (err) {
    userError.value = err instanceof ApiError ? err.message : t('common.error')
  }
}

async function removeUser(user: AppUser) {
  if (!confirm(t('settings.removeUserConfirm'))) return
  userError.value = null
  try {
    await usersApi.deleteUser(user.id)
    await loadUsers()
  } catch (err) {
    userError.value = err instanceof ApiError ? err.message : t('common.error')
  }
}

async function changeMyPassword() {
  myPasswordMsg.value = null
  try {
    await usersApi.changeMyPassword(currentPassword.value, myNewPassword.value)
    currentPassword.value = ''
    myNewPassword.value = ''
    myPasswordMsg.value = t('settings.passwordChanged')
  } catch (err) {
    myPasswordMsg.value = err instanceof ApiError ? err.message : t('common.error')
  }
}

async function loadSessions() {
  sessionError.value = null
  try {
    sessions.value = (await sessionsApi.listSessions()).sessions
  } catch (err) {
    sessionError.value = err instanceof ApiError ? err.message : t('common.error')
  }
}

async function revokeSession(session: AppSession) {
  sessionError.value = null
  try {
    await sessionsApi.revokeSession(session.id)
    if (session.current) {
      window.location.reload()
      return
    }
    await loadSessions()
  } catch (err) {
    sessionError.value = err instanceof ApiError ? err.message : t('common.error')
  }
}

async function revokeOthers() {
  sessionError.value = null
  try {
    await sessionsApi.revokeOtherSessions()
    await loadSessions()
  } catch (err) {
    sessionError.value = err instanceof ApiError ? err.message : t('common.error')
  }
}

async function load() {
  error.value = null
  try {
    await app.loadPublicConfig()
  } catch {
    /* paths are optional if session is odd */
  }
  void loadUsers()
  void loadSessions()
  void loadMoveHistory()
  void loadWebhooks()
  void loadAppSettings()
  try {
    maxDownloads.value = (await jd.getMaxSimultDownloads()) ?? 3
    maxChunks.value = (await jd.getMaxChunks()) ?? 1
    maxPerHost.value = (await jd.getMaxPerHost()) ?? 1
    passwords.value = (await jd.getPasswordList()) ?? []
  } catch (err) {
    error.value = formatErr(err)
  }
}

onMounted(() => void load())

function savePoll() {
  app.setPollInterval(poll.value)
  downloads.restartPolling()
}

async function saveLimit(kind: 'downloads' | 'chunks' | 'host', value: number) {
  const n = Math.max(1, Math.min(20, Math.round(value)))
  if (kind === 'downloads') {
    maxDownloads.value = n
    await jd.setMaxSimultDownloads(n)
  } else if (kind === 'chunks') {
    maxChunks.value = n
    await jd.setMaxChunks(n)
  } else {
    maxPerHost.value = n
    await jd.setMaxPerHost(n)
  }
}

async function addPassword() {
  const value = newPassword.value.trim()
  if (!value) return
  const next = [...passwords.value, value]
  await jd.setPasswordList(next)
  passwords.value = next
  newPassword.value = ''
}

async function removePassword(value: string) {
  const next = passwords.value.filter((p) => p !== value)
  await jd.setPasswordList(next)
  passwords.value = next
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('settings.title') }}</h1>
      <p class="text-sm text-muted leading-relaxed">{{ t('settings.subtitle') }}</p>
      <p v-if="error" class="text-sm text-danger-text">{{ error }}</p>
    </header>

    <div class="flex flex-col lg:flex-row gap-4 lg:gap-6">
      <nav
        class="lg:w-52 shrink-0 flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0 -mx-1 px-1"
        :aria-label="t('settings.title')"
      >
        <button
          v-for="item in nav"
          :key="item.id"
          type="button"
          class="inline-flex items-center gap-2 whitespace-nowrap text-left px-3 py-2 rounded-[10px] text-sm transition-colors"
          :class="
            section === item.id
              ? 'bg-surface-3 text-foreground font-medium'
              : 'text-muted hover:bg-surface-2 hover:text-foreground'
          "
          @click="section = item.id"
        >
          <component :is="item.icon" class="size-3.5 shrink-0 opacity-80" aria-hidden="true" />
          {{ item.label }}
        </button>
      </nav>

      <div class="min-w-0 flex-1 space-y-4">
        <!-- Connection / library -->
        <template v-if="section === 'connection'">
          <section class="jd-panel rounded-[16px] p-4 space-y-4">
            <div class="flex flex-wrap items-start gap-2">
              <div class="mr-auto space-y-0.5">
                <h2 class="text-sm font-semibold">{{ t('settings.appSettings') }}</h2>
                <p class="text-xs text-muted">{{ t('settings.appSettingsHint') }}</p>
              </div>
              <span
                class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-[10px] bg-surface-2"
                :class="moverEnabled ? 'text-accent-text' : 'text-muted'"
              >
                <span
                  class="size-1.5 rounded-full"
                  :class="moverEnabled ? 'bg-state-seed' : 'bg-state-stopped'"
                />
                {{ moverEnabled ? t('settings.moverOn') : t('settings.moverOff') }}
              </span>
            </div>

            <p v-if="settingsError" class="text-xs text-danger-text">{{ settingsError }}</p>
            <p v-if="settingsMsg" class="text-xs text-accent-text">{{ settingsMsg }}</p>

            <label class="block space-y-1.5">
              <span class="text-xs font-medium text-muted">{{ t('settings.basePath') }}</span>
              <input
                v-model="settingsForm.basePath"
                class="w-full bg-input border border-border rounded-[10px] px-3 py-2 text-sm font-mono disabled:opacity-60"
                :placeholder="t('settings.basePathPlaceholder')"
                :disabled="basePathForcedByEnv"
              />
              <span class="block text-xs text-muted">
                {{ basePathForcedByEnv ? t('settings.basePathForced') : t('settings.basePathHint') }}
              </span>
            </label>

            <label class="block space-y-1.5">
              <span class="text-xs font-medium text-muted">{{ t('settings.jdApiUrl') }}</span>
              <div class="flex gap-2">
                <input
                  v-model="settingsForm.jdApiUrl"
                  class="flex-1 min-w-0 bg-input border border-border rounded-[10px] px-3 py-2 text-sm font-mono"
                />
                <button
                  type="button"
                  class="shrink-0 px-3 py-2 rounded-[10px] border border-border text-sm disabled:opacity-50"
                  :disabled="settingsBusy"
                  @click="detectJd"
                >
                  {{ t('settings.detectJd') }}
                </button>
              </div>
            </label>

            <div class="grid sm:grid-cols-2 gap-3">
              <label class="block space-y-1.5 sm:col-span-2">
                <span class="text-xs font-medium text-muted">{{ t('settings.staging') }}</span>
                <input
                  v-model="settingsForm.stagingDir"
                  class="w-full bg-input border border-border rounded-[10px] px-3 py-2 text-sm font-mono"
                />
              </label>
              <label class="block space-y-1.5">
                <span class="text-xs font-medium text-muted">{{ t('settings.movies') }}</span>
                <input
                  v-model="settingsForm.moviesDir"
                  class="w-full bg-input border border-border rounded-[10px] px-3 py-2 text-sm font-mono"
                />
              </label>
              <label class="block space-y-1.5">
                <span class="text-xs font-medium text-muted">{{ t('settings.shows') }}</span>
                <input
                  v-model="settingsForm.showsDir"
                  class="w-full bg-input border border-border rounded-[10px] px-3 py-2 text-sm font-mono"
                />
              </label>
              <label class="block space-y-1.5 sm:col-span-2">
                <span class="text-xs font-medium text-muted">{{ t('settings.other') }}</span>
                <input
                  v-model="settingsForm.otherDir"
                  class="w-full bg-input border border-border rounded-[10px] px-3 py-2 text-sm font-mono"
                />
              </label>
            </div>

            <label class="flex flex-wrap items-center justify-between gap-3">
              <span class="text-sm">
                {{ t('settings.moverInterval') }}
                <span class="block text-xs text-muted font-normal mt-0.5">{{ t('settings.moverIntervalHint') }}</span>
              </span>
              <input
                v-model.number="settingsForm.moverIntervalMs"
                type="number"
                min="0"
                step="1000"
                class="w-28 bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm tabular-nums"
              />
            </label>

            <div class="flex flex-wrap gap-2 pt-1 border-t border-border">
              <button
                type="button"
                class="px-3 py-2 rounded-[10px] bg-primary text-primary-fg text-sm disabled:opacity-50"
                :disabled="settingsBusy"
                @click="saveAppSettings"
              >
                {{ t('settings.saveAppSettings') }}
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-[10px] border border-border text-sm disabled:opacity-50"
                :disabled="moverBusy"
                @click="runMover"
              >
                {{ t('settings.runMover') }}
              </button>
            </div>
          </section>

          <section class="jd-panel rounded-[16px] p-4 space-y-3">
            <h2 class="text-sm font-semibold">{{ t('settings.moveHistory') }}</h2>
            <p v-if="moveEvents.length === 0" class="text-xs text-muted">{{ t('settings.moveHistoryEmpty') }}</p>
            <ul v-else class="divide-y divide-border -mx-1">
              <li
                v-for="ev in moveEvents"
                :key="ev.id"
                class="px-1 py-2.5 space-y-1 text-xs first:pt-0 last:pb-0"
              >
                <div class="flex justify-between gap-2">
                  <span class="font-medium text-sm text-foreground truncate">{{ ev.packageName }}</span>
                  <span
                    class="shrink-0"
                    :class="ev.status === 'succeeded' ? 'text-accent-text' : 'text-danger-text'"
                  >
                    {{ ev.status === 'succeeded' ? t('settings.moveSucceeded') : t('settings.moveFailed') }}
                  </span>
                </div>
                <div class="text-muted break-all">{{ ev.fromPath }} → {{ ev.toPath }}</div>
                <div v-if="ev.error" class="text-danger-text break-all">{{ ev.error }}</div>
                <div class="text-muted">{{ formatMoveTime(ev.createdAt) }}</div>
              </li>
            </ul>
          </section>
        </template>

        <!-- Downloads -->
        <template v-else-if="section === 'downloads'">
          <section class="jd-panel rounded-[16px] p-4 space-y-4">
            <h2 class="text-sm font-semibold">{{ t('settings.polling') }}</h2>
            <label class="flex flex-wrap items-center gap-3">
              <input
                v-model.number="poll"
                type="number"
                min="500"
                max="10000"
                step="100"
                class="w-32 bg-input border border-border rounded-[10px] px-3 py-2 text-sm tabular-nums"
                @change="savePoll"
              />
              <span class="text-xs text-muted">{{ t('settings.pollingHint') }}</span>
            </label>
          </section>

          <section class="jd-panel rounded-[16px] p-4 space-y-3">
            <h2 class="text-sm font-semibold">{{ t('settings.limits') }}</h2>
            <div class="grid sm:grid-cols-3 gap-3">
              <label class="rounded-[10px] bg-surface-2 px-3 py-2.5 space-y-1.5">
                <span class="block text-xs text-muted">{{ t('settings.maxDownloads') }}</span>
                <input
                  v-model.number="maxDownloads"
                  type="number"
                  min="1"
                  max="20"
                  class="w-full bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm tabular-nums"
                  @change="saveLimit('downloads', maxDownloads)"
                />
              </label>
              <label class="rounded-[10px] bg-surface-2 px-3 py-2.5 space-y-1.5">
                <span class="block text-xs text-muted">{{ t('settings.maxChunks') }}</span>
                <input
                  v-model.number="maxChunks"
                  type="number"
                  min="1"
                  max="20"
                  class="w-full bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm tabular-nums"
                  @change="saveLimit('chunks', maxChunks)"
                />
              </label>
              <label class="rounded-[10px] bg-surface-2 px-3 py-2.5 space-y-1.5">
                <span class="block text-xs text-muted">{{ t('settings.maxPerHost') }}</span>
                <input
                  v-model.number="maxPerHost"
                  type="number"
                  min="1"
                  max="20"
                  class="w-full bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm tabular-nums"
                  @change="saveLimit('host', maxPerHost)"
                />
              </label>
            </div>
          </section>

          <section class="jd-panel rounded-[16px] p-4 space-y-3">
            <h2 class="text-sm font-semibold">{{ t('settings.passwords') }}</h2>
            <ul v-if="passwords.length" class="space-y-1.5">
              <li
                v-for="pwd in passwords"
                :key="pwd"
                class="flex items-center justify-between gap-2 text-sm bg-surface-2 rounded-[10px] px-3 py-2"
              >
                <span class="font-mono truncate">{{ pwd }}</span>
                <button type="button" class="text-danger-text text-xs shrink-0" @click="removePassword(pwd)">
                  {{ t('common.remove') }}
                </button>
              </li>
            </ul>
            <p v-else class="text-xs text-muted">{{ t('settings.passwordsEmpty') }}</p>
            <div class="flex gap-2">
              <input
                v-model="newPassword"
                class="flex-1 min-w-0 bg-input border border-border rounded-[10px] px-3 py-2 text-sm"
                :placeholder="t('settings.newPassword')"
                @keydown.enter="addPassword"
              />
              <button
                type="button"
                class="px-3 py-2 rounded-[10px] bg-primary text-primary-fg text-sm shrink-0"
                @click="addPassword"
              >
                {{ t('common.add') }}
              </button>
            </div>
          </section>
        </template>

        <!-- Account -->
        <template v-else-if="section === 'account'">
          <section class="jd-panel rounded-[16px] p-4 space-y-3">
            <h2 class="text-sm font-semibold">{{ t('settings.myPassword') }}</h2>
            <form class="grid sm:grid-cols-[1fr_1fr_auto] gap-2" @submit.prevent="changeMyPassword">
              <input
                v-model="currentPassword"
                type="password"
                required
                class="bg-input border border-border rounded-[10px] px-3 py-2 text-sm"
                :placeholder="t('settings.currentPassword')"
              />
              <input
                v-model="myNewPassword"
                type="password"
                required
                minlength="8"
                class="bg-input border border-border rounded-[10px] px-3 py-2 text-sm"
                :placeholder="t('settings.userPassword')"
              />
              <button type="submit" class="px-3 py-2 rounded-[10px] bg-primary text-primary-fg text-sm">
                {{ t('settings.changePassword') }}
              </button>
            </form>
            <p v-if="myPasswordMsg" class="text-xs text-muted">{{ myPasswordMsg }}</p>
          </section>

          <section class="jd-panel rounded-[16px] p-4 space-y-3">
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-semibold mr-auto">{{ t('settings.sessions') }}</h2>
              <button
                type="button"
                class="text-xs px-2.5 py-1.5 rounded-[10px] border border-border"
                @click="revokeOthers"
              >
                {{ t('settings.revokeOtherSessions') }}
              </button>
            </div>
            <p v-if="sessionError" class="text-xs text-danger-text">{{ sessionError }}</p>
            <ul class="space-y-2">
              <li
                v-for="session in sessions"
                :key="session.id"
                class="flex items-start justify-between gap-3 rounded-[10px] bg-surface-2 px-3 py-2.5"
              >
                <div class="min-w-0 space-y-0.5 text-xs">
                  <div class="text-sm text-foreground">
                    {{ session.ip || '—' }}
                    <span v-if="session.current" class="text-accent-text"> · {{ t('settings.currentSession') }}</span>
                  </div>
                  <div class="text-muted truncate" :title="session.userAgent ?? undefined">
                    {{ session.userAgent || t('settings.unknownAgent') }}
                  </div>
                </div>
                <button
                  type="button"
                  class="text-danger-text text-xs shrink-0"
                  @click="revokeSession(session)"
                >
                  {{ t('settings.revokeSession') }}
                </button>
              </li>
            </ul>
          </section>
        </template>

        <!-- Users -->
        <template v-else-if="section === 'users'">
          <section class="jd-panel rounded-[16px] p-4 space-y-3">
            <h2 class="text-sm font-semibold">{{ t('settings.users') }}</h2>
            <p v-if="userError" class="text-xs text-danger-text">{{ userError }}</p>
            <ul class="space-y-1.5">
              <li
                v-for="user in users"
                :key="user.id"
                class="flex items-center justify-between gap-2 text-sm bg-surface-2 rounded-[10px] px-3 py-2"
              >
                <span>{{ user.username }}</span>
                <button type="button" class="text-danger-text text-xs" @click="removeUser(user)">
                  {{ t('common.remove') }}
                </button>
              </li>
            </ul>
            <form class="grid sm:grid-cols-[1fr_1fr_auto] gap-2 pt-1 border-t border-border" @submit.prevent="addUser">
              <input
                v-model="newUsername"
                required
                class="bg-input border border-border rounded-[10px] px-3 py-2 text-sm"
                :placeholder="t('login.username')"
              />
              <input
                v-model="newUserPassword"
                type="password"
                required
                minlength="8"
                class="bg-input border border-border rounded-[10px] px-3 py-2 text-sm"
                :placeholder="t('settings.userPassword')"
              />
              <button type="submit" class="px-3 py-2 rounded-[10px] bg-primary text-primary-fg text-sm">
                {{ t('settings.addUser') }}
              </button>
            </form>
          </section>
        </template>

        <!-- Notifications -->
        <template v-else-if="section === 'notifications'">
          <section class="jd-panel rounded-[16px] p-4 space-y-3">
            <h2 class="text-sm font-semibold">{{ t('settings.notifications') }}</h2>
            <label class="flex items-center gap-2.5 text-sm rounded-[10px] bg-surface-2 px-3 py-2.5 cursor-pointer">
              <input
                v-model="app.showCompletionToasts"
                type="checkbox"
                class="size-4 accent-[var(--jd-primary)]"
                @change="app.watchCompletionToasts()"
              />
              {{ t('settings.completionToasts') }}
            </label>
          </section>

          <section class="jd-panel rounded-[16px] p-4 space-y-3">
            <div class="space-y-0.5">
              <h2 class="text-sm font-semibold">{{ t('settings.webhooks') }}</h2>
              <p class="text-xs text-muted">{{ t('settings.webhooksHint') }}</p>
            </div>
            <p v-if="webhookError" class="text-xs text-danger-text">{{ webhookError }}</p>
            <ul class="space-y-2">
              <li
                v-for="hook in webhooks"
                :key="hook.id"
                class="flex items-start justify-between gap-3 rounded-[10px] bg-surface-2 px-3 py-2.5"
              >
                <div class="min-w-0 space-y-0.5">
                  <div class="font-mono text-xs truncate">{{ hook.url }}</div>
                  <div class="text-xs text-muted">{{ hook.events.join(', ') }}</div>
                </div>
                <div class="flex shrink-0 gap-2">
                  <button type="button" class="text-xs" @click="toggleWebhook(hook)">
                    {{ hook.enabled ? t('settings.webhookDisable') : t('settings.webhookEnable') }}
                  </button>
                  <button type="button" class="text-danger-text text-xs" @click="removeWebhook(hook)">
                    {{ t('common.remove') }}
                  </button>
                </div>
              </li>
            </ul>
            <div class="flex gap-2">
              <input
                v-model="newWebhookUrl"
                class="flex-1 min-w-0 bg-input border border-border rounded-[10px] px-3 py-2 text-sm"
                :placeholder="t('settings.webhookUrl')"
                @keydown.enter="addWebhook"
              />
              <button
                type="button"
                class="px-3 py-2 rounded-[10px] bg-primary text-primary-fg text-sm shrink-0"
                @click="addWebhook"
              >
                {{ t('common.add') }}
              </button>
            </div>
          </section>
        </template>

        <!-- Appearance -->
        <template v-else>
          <section class="jd-panel rounded-[16px] p-4 space-y-3">
            <h2 class="text-sm font-semibold">{{ t('settings.appearance') }}</h2>
            <div class="grid sm:grid-cols-2 gap-3">
              <label class="block space-y-1.5">
                <span class="text-xs font-medium text-muted">{{ t('lang.label') }}</span>
                <select
                  class="w-full bg-input border border-border rounded-[10px] px-3 py-2 text-sm"
                  :value="locale"
                  @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'fr')"
                >
                  <option value="en">{{ t('lang.en') }}</option>
                  <option value="fr">{{ t('lang.fr') }}</option>
                </select>
              </label>
              <div class="space-y-1.5">
                <span class="block text-xs font-medium text-muted">{{ t('theme.toggle') }}</span>
                <button
                  type="button"
                  class="w-full bg-input border border-border rounded-[10px] px-3 py-2 text-sm text-left"
                  @click="app.flipTheme()"
                >
                  {{ app.theme === 'dark' ? t('theme.light') : t('theme.dark') }}
                </button>
              </div>
            </div>
          </section>
        </template>
      </div>
    </div>
  </div>
</template>
