<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DestinationFields, { type Kind } from '@/components/ui/DestinationFields.vue'
import { apiJson } from '@/api/http'
import { useDownloadsStore } from '@/stores/downloads'

const props = defineProps<{ packageUuid: number; currentSaveTo?: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const downloads = useDownloadsStore()

const kind = ref<Kind>('other')
const title = ref('')
const season = ref(1)
const busy = ref(false)
const error = ref<string | null>(null)

const unchanged = computed(() => !title.value.trim())

async function submit() {
  if (!title.value.trim()) return
  busy.value = true
  error.value = null
  try {
    await apiJson('api/mover/move', {
      method: 'POST',
      body: JSON.stringify({
        packageUuid: props.packageUuid,
        kind: kind.value,
        title: title.value.trim(),
        season: season.value,
      }),
    })
    await downloads.refresh()
    emit('close')
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('common.error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-[14px] bg-surface border border-border p-4 space-y-4">
      <h2 class="font-semibold">{{ t('move.title') }}</h2>
      <p v-if="currentSaveTo" class="text-xs text-muted">
        <span>{{ t('move.current') }}</span> {{ currentSaveTo }}
      </p>
      <DestinationFields v-model:kind="kind" v-model:title="title" v-model:season="season" />
      <p v-if="unchanged" class="text-xs text-muted">{{ t('move.same') }}</p>
      <p v-if="error" class="text-xs text-danger-text">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="px-3 py-1.5 rounded-[10px] border border-border" @click="emit('close')">
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-[10px] bg-primary text-primary-fg disabled:opacity-50"
          :disabled="busy || !title.trim()"
          @click="submit"
        >
          {{ t('move.submit') }}
        </button>
      </div>
    </div>
  </div>
</template>
