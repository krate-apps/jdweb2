<script setup lang="ts">
import { useAppStore } from '@/stores/app'

const app = useAppStore()
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="toast in app.toasts"
          :key="toast.id"
          class="pointer-events-auto flex items-center gap-2 bg-surface-3 border border-border text-foreground text-xs rounded-[10px] shadow-lg px-3 py-2 min-w-[200px] max-w-[320px]"
        >
          <span class="text-state-seed shrink-0">✓</span>
          <span class="flex-1 truncate">{{ toast.message }}</span>
          <button type="button" class="shrink-0 text-muted hover:text-foreground" @click="app.dismissToast(toast.id)">
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
