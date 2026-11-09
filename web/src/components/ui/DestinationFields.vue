<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { listLibraryFolders } from '@/api/library'

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
const listId = useId()
const movies = ref<string[]>([])
const shows = ref<string[]>([])

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

const suggestions = computed(() => (props.kind === 'movies' ? movies.value : props.kind === 'shows' ? shows.value : []))

async function loadLibrary() {
  ;[movies.value, shows.value] = await Promise.all([
    listLibraryFolders('movies'),
    listLibraryFolders('shows'),
  ])
}

onMounted(() => {
  void loadLibrary()
})

/** Existing show: suggest its highest season number from library folders. */
watch(
  () => [props.kind, props.title] as const,
  async ([kind, title]) => {
    const name = title.trim()
    if (kind !== 'shows' || !name || !shows.value.includes(name)) return
    const seasons = (await listLibraryFolders('shows', name))
      .map((f) => /^Season (\d+)$/i.exec(f)?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number)
    if (seasons.length && props.title.trim() === name) {
      emit('update:season', Math.max(...seasons))
    }
  },
)
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
        :list="kind === 'other' ? undefined : `${listId}-titles`"
        @input="emit('update:title', ($event.target as HTMLInputElement).value)"
      />
      <datalist v-if="kind !== 'other'" :id="`${listId}-titles`">
        <option v-for="name in suggestions" :key="name" :value="name" />
      </datalist>
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
