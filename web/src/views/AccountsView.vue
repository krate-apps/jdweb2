<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Account } from '@/api/jd'
import * as jd from '@/api/jd'
import { formatSize } from '@/lib/format'

const { t } = useI18n()
const accounts = ref<Account[]>([])
const showForm = ref(false)
const hoster = ref('')
const username = ref('')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

async function refresh() {
  accounts.value = (await jd.listAccounts()) ?? []
}

onMounted(() => void refresh())

async function add() {
  error.value = null
  busy.value = true
  try {
    await jd.addAccount(hoster.value.trim(), username.value.trim(), password.value)
    hoster.value = ''
    username.value = ''
    password.value = ''
    showForm.value = false
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('common.error')
  } finally {
    busy.value = false
  }
}

async function toggle(account: Account) {
  if (account.enabled) await jd.disableAccounts([account.uuid])
  else await jd.enableAccounts([account.uuid])
  await refresh()
}

async function remove(account: Account) {
  if (!confirm(t('accounts.removeConfirm'))) return
  await jd.removeAccounts([account.uuid])
  await refresh()
}

async function refreshAll() {
  const ids = accounts.value.map((a) => a.uuid)
  if (ids.length) await jd.refreshAccounts(ids)
  await refresh()
}
</script>

<template>
  <div class="p-3 space-y-4 max-w-4xl">
    <div class="flex flex-wrap gap-2 items-center">
      <h1 class="text-lg font-semibold mr-auto">{{ t('accounts.title') }}</h1>
      <button type="button" class="px-2 py-1 text-sm rounded-[10px] border border-border" @click="refreshAll">
        {{ t('accounts.refresh') }}
      </button>
      <button type="button" class="px-2 py-1 text-sm rounded-[10px] bg-primary text-primary-fg" @click="showForm = !showForm">
        {{ t('accounts.add') }}
      </button>
    </div>

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
        <tr v-for="account in accounts" :key="account.uuid" class="border-b border-border/50">
          <td class="py-1.5">{{ account.hostname }}</td>
          <td class="py-1.5 truncate max-w-[160px]">{{ account.username }}</td>
          <td class="py-1.5 text-muted">
            {{ account.status || (account.valid ? 'OK' : '—') }}
            <span v-if="account.errorString" class="text-danger-text" :title="account.errorString"> (!)</span>
          </td>
          <td class="py-1.5 hidden sm:table-cell">
            {{ account.trafficLeft != null ? formatSize(account.trafficLeft) : '—' }}
          </td>
          <td class="py-1.5">
            <input type="checkbox" :checked="account.enabled" @change="toggle(account)" />
          </td>
          <td class="py-1.5 text-right">
            <button type="button" class="text-danger-text text-xs" @click="remove(account)">{{ t('common.remove') }}</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="text-sm text-muted text-center py-8">{{ t('accounts.empty') }}</p>
  </div>
</template>
