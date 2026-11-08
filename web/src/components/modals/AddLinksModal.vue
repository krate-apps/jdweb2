<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DestinationFields, { type Kind } from '@/components/ui/DestinationFields.vue'
import { apiJson } from '@/api/http'
import { addLinks } from '@/api/jd'
import { useGrabberStore } from '@/stores/grabber'
import { useDownloadsStore } from '@/stores/downloads'

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const grabber = useGrabberStore()
const downloads = useDownloadsStore()

const urls = ref('')
const password = ref('')
const kind = ref<Kind>('other')
const title = ref('')
const season = ref(1)
const busy = ref(false)
const error = ref<string | null>(null)
const analyzing = ref(false)

async function submit() {
  error.value = null
  const links = urls.value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
  if (!links) return
  if (!title.value.trim() && kind.value !== 'other') {
    error.value = t('common.error')
    return
  }
  busy.value = true
  analyzing.value = true
  try {
    const destTitle = title.value.trim() || 'download'
    const resolved = await apiJson<{ path: string }>('api/destinations/resolve', {
      method: 'POST',
      body: JSON.stringify({ kind: kind.value, title: destTitle, season: season.value }),
    })
    await addLinks({
      links,
      destinationFolder: resolved.path,
      packageName: destTitle,
      overwritePackagizerRules: true,
    })
    if (password.value.trim()) {
      const { getPasswordList, setPasswordList } = await import('@/api/jd')
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

      <div>
        <label class="block text-xs font-medium text-muted mb-1">{{ t('addLinks.urls') }}</label>
        <textarea
          v-model="urls"
          rows="6"
          class="w-full bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm font-mono"
          placeholder="https://example.com/file.zip"
        />
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
          :disabled="busy"
          @click="submit"
        >
          {{ t('addLinks.submit') }}
        </button>
      </div>
    </div>
  </div>
</template>
