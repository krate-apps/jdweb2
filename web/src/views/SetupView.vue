<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { setLocale } from '@/i18n'
import { setupAdmin } from '@/api/setup'
import { ApiError } from '@/api/http'
import { markSetupDone } from '@/router'
import BrandMark from '@/components/ui/BrandMark.vue'
import * as settingsApi from '@/api/settings'

const { t, locale } = useI18n()
const auth = useAuthStore()
const app = useAppStore()
const router = useRouter()

const step = ref<1 | 2 | 3>(1)
const username = ref('')
const password = ref('')
const jdApiUrl = ref('http://127.0.0.1:3128')
const stagingDir = ref('')
const moviesDir = ref('')
const showsDir = ref('')
const otherDir = ref('')
const error = ref<string | null>(null)
const info = ref<string | null>(null)
const busy = ref(false)

async function loadDefaults() {
  try {
    const { settings: s } = await settingsApi.getSettings()
    jdApiUrl.value = s.jdApiUrl
    stagingDir.value = s.stagingDir
    moviesDir.value = s.moviesDir
    showsDir.value = s.showsDir
    otherDir.value = s.otherDir
  } catch {
    /* before login settings may 401 — probe still works on localhost during setup */
  }
}

async function submitAdmin() {
  error.value = null
  busy.value = true
  try {
    const me = await setupAdmin(username.value, password.value)
    auth.username = me.username
    markSetupDone()
    await loadDefaults()
    step.value = 2
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.message === 'setup_localhost_only') error.value = t('setup.localhostOnly')
      else if (err.message === 'setup_already_done') error.value = t('setup.alreadyDone')
      else if (err.message === 'password_too_short') error.value = t('setup.passwordTooShort')
      else if (err.message === 'rate_limited') error.value = t('setup.rateLimited')
      else error.value = t('common.error')
    } else {
      error.value = t('common.error')
    }
  } finally {
    busy.value = false
  }
}

async function detectJd() {
  error.value = null
  info.value = null
  busy.value = true
  try {
    const res = await settingsApi.probeJd()
    if ('candidates' in res && res.candidates?.length) {
      jdApiUrl.value = res.candidates[0].url
      info.value = t('settings.jdDetected', { url: res.candidates[0].url })
    } else {
      error.value = t('settings.jdNotFound')
    }
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : t('common.error')
  } finally {
    busy.value = false
  }
}

async function saveJdAndContinue() {
  error.value = null
  busy.value = true
  try {
    await settingsApi.patchSettings({ jdApiUrl: jdApiUrl.value.trim() })
    step.value = 3
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : t('common.error')
  } finally {
    busy.value = false
  }
}

async function savePathsAndFinish() {
  error.value = null
  busy.value = true
  try {
    await settingsApi.patchSettings({
      stagingDir: stagingDir.value.trim(),
      moviesDir: moviesDir.value.trim(),
      showsDir: showsDir.value.trim(),
      otherDir: otherDir.value.trim(),
    })
    await router.replace({ name: 'downloads' })
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : t('common.error')
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  if (auth.username) void loadDefaults()
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 sm:p-8">
    <div class="jd-panel w-full max-w-md rounded-[16px] p-7 sm:p-8 space-y-5">
      <div class="space-y-3">
        <BrandMark :size="32" />
        <div class="space-y-1">
          <h1 class="text-2xl font-semibold tracking-tight">{{ t('setup.title') }}</h1>
          <p class="text-xs text-muted">{{ t('setup.step', { n: step, total: 3 }) }}</p>
        </div>
        <div class="flex gap-1.5">
          <span
            v-for="n in 3"
            :key="n"
            class="h-1 flex-1 rounded-full transition-colors"
            :class="n <= step ? 'bg-primary' : 'bg-surface-3'"
          />
        </div>
      </div>

      <form v-if="step === 1" class="space-y-4" @submit.prevent="submitAdmin">
        <p class="text-sm text-muted leading-relaxed">{{ t('setup.hint') }}</p>
        <div>
          <label class="block text-xs font-medium text-muted mb-1.5">{{ t('login.username') }}</label>
          <input v-model="username" autocomplete="username" class="jd-field" required />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1.5">{{ t('login.password') }}</label>
          <input
            v-model="password"
            type="password"
            autocomplete="new-password"
            minlength="8"
            class="jd-field"
            required
          />
        </div>
        <button type="submit" class="jd-btn jd-btn-primary w-full py-2.5 disabled:opacity-50" :disabled="busy">
          {{ t('setup.submit') }}
        </button>
      </form>

      <div v-else-if="step === 2" class="space-y-4">
        <p class="text-sm text-muted leading-relaxed">{{ t('setup.jdHint') }}</p>
        <label class="block space-y-1.5 text-sm">
          <span class="text-xs font-medium text-muted">{{ t('settings.jdApiUrl') }}</span>
          <input v-model="jdApiUrl" class="jd-field font-mono" />
        </label>
        <div class="flex gap-2">
          <button type="button" class="jd-btn jd-btn-ghost flex-1 disabled:opacity-50" :disabled="busy" @click="detectJd">
            {{ t('settings.detectJd') }}
          </button>
          <button
            type="button"
            class="jd-btn jd-btn-primary flex-1 disabled:opacity-50"
            :disabled="busy"
            @click="saveJdAndContinue"
          >
            {{ t('setup.continue') }}
          </button>
        </div>
      </div>

      <div v-else class="space-y-3">
        <p class="text-sm text-muted leading-relaxed">{{ t('setup.pathsHint') }}</p>
        <label class="block space-y-1.5 text-sm">
          <span class="text-xs font-medium text-muted">{{ t('settings.staging') }}</span>
          <input v-model="stagingDir" class="jd-field font-mono" />
        </label>
        <label class="block space-y-1.5 text-sm">
          <span class="text-xs font-medium text-muted">{{ t('settings.movies') }}</span>
          <input v-model="moviesDir" class="jd-field font-mono" />
        </label>
        <label class="block space-y-1.5 text-sm">
          <span class="text-xs font-medium text-muted">{{ t('settings.shows') }}</span>
          <input v-model="showsDir" class="jd-field font-mono" />
        </label>
        <label class="block space-y-1.5 text-sm">
          <span class="text-xs font-medium text-muted">{{ t('settings.other') }}</span>
          <input v-model="otherDir" class="jd-field font-mono" />
        </label>
        <button
          type="button"
          class="jd-btn jd-btn-primary w-full py-2.5 disabled:opacity-50"
          :disabled="busy"
          @click="savePathsAndFinish"
        >
          {{ t('setup.finish') }}
        </button>
      </div>

      <p v-if="error" class="text-sm text-danger-text">{{ error }}</p>
      <p v-if="info" class="text-sm text-accent-text">{{ info }}</p>

      <div class="flex gap-2 text-xs pt-3 border-t border-border">
        <select
          class="jd-field flex-1 py-2"
          :value="locale"
          @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'fr')"
        >
          <option value="en">{{ t('lang.en') }}</option>
          <option value="fr">{{ t('lang.fr') }}</option>
        </select>
        <button type="button" class="jd-btn jd-btn-ghost flex-1" @click="app.flipTheme()">
          {{ app.theme === 'dark' ? t('theme.light') : t('theme.dark') }}
        </button>
      </div>
    </div>
  </div>
</template>
