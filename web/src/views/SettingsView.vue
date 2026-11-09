<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useDownloadsStore } from '@/stores/downloads'
import * as jd from '@/api/jd'
import { setLocale } from '@/i18n'

const { t, locale } = useI18n()
const app = useAppStore()
const downloads = useDownloadsStore()

const poll = ref(app.pollInterval)
const maxDownloads = ref(3)
const maxChunks = ref(1)
const maxPerHost = ref(1)
const passwords = ref<string[]>([])
const newPassword = ref('')
const error = ref<string | null>(null)

function formatErr(err: unknown): string {
  const message = err instanceof Error ? err.message : ''
  if (message === 'jdownloader_unreachable' || /fetch failed|unreachable/i.test(message)) {
    return t('common.jdOffline')
  }
  return message || t('common.error')
}

async function load() {
  error.value = null
  try {
    await app.loadPublicConfig()
  } catch {
    /* paths are optional if session is odd */
  }
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
    </section>
  </div>
</template>
