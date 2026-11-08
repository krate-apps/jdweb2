<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { setLocale } from '@/i18n'
import { ApiError } from '@/api/http'

const { t, locale } = useI18n()
const auth = useAuthStore()
const app = useAppStore()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  error.value = null
  busy.value = true
  try {
    await auth.login(username.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/downloads'
    await router.replace(redirect)
  } catch (err) {
    error.value = err instanceof ApiError ? t('login.error') : t('common.error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-background">
    <form
      class="w-full max-w-sm rounded-[14px] border border-border bg-surface p-6 space-y-4 shadow-lg"
      @submit.prevent="submit"
    >
      <div class="space-y-1">
        <h1 class="text-xl font-semibold text-accent-text">{{ t('app.name') }}</h1>
        <p class="text-sm text-muted">{{ t('login.title') }}</p>
      </div>

      <div>
        <label class="block text-xs font-medium text-muted mb-1">{{ t('login.username') }}</label>
        <input
          v-model="username"
          autocomplete="username"
          class="w-full bg-input border border-border rounded-[10px] px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-muted mb-1">{{ t('login.password') }}</label>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          class="w-full bg-input border border-border rounded-[10px] px-3 py-2 text-sm"
          required
        />
      </div>

      <p v-if="error" class="text-sm text-danger-text">{{ error }}</p>

      <button
        type="submit"
        class="w-full rounded-[10px] bg-primary text-primary-fg py-2 text-sm font-medium disabled:opacity-50"
        :disabled="busy"
      >
        {{ t('login.submit') }}
      </button>

      <div class="flex gap-2 text-xs pt-2 border-t border-border">
        <select
          class="flex-1 bg-input border border-border rounded-[10px] px-2 py-1"
          :value="locale"
          @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'fr')"
        >
          <option value="en">{{ t('lang.en') }}</option>
          <option value="fr">{{ t('lang.fr') }}</option>
        </select>
        <button
          type="button"
          class="flex-1 bg-input border border-border rounded-[10px] px-2 py-1"
          @click="app.flipTheme()"
        >
          {{ app.theme === 'dark' ? t('theme.light') : t('theme.dark') }}
        </button>
      </div>
    </form>
  </div>
</template>
