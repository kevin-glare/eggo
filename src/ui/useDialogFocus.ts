import { useEffect, type RefObject } from 'react'

/**
 * Фокус-менеджмент диалога: фокус в панель на открытии, Tab не выпускает,
 * Escape закрывает, на размонтировании фокус возвращается кнопке-инициатору.
 * Общий код экрана меню и оверлея мини-игр.
 */
export function useDialogFocus(
  panelRef: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!active) return
    const panel = panelRef.current
    const prevFocus = document.activeElement as HTMLElement | null
    panel?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prevFocus?.focus()
    }
  }, [active, onClose, panelRef])
}
