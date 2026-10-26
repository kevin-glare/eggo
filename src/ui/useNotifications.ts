import { useCallback, useEffect, useState } from 'react'
import { fetchNotifyState, hapticTap, setNotifyEnabled, tg } from '../telegram'

/**
 * Переключатель пушей от бота. Состояние живёт на сервере (push_enabled),
 * клиент только спрашивает его и переключает. Вне Telegram не показывается.
 */
export function useNotifications() {
  const supported = tg() !== null
  const [enabled, setEnabled] = useState(false)
  const [known, setKnown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    void fetchNotifyState().then((state) => {
      if (cancelled || state === null) return
      setEnabled(state === 'on')
      setKnown(true)
    })
    return () => {
      cancelled = true
    }
  }, [supported])

  // уведомления сами исчезают — как в usePet
  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(id)
  }, [notice])

  const toggle = useCallback(async () => {
    if (busy || !known) return
    setBusy(true)
    hapticTap()
    const result = await setNotifyEnabled(!enabled)
    if (result === 'ok') {
      setEnabled(!enabled)
      setNotice(!enabled ? '🔔 Уведомления включены' : '🔕 Уведомления выключены')
    } else if (result === 'blocked') {
      setNotice('✋ Открой чат с ботом и нажми «Запустить», потом попробуй снова')
    } else {
      setNotice('⚠️ Не получилось — попробуй ещё раз')
    }
    setBusy(false)
  }, [busy, enabled, known])

  return { supported: supported && known, enabled, busy, toggle, notice }
}
