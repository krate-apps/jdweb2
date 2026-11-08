<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useDownloadsStore } from '@/stores/downloads'
import { formatSize, formatSpeed } from '@/lib/format'
import { setLocale } from '@/i18n'
import AddLinksModal from '@/components/modals/AddLinksModal.vue'

const { t, locale } = useI18n()
const auth = useAuthStore()
const app = useAppStore()
const downloads = useDownloadsStore()
const router = useRouter()

onMounted(async () => {
  downloads.startPolling()
  await app.checkConnection()
  try {
    await app.loadPublicConfig()
  } catch {
    /* config optional until authenticated session is warm */
  }
})

onUnmounted(() => downloads.stopPolling())

async function onLogout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background text-foreground">
    <header class="border-b border-border bg-surface px-3 py-2 flex flex-wrap items-center gap-2">
      <div class="font-semibold text-accent-text mr-2">{{ t('app.name') }}</div>
      <nav class="flex flex-wrap gap-1 text-sm">
        <RouterLink
          v-for="item in [
            { name: 'downloads', label: t('nav.downloads') },
            { name: 'grabber', label: t('nav.grabber') },
            { name: 'accounts', label: t('nav.accounts') },
            { name: 'settings', label: t('nav.settings') },
          ]"
          :key="item.name"
          :to="{ name: item.name }"
          class="px-2.5 py-1 rounded-[10px] text-muted hover:bg-surface-2 hover:text-foreground"
          active-class="!bg-surface-3 !text-foreground"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="ml-auto flex items-center gap-2 text-xs">
        <span
          class="inline-flex items-center gap-1.5 px-2 py-1 rounded-[10px] bg-surface-2"
          :title="app.connected ? t('app.connected') : t('app.disconnected')"
        >
          <span
            class="size-2 rounded-full"
            :class="app.connected ? 'bg-state-seed' : 'bg-state-error'"
          />
          {{ app.connected ? t('app.connected') : t('app.disconnected') }}
        </span>
        <select
          class="bg-input border border-border rounded-[10px] px-2 py-1"
          :value="locale"
          @change="setLocale(($event.target as HTMLSelectElement).value as 'en' | 'fr')"
        >
          <option value="en">{{ t('lang.en') }}</option>
          <option value="fr">{{ t('lang.fr') }}</option>
        </select>
        <button
          type="button"
          class="bg-input border border-border rounded-[10px] px-2 py-1"
          @click="app.flipTheme()"
        >
          {{ app.theme === 'dark' ? t('theme.light') : t('theme.dark') }}
        </button>
        <button
          type="button"
          class="bg-surface-2 border border-border rounded-[10px] px-2 py-1"
          @click="onLogout"
        >
          {{ t('nav.logout') }}
        </button>
      </div>
    </header>

    <div class="border-b border-border bg-surface-2 px-3 py-1.5 flex flex-wrap gap-2 items-center text-sm">
      <button
        type="button"
        class="px-2 py-1 rounded-[10px] bg-primary text-primary-fg"
        :title="downloads.engineStopped ? t('downloads.startEngine') : t('downloads.stopEngine')"
        @click="downloads.engineStopped ? downloads.startEngine() : downloads.stopEngine()"
      >
        {{ downloads.engineStopped ? '▶' : '■' }}
      </button>
      <button type="button" class="px-2 py-1 rounded-[10px] bg-surface border border-border" @click="downloads.pauseAll()">
        {{ t('downloads.pauseAll') }}
      </button>
      <button type="button" class="px-2 py-1 rounded-[10px] bg-surface border border-border" @click="downloads.resumeAll()">
        {{ t('downloads.resumeAll') }}
      </button>
      <button type="button" class="px-2 py-1 rounded-[10px] bg-surface border border-border" @click="downloads.cleanFinished()">
        {{ t('downloads.cleanFinished') }}
      </button>
      <button
        type="button"
        class="px-2 py-1 rounded-[10px] bg-accent text-primary-fg"
        @click="app.showAddLinks = true"
      >
        {{ t('downloads.addLinks') }}
      </button>
      <span class="ml-auto text-muted tabular-nums">{{ formatSpeed(downloads.totalSpeed) }}</span>
    </div>

    <main class="flex-1 overflow-auto">
      <RouterView />
    </main>

    <footer class="border-t border-border bg-surface px-3 py-1.5 text-xs text-muted flex flex-wrap gap-4">
      <span>{{ t('downloads.packages') }}: {{ downloads.packages.length }}</span>
      <span>{{ t('downloads.links') }}: {{ downloads.links.length }}</span>
      <span>{{ t('downloads.speed') }}: {{ formatSpeed(downloads.totalSpeed) }}</span>
      <span>{{ t('downloads.remaining') }}: {{ formatSize(downloads.remainingBytes) }}</span>
      <span>{{ t('downloads.connections') }}: {{ downloads.activeConnections }}</span>
      <span class="ml-auto">{{ downloads.engineStopped ? t('downloads.engineStopped') : t('downloads.engineRunning') }}</span>
    </footer>

    <AddLinksModal v-if="app.showAddLinks" @close="app.showAddLinks = false" />
  </div>
</template>
