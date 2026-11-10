<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BrandMark from '@/components/ui/BrandMark.vue'
import { useAppStore } from '@/stores/app'
import { apiJson } from '@/api/http'
import { getJdVersion } from '@/api/jd'
import { useDialogA11y } from '@/composables/useDialogA11y'

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const app = useAppStore()
const { panelRef } = useDialogA11y(() => emit('close'))

const version = ref(app.publicConfig?.version ?? '…')
const jdVersion = ref<string | null>(null)
const busy = ref(true)

onMounted(async () => {
  busy.value = true
  try {
    if (!app.publicConfig?.version) {
      const health = await apiJson<{ version?: string }>('api/health')
      if (health.version) version.value = health.version
    } else {
      version.value = app.publicConfig.version
    }
  } catch {
    /* keep fallback */
  }
  try {
    const v = await getJdVersion()
    jdVersion.value = v == null ? null : String(v)
    app.connected = true
  } catch {
    jdVersion.value = null
    app.connected = false
  } finally {
    busy.value = false
  }
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4" @click.self="emit('close')">
    <div
      ref="panelRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
      class="jd-panel w-full max-w-sm rounded-[16px] p-6 space-y-5"
    >
      <div class="flex items-center gap-3">
        <BrandMark :size="40" :show-name="false" />
        <div class="min-w-0 space-y-0.5">
          <h2 id="about-title" class="text-xl font-semibold tracking-tight">{{ t('about.title') }}</h2>
          <p class="text-sm text-muted leading-relaxed">{{ t('about.tagline') }}</p>
        </div>
      </div>

      <dl class="space-y-2.5 text-sm">
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t('about.version') }}</dt>
          <dd class="font-mono tabular-nums">{{ version }}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t('about.jdownloader') }}</dt>
          <dd class="text-right">
            <span v-if="busy" class="text-muted">…</span>
            <span v-else-if="jdVersion != null" class="font-mono tabular-nums">{{ jdVersion }}</span>
            <span v-else class="text-danger-text">{{ t('app.disconnected') }}</span>
          </dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t('about.license') }}</dt>
          <dd>Unlicense</dd>
        </div>
      </dl>

      <p class="text-xs text-muted leading-relaxed">{{ t('about.blurb') }}</p>

      <div class="flex flex-wrap gap-2 pt-2 border-t border-border">
        <a
          href="https://github.com/krate-apps/jdweb"
          target="_blank"
          rel="noopener noreferrer"
          class="jd-btn jd-btn-ghost text-sm"
        >
          {{ t('about.github') }}
        </a>
        <button type="button" class="jd-btn jd-btn-primary ml-auto text-sm" @click="emit('close')">
          {{ t('common.close') }}
        </button>
      </div>
    </div>
  </div>
</template>
