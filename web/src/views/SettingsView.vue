<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useDownloadsStore } from '@/stores/downloads'
import * as jd from '@/api/jd'
import * as usersApi from '@/api/users'
import type { AppUser } from '@/api/users'
import * as sessionsApi from '@/api/sessions'
import type { AppSession } from '@/api/sessions'
import { setLocale } from '@/i18n'
import { ApiError, apiJson } from '@/api/http'

const { t, locale } = useI18n()
const app = useAppStore()
const downloads = useDownloadsStore()

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
const error = ref<string | null>(null)

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
  <div class="p-4 max-w-lg space-y-6">
    <h1 class="text-lg font-semibold">{{ t('settings.title') }}</h1>
    <p v-if="error" class="text-sm text-danger-text">{{ error }}</p>

    <section class="space-y-2">
      <h2 class="text-sm font-semibold text-muted">{{ t('settings.myPassword') }}</h2>
      <form class="grid sm:grid-cols-3 gap-2" @submit.prevent="changeMyPassword">
        <input
          v-model="currentPassword"
          type="password"
          required
          class="bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm"
          :placeholder="t('settings.currentPassword')"
        />
        <input
          v-model="myNewPassword"
          type="password"
          required
          minlength="8"
          class="bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm"
          :placeholder="t('settings.userPassword')"
        />
        <button type="submit" class="px-3 py-1.5 rounded-[10px] bg-primary text-primary-fg text-sm">
          {{ t('settings.changePassword') }}
        </button>
      </form>
      <p v-if="myPasswordMsg" class="text-xs text-muted">{{ myPasswordMsg }}</p>
    </section>

    <section class="space-y-2">
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-semibold text-muted mr-auto">{{ t('settings.sessions') }}</h2>
        <button type="button" class="text-xs px-2 py-1 rounded-[10px] border border-border" @click="revokeOthers">
          {{ t('settings.revokeOtherSessions') }}
        </button>
      </div>
      <p v-if="sessionError" class="text-xs text-danger-text">{{ sessionError }}</p>
      <ul class="space-y-1 text-xs">
        <li
          v-for="session in sessions"
          :key="session.id"
          class="flex items-start justify-between gap-2 bg-surface-2 rounded-[10px] px-2 py-1.5"
        >
          <div class="min-w-0">
            <div class="text-foreground">
              {{ session.ip || '—' }}
              <span v-if="session.current" class="text-accent-text"> · {{ t('settings.currentSession') }}</span>
            </div>
            <div class="text-muted truncate" :title="session.userAgent ?? undefined">
              {{ session.userAgent || t('settings.unknownAgent') }}
            </div>
          </div>
          <button type="button" class="text-danger-text shrink-0" @click="revokeSession(session)">
            {{ t('settings.revokeSession') }}
          </button>
        </li>
      </ul>
    </section>

    <section class="space-y-2">
      <h2 class="text-sm font-semibold text-muted">{{ t('settings.users') }}</h2>
      <p v-if="userError" class="text-xs text-danger-text">{{ userError }}</p>
      <ul class="space-y-1">
        <li
          v-for="user in users"
          :key="user.id"
          class="flex items-center justify-between gap-2 text-sm bg-surface-2 rounded-[10px] px-2 py-1"
        >
          <span>{{ user.username }}</span>
          <button type="button" class="text-danger-text text-xs" @click="removeUser(user)">
            {{ t('common.remove') }}
          </button>
        </li>
      </ul>
      <form class="grid sm:grid-cols-3 gap-2" @submit.prevent="addUser">
        <input
          v-model="newUsername"
          required
          class="bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm"
          :placeholder="t('login.username')"
        />
        <input
          v-model="newUserPassword"
          type="password"
          required
          minlength="8"
          class="bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm"
          :placeholder="t('settings.userPassword')"
        />
        <button type="submit" class="px-3 py-1.5 rounded-[10px] bg-primary text-primary-fg text-sm">
          {{ t('settings.addUser') }}
        </button>
      </form>
    </section>

    <section class="space-y-2">
      <h2 class="text-sm font-semibold text-muted">{{ t('settings.notifications') }}</h2>
      <label class="flex items-center gap-2 text-sm">
        <input
          v-model="app.showCompletionToasts"
          type="checkbox"
          @change="app.watchCompletionToasts()"
        />
        {{ t('settings.completionToasts') }}
      </label>
    </section>

    <section class="space-y-2">
      <h2 class="text-sm font-semibold text-muted">{{ t('settings.appearance') }}</h2>
      <div class="flex gap-2">
        <select
          class="flex-1 bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm"
          :value="locale"
          @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'fr')"
        >
          <option value="en">{{ t('lang.en') }}</option>
          <option value="fr">{{ t('lang.fr') }}</option>
        </select>
        <button type="button" class="flex-1 bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm" @click="app.flipTheme()">
          {{ app.theme === 'dark' ? t('theme.light') : t('theme.dark') }}
        </button>
      </div>
    </section>

    <section class="space-y-2">
      <h2 class="text-sm font-semibold text-muted">{{ t('settings.polling') }}</h2>
      <div class="flex items-center gap-2">
        <input
          v-model.number="poll"
          type="number"
          min="500"
          max="10000"
          step="100"
          class="w-32 bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm"
          @change="savePoll"
        />
        <span class="text-xs text-muted">{{ t('settings.pollingHint') }}</span>
      </div>
    </section>

    <section class="space-y-2">
      <h2 class="text-sm font-semibold text-muted">{{ t('settings.limits') }}</h2>
      <label class="flex items-center justify-between gap-3 text-sm">
        <span>{{ t('settings.maxDownloads') }}</span>
        <input
          v-model.number="maxDownloads"
          type="number"
          min="1"
          max="20"
          class="w-20 bg-input border border-border rounded-[10px] px-2 py-1 text-sm"
          @change="saveLimit('downloads', maxDownloads)"
        />
      </label>
      <label class="flex items-center justify-between gap-3 text-sm">
        <span>{{ t('settings.maxChunks') }}</span>
        <input
          v-model.number="maxChunks"
          type="number"
          min="1"
          max="20"
          class="w-20 bg-input border border-border rounded-[10px] px-2 py-1 text-sm"
          @change="saveLimit('chunks', maxChunks)"
        />
      </label>
      <label class="flex items-center justify-between gap-3 text-sm">
        <span>{{ t('settings.maxPerHost') }}</span>
        <input
          v-model.number="maxPerHost"
          type="number"
          min="1"
          max="20"
          class="w-20 bg-input border border-border rounded-[10px] px-2 py-1 text-sm"
          @change="saveLimit('host', maxPerHost)"
        />
      </label>
    </section>

    <section class="space-y-2">
      <h2 class="text-sm font-semibold text-muted">{{ t('settings.passwords') }}</h2>
      <ul class="space-y-1">
        <li
          v-for="pwd in passwords"
          :key="pwd"
          class="flex items-center justify-between gap-2 text-sm bg-surface-2 rounded-[10px] px-2 py-1"
        >
          <span class="font-mono truncate">{{ pwd }}</span>
          <button type="button" class="text-danger-text text-xs" @click="removePassword(pwd)">{{ t('common.remove') }}</button>
        </li>
      </ul>
      <div class="flex gap-2">
        <input
          v-model="newPassword"
          class="flex-1 bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm"
          :placeholder="t('settings.newPassword')"
          @keydown.enter="addPassword"
        />
        <button type="button" class="px-3 py-1.5 rounded-[10px] bg-primary text-primary-fg text-sm" @click="addPassword">
          {{ t('common.add') }}
        </button>
      </div>
    </section>

    <section v-if="app.publicConfig" class="space-y-2">
      <h2 class="text-sm font-semibold text-muted">{{ t('settings.paths') }}</h2>
      <dl class="text-xs space-y-1 text-muted">
        <div><dt class="inline font-medium text-foreground">{{ t('settings.staging') }}:</dt> {{ app.publicConfig.stagingDir }}</div>
        <div><dt class="inline font-medium text-foreground">{{ t('settings.movies') }}:</dt> {{ app.publicConfig.moviesDir }}</div>
        <div><dt class="inline font-medium text-foreground">{{ t('settings.shows') }}:</dt> {{ app.publicConfig.showsDir }}</div>
        <div><dt class="inline font-medium text-foreground">{{ t('settings.other') }}:</dt> {{ app.publicConfig.otherDir }}</div>
      </dl>
      <p class="text-xs text-accent-text">
        {{ app.publicConfig.moverEnabled ? t('settings.moverOn') : t('settings.moverOff') }}
      </p>
      <button
        type="button"
        class="px-3 py-1.5 rounded-[10px] border border-border text-sm disabled:opacity-50"
        :disabled="moverBusy"
        @click="runMover"
      >
        {{ t('settings.runMover') }}
      </button>
    </section>

    <section class="space-y-2">
      <h2 class="text-sm font-semibold text-muted">{{ t('settings.moveHistory') }}</h2>
      <p v-if="moveEvents.length === 0" class="text-xs text-muted">{{ t('settings.moveHistoryEmpty') }}</p>
      <ul v-else class="space-y-2 text-xs">
        <li
          v-for="ev in moveEvents"
          :key="ev.id"
          class="rounded-[10px] bg-surface-2 px-2 py-1.5 space-y-0.5"
        >
          <div class="flex justify-between gap-2">
            <span class="font-medium text-foreground truncate">{{ ev.packageName }}</span>
            <span :class="ev.status === 'succeeded' ? 'text-accent-text' : 'text-danger-text'">
              {{ ev.status === 'succeeded' ? t('settings.moveSucceeded') : t('settings.moveFailed') }}
            </span>
          </div>
          <div class="text-muted truncate">{{ ev.fromPath }} → {{ ev.toPath }}</div>
          <div v-if="ev.error" class="text-danger-text truncate">{{ ev.error }}</div>
          <div class="text-muted">{{ formatMoveTime(ev.createdAt) }}</div>
        </li>
      </ul>
    </section>
  </div>
</template>
