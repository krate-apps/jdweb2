<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { answerDialog } from '@/api/jd'
import { useDialogA11y } from '@/composables/useDialogA11y'

const props = defineProps<{
  dialogId: number
  type: string
  properties?: Record<string, string>
}>()

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const answer = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const { panelRef } = useDialogA11y(
  () => emit('close'),
  () => !busy.value,
)

const imageSrc = computed(() => {
  const p = props.properties ?? {}
  const raw =
    p.imageDataURL ||
    p.dataURL ||
    p.captcha ||
    p.image ||
    p.explain ||
    ''
  if (!raw) return null
  if (raw.startsWith('data:') || raw.startsWith('http')) return raw
  if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 64) return `data:image/png;base64,${raw}`
  return null
})

const promptText = computed(() => {
  const p = props.properties ?? {}
  return p.explain || p.message || p.title || t('captcha.hint')
})

async function submit() {
  const value = answer.value.trim()
  if (!value) return
  busy.value = true
  error.value = null
  try {
    await answerDialog(props.dialogId, { result: value, captcha: value, value })
    emit('close')
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('common.error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4" @click.self="!busy && emit('close')">
    <form
      ref="panelRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="captcha-title"
      class="jd-panel w-full max-w-sm rounded-[16px] p-5 space-y-4"
      @submit.prevent="submit"
    >
      <div class="space-y-1">
        <h2 id="captcha-title" class="text-lg font-semibold tracking-tight">{{ t('captcha.title') }}</h2>
        <p class="text-sm text-muted leading-relaxed">{{ promptText }}</p>
      </div>
      <img
        v-if="imageSrc"
        :src="imageSrc"
        alt=""
        class="max-h-40 mx-auto rounded-[10px] border border-border bg-surface-2"
      />
      <input
        v-model="answer"
        class="jd-field w-full"
        :placeholder="t('captcha.placeholder')"
        autocomplete="off"
        autofocus
      />
      <p v-if="error" class="text-xs text-danger-text">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="jd-btn jd-btn-ghost" @click="emit('close')">{{ t('common.cancel') }}</button>
        <button type="submit" class="jd-btn jd-btn-primary" :disabled="busy || !answer.trim()">
          {{ t('captcha.submit') }}
        </button>
      </div>
    </form>
  </div>
</template>
