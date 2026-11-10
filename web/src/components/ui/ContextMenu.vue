<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

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

const menuRef = ref<HTMLUListElement | null>(null)
const activeIndex = ref(0)

function focusItem(index: number) {
  const buttons = menuRef.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
  if (!buttons?.length) return
  const next = (index + buttons.length) % buttons.length
  activeIndex.value = next
  buttons[next]?.focus()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusItem(activeIndex.value + 1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusItem(activeIndex.value - 1)
  }
}

onMounted(async () => {
  await nextTick()
  focusItem(0)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[90]" @click="emit('close')" @contextmenu.prevent="emit('close')">
      <ul
        ref="menuRef"
        role="menu"
        class="fixed min-w-40 rounded-[10px] border border-border bg-surface shadow-lg py-1 text-sm"
        :style="{ left: `${x}px`, top: `${y}px` }"
        @click.stop
        @keydown="onKeydown"
      >
        <li v-for="item in items" :key="item.id" role="none">
          <button
            type="button"
            role="menuitem"
            class="w-full text-left px-3 py-1.5 hover:bg-surface-2 focus:bg-surface-2 outline-none"
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
