<script setup lang="ts">
export interface ContextMenuItem {
  id: string
  label: string
  danger?: boolean
}

defineProps<{
  x: number
  y: number
  items: ContextMenuItem[]
}>()

const emit = defineEmits<{
  select: [id: string]
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[90]" @click="emit('close')" @contextmenu.prevent="emit('close')">
      <ul
        class="fixed min-w-40 rounded-[10px] border border-border bg-surface shadow-lg py-1 text-sm"
        :style="{ left: `${x}px`, top: `${y}px` }"
        @click.stop
      >
        <li v-for="item in items" :key="item.id">
          <button
            type="button"
            class="w-full text-left px-3 py-1.5 hover:bg-surface-2"
            :class="item.danger ? 'text-danger-text' : ''"
            @click="emit('select', item.id)"
          >
            {{ item.label }}
          </button>
        </li>
      </ul>
    </div>
  </Teleport>
</template>
