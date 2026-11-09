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
</script>

<template>
  <div class="p-3 space-y-4 max-w-4xl">
    <div class="flex flex-wrap gap-2 items-center">
      <h1 class="text-lg font-semibold mr-auto">{{ t('accounts.title') }}</h1>
      <button type="button" class="px-2 py-1 text-sm rounded-[10px] border border-border" :disabled="busy" @click="importFromJd">
        {{ t('accounts.import') }}
      </button>
      <button type="button" class="px-2 py-1 text-sm rounded-[10px] border border-border" @click="refreshAll">
        {{ t('accounts.refresh') }}
      </button>
      <button type="button" class="px-2 py-1 text-sm rounded-[10px] bg-primary text-primary-fg" @click="showForm = !showForm">
        {{ t('accounts.add') }}
      </button>
    </div>
    <p v-if="error && !showForm" class="text-xs text-danger-text">{{ error }}</p>

    <form v-if="showForm" class="rounded-[14px] border border-border bg-surface p-3 space-y-3" @submit.prevent="add">
      <div class="grid sm:grid-cols-3 gap-2">
        <div>
          <label class="text-xs text-muted">{{ t('accounts.hoster') }}</label>
          <input v-model="hoster" required class="w-full bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm" placeholder="rapidgator.net" />
        </div>
        <div>
          <label class="text-xs text-muted">{{ t('accounts.username') }}</label>
          <input v-model="username" required class="w-full bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="text-xs text-muted">{{ t('accounts.password') }}</label>
          <input v-model="password" type="password" required class="w-full bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm" />
        </div>
      </div>
      <p v-if="error" class="text-xs text-danger-text">{{ error }}</p>
      <button type="submit" class="px-3 py-1.5 text-sm rounded-[10px] bg-primary text-primary-fg" :disabled="busy">
        {{ t('common.add') }}
      </button>
    </form>

    <table v-if="accounts.length" class="w-full text-sm">
      <thead>
        <tr class="text-left text-xs text-muted border-b border-border">
          <th class="py-1">{{ t('accounts.hoster') }}</th>
          <th class="py-1">{{ t('accounts.username') }}</th>
          <th class="py-1">{{ t('accounts.status') }}</th>
          <th class="py-1 hidden sm:table-cell">{{ t('accounts.traffic') }}</th>
          <th class="py-1">{{ t('accounts.enabled') }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="account in accounts" :key="account.id" class="border-b border-border/50">
          <td class="py-1.5">{{ account.hoster }}</td>
          <td class="py-1.5 truncate max-w-[160px]">{{ account.username }}</td>
          <td class="py-1.5 text-muted">
            {{ account.status || (account.valid ? 'OK' : '—') }}
            <span v-if="account.errorString" class="text-danger-text" :title="account.errorString"> (!)</span>
            <span v-if="account.needsSecret" class="text-xs text-danger-text"> · {{ t('accounts.passwordRequired') }}</span>
            <span v-else-if="account.jdUuid == null" class="text-xs text-muted"> · {{ t('accounts.notSynced') }}</span>
          </td>
          <td class="py-1.5 hidden sm:table-cell">
            {{ account.trafficLeft != null ? formatSize(account.trafficLeft) : '—' }}
          </td>
          <td class="py-1.5">
            <input type="checkbox" :checked="account.enabled" @change="toggle(account)" />
          </td>
          <td class="py-1.5 text-right space-x-2">
            <button type="button" class="text-accent-text text-xs" @click="resync(account)">{{ t('accounts.resync') }}</button>
            <button type="button" class="text-danger-text text-xs" @click="remove(account)">{{ t('common.remove') }}</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="text-sm text-muted text-center py-8">{{ t('accounts.empty') }}</p>
  </div>
</template>
