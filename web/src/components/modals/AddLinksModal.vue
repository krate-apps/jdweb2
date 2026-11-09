<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DestinationFields, { type Kind } from '@/components/ui/DestinationFields.vue'
import { apiJson } from '@/api/http'
import { addLinks, CONTAINER_EXTENSIONS, containerDataUrl, getPasswordList, setPasswordList } from '@/api/jd'
import { useGrabberStore } from '@/stores/grabber'
import { useDownloadsStore } from '@/stores/downloads'

type Source = 'links' | 'dlc'

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
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
const analyzing = ref(false)
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

async function submit() {
  error.value = null
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
    await addLinks({
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
    await grabber.refresh()
    await downloads.refresh()
    emit('close')
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('common.error')
  } finally {
    busy.value = false
    analyzing.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="emit('close')">
    <div class="w-full max-w-lg rounded-[14px] bg-surface border border-border shadow-lg p-4 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">{{ t('addLinks.title') }}</h2>
        <button type="button" class="text-muted hover:text-foreground" @click="emit('close')">✕</button>
      </div>

      <div class="flex rounded-[10px] border border-border overflow-hidden text-sm">
        <button
          type="button"
          class="flex-1 px-2 py-1.5"
          :class="source === 'links' ? 'bg-surface-3 text-foreground' : 'bg-input text-muted'"
          @click="source = 'links'"
        >
          {{ t('addLinks.tabLinks') }}
        </button>
        <button
          type="button"
          class="flex-1 px-2 py-1.5 border-l border-border"
          :class="source === 'dlc' ? 'bg-surface-3 text-foreground' : 'bg-input text-muted'"
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
          <button type="button" class="text-accent-text hover:underline" @click="fileInput?.click()">
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
            <button type="button" class="text-muted hover:text-danger-text shrink-0" @click="removeContainer(c.name)">
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
        />
      </div>

      <p v-if="analyzing" class="text-xs text-accent-text">{{ t('addLinks.analyzing') }}</p>
      <p v-if="error" class="text-xs text-danger-text">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button type="button" class="px-3 py-1.5 rounded-[10px] border border-border" @click="emit('close')">
          {{ t('common.cancel') }}
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
