<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HosterAccount } from '@/api/hosters'
import * as hostersApi from '@/api/hosters'
import { formatSize } from '@/lib/format'
import { ApiError } from '@/api/http'

const { t } = useI18n()
const accounts = ref<HosterAccount[]>([])
const showForm = ref(false)
const hoster = ref('')
const username = ref('')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

async function refresh() {
  const res = await hostersApi.listHosters()
  accounts.value = res.hosters
}

onMounted(() => void refresh())

async function add() {
  error.value = null
  busy.value = true
  try {
    await hostersApi.createHoster({
      hoster: hoster.value.trim(),
      username: username.value.trim(),
      password: password.value,
    })
    hoster.value = ''
    username.value = ''
    password.value = ''
    showForm.value = false
    await refresh()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : t('common.error')
  } finally {
    busy.value = false
  }
}

async function toggle(account: HosterAccount) {
  await hostersApi.patchHoster(account.id, { enabled: !account.enabled })
  await refresh()
}

async function remove(account: HosterAccount) {
  if (!confirm(t('accounts.removeConfirm'))) return
  await hostersApi.deleteHoster(account.id)
  await refresh()
}

async function refreshAll() {
  const res = await hostersApi.refreshHosters()
  accounts.value = res.hosters
}

async function resync(account: HosterAccount) {
  if (account.needsSecret) {
    error.value = t('accounts.passwordRequired')
    return
  }
  await hostersApi.resyncHoster(account.id)
  await refresh()
}

async function importFromJd() {
  error.value = null
  busy.value = true
  try {
    const res = await hostersApi.importHosters()
    accounts.value = res.hosters
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : t('common.error')
  } finally {
    busy.value = false
  }
}

async function changePassword(account: HosterAccount) {
  error.value = null
  const next = window.prompt(t('accounts.changePasswordPrompt', { name: account.username }))
  if (next == null || !next) return
  busy.value = true
  try {
    await hostersApi.patchHoster(account.id, { password: next })
    await refresh()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : t('common.error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="p-4 md:p-5 space-y-4 max-w-5xl mx-auto">
    <div class="flex flex-wrap gap-2 items-center">
      <h1 class="text-2xl font-semibold tracking-tight mr-auto">{{ t('accounts.title') }}</h1>
      <button type="button" class="jd-btn jd-btn-ghost" :disabled="busy" @click="importFromJd">
        {{ t('accounts.import') }}
      </button>
      <button type="button" class="jd-btn jd-btn-ghost" @click="refreshAll">
        {{ t('accounts.refresh') }}
      </button>
      <button type="button" class="jd-btn jd-btn-primary" @click="showForm = !showForm">
        {{ t('accounts.add') }}
      </button>
    </div>
    <p v-if="error && !showForm" class="text-xs text-danger-text">{{ error }}</p>

    <form v-if="showForm" class="jd-panel rounded-[16px] p-4 space-y-3" @submit.prevent="add">
      <div class="grid sm:grid-cols-3 gap-3">
        <div>
          <label class="text-xs font-medium text-muted mb-1.5 block">{{ t('accounts.hoster') }}</label>
          <input v-model="hoster" required class="jd-field w-full" placeholder="rapidgator.net" />
        </div>
        <div>
          <label class="text-xs font-medium text-muted mb-1.5 block">{{ t('accounts.username') }}</label>
          <input v-model="username" required class="jd-field w-full" />
        </div>
        <div>
          <label class="text-xs font-medium text-muted mb-1.5 block">{{ t('accounts.password') }}</label>
          <input v-model="password" type="password" required class="jd-field w-full" />
        </div>
      </div>
      <p v-if="error" class="text-xs text-danger-text">{{ error }}</p>
      <button type="submit" class="jd-btn jd-btn-primary" :disabled="busy">
        {{ t('common.add') }}
      </button>
    </form>

    <div v-if="accounts.length" class="jd-panel rounded-[16px] overflow-hidden overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-muted border-b border-border bg-surface-2/40">
            <th class="px-3 py-2.5 font-medium">{{ t('accounts.hoster') }}</th>
            <th class="px-3 py-2.5 font-medium">{{ t('accounts.username') }}</th>
            <th class="px-3 py-2.5 font-medium">{{ t('accounts.status') }}</th>
            <th class="px-3 py-2.5 font-medium hidden sm:table-cell">{{ t('accounts.traffic') }}</th>
            <th class="px-3 py-2.5 font-medium">{{ t('accounts.enabled') }}</th>
            <th class="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="account in accounts" :key="account.id" class="border-b border-border/40 hover:bg-surface-2/35 transition-colors">
            <td class="px-3 py-2.5 font-medium">{{ account.hoster }}</td>
            <td class="px-3 py-2.5 truncate max-w-[160px]">{{ account.username }}</td>
            <td class="px-3 py-2.5 text-muted">
              {{ account.status || (account.valid ? 'OK' : '—') }}
              <span v-if="account.errorString" class="text-danger-text" :title="account.errorString"> (!)</span>
              <span v-if="account.needsSecret" class="text-xs text-danger-text"> · {{ t('accounts.passwordRequired') }}</span>
              <span v-else-if="account.jdUuid == null" class="text-xs text-muted"> · {{ t('accounts.notSynced') }}</span>
            </td>
            <td class="px-3 py-2.5 hidden sm:table-cell tabular-nums">
              {{ account.trafficLeft != null ? formatSize(account.trafficLeft) : '—' }}
            </td>
            <td class="px-3 py-2.5">
              <input type="checkbox" :checked="account.enabled" @change="toggle(account)" />
            </td>
            <td class="px-3 py-2.5 text-right whitespace-nowrap space-x-2">
              <button type="button" class="text-accent-text text-xs hover:underline" @click="changePassword(account)">
                {{ t('accounts.changePassword') }}
              </button>
              <button
                type="button"
                class="text-accent-text text-xs hover:underline disabled:opacity-40"
                :disabled="account.needsSecret"
                @click="resync(account)"
              >
                {{ t('accounts.resync') }}
              </button>
              <button type="button" class="text-danger-text text-xs hover:underline" @click="remove(account)">{{ t('common.remove') }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="jd-panel rounded-[16px] text-sm text-muted text-center py-12">{{ t('accounts.empty') }}</p>
  </div>
</template>
