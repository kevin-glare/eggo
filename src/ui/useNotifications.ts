import { useCallback, useEffect, useState } from 'react'
import { fetchNotifyState, hapticTap, setNotifyEnabled, tg } from '../telegram'
import { track } from '../metrika'
import { getStrings } from './i18n'

const str = getStrings()

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
      setNotice(!enabled ? str.notifOn : str.notifOff)
      track(!enabled ? 'notif-on' : 'notif-off')
    } else if (result === 'blocked') {
      setNotice(str.notifBlocked)
    } else {
      setNotice(str.notifError)
    }
    setBusy(false)
  }, [busy, enabled, known])

  return { supported: supported && known, enabled, busy, toggle, notice }
}
