<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGrabberStore } from '@/stores/grabber'
import { useAppStore } from '@/stores/app'
import { useDownloadsStore } from '@/stores/downloads'
import { formatSize } from '@/lib/format'

const { t } = useI18n()
const grabber = useGrabberStore()
const app = useAppStore()
const downloads = useDownloadsStore()

onMounted(() => void grabber.refresh())

async function confirmAll() {
  await grabber.confirmAll()
  await downloads.refresh()
}

async function confirmSelected() {
  await grabber.confirmSelected()
  await downloads.refresh()
}
</script>

<template>
  <div class="p-3 space-y-3">
    <div class="flex flex-wrap gap-2 items-center">
      <h1 class="text-lg font-semibold mr-auto">{{ t('grabber.title') }}</h1>
      <button type="button" class="px-2 py-1 text-sm rounded-[10px] bg-primary text-primary-fg" @click="confirmAll">
        {{ t('grabber.confirmAll') }}
      </button>
      <button
        type="button"
        class="px-2 py-1 text-sm rounded-[10px] border border-border"
        :disabled="!grabber.selected.size"
        @click="confirmSelected"
      >
        {{ t('grabber.confirmSelected') }}
      </button>
      <button
        type="button"
        class="px-2 py-1 text-sm rounded-[10px] border border-border"
        :disabled="!grabber.selected.size"
        @click="grabber.removeSelected()"
      >
        {{ t('grabber.removeSelected') }}
      </button>
      <button type="button" class="px-2 py-1 text-sm rounded-[10px] bg-accent text-primary-fg" @click="app.showAddLinks = true">
        {{ t('grabber.addLinks') }}
      </button>
    </div>

    <table v-if="grabber.links.length" class="w-full text-sm">
      <thead>
        <tr class="text-left text-xs text-muted border-b border-border">
          <th class="w-8 py-1" />
          <th class="py-1">{{ t('downloads.name') }}</th>
          <th class="py-1 text-right hidden md:table-cell">{{ t('downloads.size') }}</th>
          <th class="py-1 hidden md:table-cell">{{ t('downloads.hoster') }}</th>
          <th class="py-1">{{ t('downloads.status') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="link in grabber.links" :key="link.uuid" class="border-b border-border/50 hover:bg-surface-2/50">
          <td class="py-1.5">
            <input
              type="checkbox"
              :checked="grabber.selected.has(link.uuid)"
              @change="grabber.toggleSelect(link.uuid)"
            />
          </td>
          <td class="py-1.5 truncate max-w-[320px]" :title="link.name">{{ link.name }}</td>
          <td class="py-1.5 text-right hidden md:table-cell">{{ formatSize(link.bytesTotal) }}</td>
          <td class="py-1.5 hidden md:table-cell">{{ link.host || '—' }}</td>
          <td class="py-1.5 text-muted">{{ link.availability || '—' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="text-sm text-muted text-center py-10">{{ t('grabber.empty') }}</p>
  </div>
</template>
