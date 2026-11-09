<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { answerDialog } from '@/api/jd'

const props = defineProps<{
  dialogId: number
  type: string
  properties?: Record<string, string>
}>()

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const busy = ref(false)
const error = ref<string | null>(null)

const message = computed(() => {
  const p = props.properties ?? {}
  return p.message || p.explain || p.title || props.type || t('dialog.genericHint')
})

async function dismiss(dontShowAgain = false) {
  busy.value = true
  error.value = null
  try {
    await answerDialog(props.dialogId, { dontShowAgain, result: true, close: true })
    emit('close')
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('common.error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4" @click.self="emit('close')">
    <div class="jd-panel w-full max-w-sm rounded-[16px] p-5 space-y-4" role="dialog">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold tracking-tight">{{ t('dialog.genericTitle') }}</h2>
        <p class="text-sm text-muted leading-relaxed whitespace-pre-wrap">{{ message }}</p>
      </div>
      <p v-if="error" class="text-xs text-danger-text">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="jd-btn jd-btn-ghost" :disabled="busy" @click="emit('close')">
          {{ t('common.close') }}
        </button>
        <button type="button" class="jd-btn jd-btn-primary" :disabled="busy" @click="dismiss(false)">
          {{ t('dialog.acknowledge') }}
        </button>
      </div>
    </div>
  </div>
</template>
