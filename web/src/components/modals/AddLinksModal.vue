<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DestinationFields, { type Kind } from '@/components/ui/DestinationFields.vue'
import { apiJson } from '@/api/http'
import {
  addLinks,
  CONTAINER_EXTENSIONS,
  containerDataUrl,
  getPasswordList,
  queryCrawlerJob,
  setPasswordList,
  type CrawlerJob,
} from '@/api/jd'
import { useGrabberStore } from '@/stores/grabber'
import { useDownloadsStore } from '@/stores/downloads'
import { useAppStore } from '@/stores/app'

type Source = 'links' | 'dlc'

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const app = useAppStore()
const grabber = useGrabberStore()
const downloads = useDownloadsStore()

const source = ref<Source>('links')
const urls = ref('')
const password = ref('')
const kind = ref<Kind>('other')
const title = ref('')
const season = ref(1)
const busy = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const analyzing = ref(false)
const crawlerJob = ref<CrawlerJob | null>(null)
const containers = ref<{ name: string; dataUrl: string }[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const dropping = ref(false)

const canSubmit = computed(() => {
  if (busy.value) return false
  if (source.value === 'links') {
    return urls.value
      .split(/\r?\n/)
      .map((l) => l.trim())
      .some(Boolean)
  }
  return containers.value.length > 0
})

const progressText = computed(() => {
  const job = crawlerJob.value
  if (!job) return t('addLinks.analyzing')
  if (job.crawled === 0 && (job.crawling || job.checking)) {
    return source.value === 'dlc' ? t('addLinks.readingDlc') : t('addLinks.analyzing')
  }
  const found = t('addLinks.crawledCount', { n: job.crawled })
  if (job.checking && !job.crawling) return t('addLinks.checkingAvailability', { found })
  if (job.crawling || job.checking) return `${found}…`
  return found
})

async function addFiles(files: File[]) {
  source.value = 'dlc'
  error.value = null
  for (const file of files) {
    if (!CONTAINER_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      error.value = `${file.name}: ${t('addLinks.dlcOnly')}`
      continue
    }
    if (containers.value.some((c) => c.name === file.name)) continue
    containers.value.push({ name: file.name, dataUrl: await containerDataUrl(file) })
    if (kind.value === 'movies' && !title.value.trim()) {
      title.value = file.name.replace(/\.[^.]+$/, '')
    }
  }
}

watch(
  () => app.droppedFiles,
  (files) => {
    if (!files.length || busy.value) return
    app.droppedFiles = []
    void addFiles(files)
  },
  { immediate: true },
)

function onFilesPicked(event: Event) {
  const input = event.target as HTMLInputElement
  void addFiles(Array.from(input.files ?? []))
  input.value = ''
}

function onDropZone(event: DragEvent) {
  event.preventDefault()
  dropping.value = false
  void addFiles(Array.from(event.dataTransfer?.files ?? []))
}

function removeContainer(name: string) {
  containers.value = containers.value.filter((c) => c.name !== name)
}

function tryClose() {
  if (busy.value && analyzing.value) return
  emit('close')
}

async function waitForJob(jobId: number): Promise<CrawlerJob | null> {
  for (let i = 0; i < 120; i++) {
    const job = await queryCrawlerJob(jobId)
    crawlerJob.value = job
    if (!job) return null
    if (!job.crawling && !job.checking) return job
    await new Promise((r) => setTimeout(r, 500))
  }
  return crawlerJob.value
}

async function submit() {
  error.value = null
  success.value = null
  crawlerJob.value = null
  if (!canSubmit.value) return
  if (!title.value.trim() && kind.value !== 'other') {
    error.value = t('common.error')
    return
  }
  busy.value = true
  analyzing.value = true
  try {
    const destTitle = title.value.trim() || (containers.value[0]?.name.replace(/\.[^.]+$/, '') ?? 'download')
    const resolved = await apiJson<{ path: string }>('api/destinations/resolve', {
      method: 'POST',
      body: JSON.stringify({ kind: kind.value, title: destTitle, season: season.value }),
    })
    const links =
      source.value === 'links'
        ? urls.value
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)
            .join('\n')
        : undefined
    const { id: jobId } = await addLinks({
      links,
      dataURLs: source.value === 'dlc' ? containers.value.map((c) => c.dataUrl) : undefined,
      destinationFolder: resolved.path,
      packageName: destTitle,
      overwritePackagizerRules: true,
    })
    if (password.value.trim()) {
      const list = (await getPasswordList()) ?? []
      if (!list.includes(password.value.trim())) {
        await setPasswordList([...list, password.value.trim()])
      }
    }
    const job = await waitForJob(jobId)
    await grabber.refresh()
    await downloads.refresh()
    if (!job) {
      success.value = t('addLinks.stillAnalyzing')
      return
    }
    const skipped = [
      job.unhandled > 0 ? t('addLinks.unhandled', { n: job.unhandled }) : '',
      job.filtered > 0 ? t('addLinks.filtered', { n: job.filtered }) : '',
      job.broken > 0 ? t('addLinks.broken', { n: job.broken }) : '',
    ].filter(Boolean)
    if (job.crawled === 0) {
      error.value = t('addLinks.noneAdded', {
        detail: skipped.join(', ') || t('addLinks.noLinksFound'),
      })
      return
    }
    success.value =
      t('addLinks.addedCount', { n: job.crawled }) + (skipped.length ? ` · ${skipped.join(', ')}` : '')
    if (!skipped.length) {
      setTimeout(() => emit('close'), 900)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('common.error')
  } finally {
    busy.value = false
    analyzing.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="tryClose">
    <div class="w-full max-w-lg rounded-[14px] bg-surface border border-border shadow-lg p-4 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">{{ t('addLinks.title') }}</h2>
        <button type="button" class="text-muted hover:text-foreground" :disabled="busy && analyzing" @click="tryClose">
          ✕
        </button>
      </div>

      <div class="flex rounded-[10px] border border-border overflow-hidden text-sm">
        <button
          type="button"
          class="flex-1 px-2 py-1.5"
          :class="source === 'links' ? 'bg-surface-3 text-foreground' : 'bg-input text-muted'"
          :disabled="busy"
          @click="source = 'links'"
        >
          {{ t('addLinks.tabLinks') }}
        </button>
        <button
          type="button"
          class="flex-1 px-2 py-1.5 border-l border-border"
          :class="source === 'dlc' ? 'bg-surface-3 text-foreground' : 'bg-input text-muted'"
          :disabled="busy"
          @click="source = 'dlc'"
        >
          {{ t('addLinks.tabDlc') }}
          <span v-if="containers.length" class="text-muted">({{ containers.length }})</span>
        </button>
      </div>

      <div v-if="source === 'links'">
        <label class="block text-xs font-medium text-muted mb-1">{{ t('addLinks.urls') }}</label>
        <textarea
          v-model="urls"
          rows="6"
          class="w-full bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm font-mono"
          placeholder="https://example.com/file.zip"
          :disabled="busy"
        />
      </div>

      <div v-else class="space-y-2">
        <label class="block text-xs font-medium text-muted">{{ t('addLinks.containers') }}</label>
        <div
          class="rounded-[10px] border border-dashed px-3 py-6 text-center text-sm transition-colors"
          :class="dropping ? 'border-accent bg-accent/10 text-accent-text' : 'border-border text-muted'"
          @dragenter.prevent="dropping = true"
          @dragover.prevent="dropping = true"
          @dragleave.prevent="dropping = false"
          @drop="onDropZone"
        >
          <button type="button" class="text-accent-text hover:underline" :disabled="busy" @click="fileInput?.click()">
            {{ t('addLinks.pickDlc') }}
          </button>
          <input
            ref="fileInput"
            type="file"
            class="hidden"
            accept=".dlc,application/x-dlc"
            multiple
            @change="onFilesPicked"
          />
        </div>
        <ul v-if="containers.length" class="text-xs space-y-1">
          <li
            v-for="c in containers"
            :key="c.name"
            class="flex items-center justify-between gap-2 bg-surface-2 rounded-[10px] px-2 py-1"
          >
            <span class="truncate" :title="c.name">{{ c.name }}</span>
            <button type="button" class="text-muted hover:text-danger-text shrink-0" :disabled="busy" @click="removeContainer(c.name)">
              ✕
            </button>
          </li>
        </ul>
      </div>

      <DestinationFields
        v-model:kind="kind"
        v-model:title="title"
        v-model:season="season"
      />

      <div>
        <label class="block text-xs font-medium text-muted mb-1">
          {{ t('addLinks.archivePassword') }}
          <span class="text-muted font-normal">({{ t('common.optional') }})</span>
        </label>
        <input
          v-model="password"
          type="password"
          class="w-full bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm"
          :placeholder="t('addLinks.archivePasswordHint')"
          :disabled="busy"
        />
      </div>

      <p v-if="analyzing || crawlerJob" class="text-xs text-accent-text">{{ progressText }}</p>
      <p v-if="success" class="text-xs text-state-seed">{{ success }}</p>
      <p v-if="error" class="text-xs text-danger-text">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button type="button" class="px-3 py-1.5 rounded-[10px] border border-border" :disabled="busy && analyzing" @click="tryClose">
          {{ success || error ? t('common.close') : t('common.cancel') }}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-[10px] bg-primary text-primary-fg disabled:opacity-50"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ t('addLinks.submit') }}
        </button>
      </div>
    </div>
  </div>
</template>
