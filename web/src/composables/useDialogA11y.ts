import { onMounted, onUnmounted, ref } from 'vue'

/** Escape-to-close + initial focus for modal panels. */
export function useDialogA11y(onClose: () => void, canClose: () => boolean = () => true) {
  const panelRef = ref<HTMLElement | null>(null)

  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (!canClose()) return
    e.preventDefault()
    onClose()
  }

  onMounted(() => {
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => {
      const root = panelRef.value
      if (!root) return
      const focusable = root.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      focusable?.focus()
    })
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKey)
  })

  return { panelRef }
}
