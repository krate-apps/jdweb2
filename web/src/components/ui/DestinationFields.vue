<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export type Kind = 'movies' | 'shows' | 'other'

const props = defineProps<{
  kind: Kind
  title: string
  season: number
}>()

const emit = defineEmits<{
  'update:kind': [Kind]
  'update:title': [string]
  'update:season': [number]
}>()

const { t } = useI18n()

const titleLabel = computed(() => {
  if (props.kind === 'movies') return t('destination.titleMovie')
  if (props.kind === 'shows') return t('destination.titleShow')
  return t('destination.titleOther')
})

const titlePlaceholder = computed(() => {
  if (props.kind === 'movies') return t('destination.placeholderMovie')
  if (props.kind === 'shows') return t('destination.placeholderShow')
  return ''
})
</script>

<template>
  <div class="space-y-3">
    <div>
      <label class="block text-xs font-medium text-muted mb-1">{{ t('destination.label') }}</label>
      <div class="flex gap-2">
        <button
          v-for="k in (['movies', 'shows', 'other'] as Kind[])"
          :key="k"
          type="button"
          class="flex-1 px-2 py-1.5 text-sm rounded-[10px] border"
          :class="kind === k ? 'border-primary bg-surface-3 text-foreground' : 'border-border bg-input text-muted'"
          @click="emit('update:kind', k)"
        >
          {{ t(`destination.${k}`) }}
        </button>
      </div>
    </div>
    <div>
      <label class="block text-xs font-medium text-muted mb-1">{{ titleLabel }}</label>
      <input
        class="w-full bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm"
        :value="title"
        :placeholder="titlePlaceholder"
        @input="emit('update:title', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <div v-if="kind === 'shows'">
      <label class="block text-xs font-medium text-muted mb-1">{{ t('destination.season') }}</label>
      <input
        type="number"
        min="1"
        class="w-28 bg-input border border-border rounded-[10px] px-2 py-1.5 text-sm"
        :value="season"
        @input="emit('update:season', Number(($event.target as HTMLInputElement).value) || 1)"
      />
    </div>
  </div>
</template>
