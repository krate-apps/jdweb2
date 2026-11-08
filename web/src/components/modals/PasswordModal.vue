<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { answerDialog, getPasswordList, setPasswordList } from '@/api/jd'

const props = defineProps<{ dialogId: number }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const password = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

async function submit() {
  if (!password.value.trim()) return
  busy.value = true
  error.value = null
  try {
    const list = (await getPasswordList()) ?? []
    if (!list.includes(password.value.trim())) {
      await setPasswordList([...list, password.value.trim()])
    }
    await answerDialog(props.dialogId, { password: password.value.trim(), remember: true })
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
    <form class="w-full max-w-sm rounded-[14px] bg-surface border border-border p-4 space-y-3" @submit.prevent="submit">
      <h2 class="font-semibold">{{ t('password.title') }}</h2>
      <p class="text-xs text-muted">{{ t('password.hint') }}</p>
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
          {{ t('password.submit') }}
        </button>
      </div>
    </form>
  </div>
</template>
