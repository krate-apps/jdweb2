<script setup lang="ts">
import logoUrl from '@/assets/logo.svg'

withDefaults(
  defineProps<{
    size?: number
    showName?: boolean
  }>(),
  { size: 22, showName: true },
)
</script>

<template>
  <span class="inline-flex items-center gap-2 min-w-0">
    <img
      :src="logoUrl"
      alt=""
      :width="size"
      :height="size"
      class="shrink-0 rounded-[6px]"
      decoding="async"
    />
    <span v-if="showName" class="font-semibold text-accent-text truncate">jdweb2</span>
  </span>
</template>
