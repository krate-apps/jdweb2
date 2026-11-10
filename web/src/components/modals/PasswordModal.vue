<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { answerDialog, getPasswordList, retryExtraction, setPasswordList } from '@/api/jd'
import { useDialogA11y } from '@/composables/useDialogA11y'

const props = defineProps<{
  /** JD dialog id (password prompt from the desktop extraction queue). */
  dialogId?: number
  /** Download package uuid — set password and call startExtractionNow. */
  packageUuid?: number
}>()

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const password = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const { panelRef } = useDialogA11y(
  () => emit('close'),
  () => !busy.value,
)

const isRetry = computed(() => props.packageUuid != null)

async function submit() {
  const value = password.value.trim()
  if (!value) return
  busy.value = true
  error.value = null
  try {
    const list = (await getPasswordList()) ?? []
    if (!list.includes(value)) {
      await setPasswordList([...list, value])
    }
    if (props.packageUuid != null) {
      await retryExtraction(props.packageUuid, value)
    } else if (props.dialogId != null) {
      await answerDialog(props.dialogId, { password: value, remember: true })
    } else {
      throw new Error('missing_target')
    }
    emit('close')
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('common.error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="!busy && emit('close')">
    <form
      ref="panelRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-title"
      class="w-full max-w-sm rounded-[14px] bg-surface border border-border p-4 space-y-3"
      @submit.prevent="submit"
    >
      <h2 id="password-title" class="font-semibold">{{ isRetry ? t('password.retry') : t('password.title') }}</h2>
      <p class="text-xs text-muted">{{ isRetry ? t('password.retryHint') : t('password.hint') }}</p>
      <input
        v-model="password"
        type="password"
        class="w-full bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm"
        :placeholder="t('password.title')"
        autofocus
      />
      <p v-if="error" class="text-xs text-danger-text">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="px-3 py-1.5 rounded-[10px] border border-border" @click="emit('close')">
          {{ t('common.cancel') }}
        </button>
        <button type="submit" class="px-3 py-1.5 rounded-[10px] bg-primary text-primary-fg" :disabled="busy">
          {{ isRetry ? t('password.retrySubmit') : t('password.submit') }}
        </button>
      </div>
    </form>
  </div>
</template>
