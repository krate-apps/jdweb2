<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { LogIn, Moon, Sun } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { setLocale } from '@/i18n'
import { ApiError } from '@/api/http'
import BrandMark from '@/components/ui/BrandMark.vue'

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
  <div class="min-h-screen flex items-center justify-center p-4 sm:p-8">
    <form class="jd-panel w-full max-w-md rounded-[16px] p-7 sm:p-8 space-y-5" @submit.prevent="submit">
      <div class="space-y-3">
        <BrandMark :size="32" />
        <div class="space-y-1">
          <h1 class="text-2xl font-semibold tracking-tight">{{ t('login.title') }}</h1>
          <p class="text-sm text-muted leading-relaxed">{{ t('login.hint') }}</p>
        </div>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-muted mb-1.5">{{ t('login.username') }}</label>
          <input
            v-model="username"
            autocomplete="username"
            class="jd-field"
            required
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1.5">{{ t('login.password') }}</label>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="jd-field"
            required
          />
        </div>
      </div>

      <p v-if="error" class="text-sm text-danger-text">{{ error }}</p>

      <button type="submit" class="jd-btn jd-btn-primary w-full py-2.5 disabled:opacity-50" :disabled="busy">
        <LogIn class="size-4" aria-hidden="true" />
        {{ t('login.submit') }}
      </button>

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
          <Sun v-if="app.theme === 'dark'" class="size-3.5" aria-hidden="true" />
          <Moon v-else class="size-3.5" aria-hidden="true" />
          {{ app.theme === 'dark' ? t('theme.light') : t('theme.dark') }}
        </button>
      </div>
    </form>
  </div>
</template>
