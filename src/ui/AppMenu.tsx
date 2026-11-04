import { useEffect } from 'react'
import type { PetState } from '../game/types'
import { getStrings } from './i18n'

const str = getStrings()

interface AppMenuProps {
  open: boolean
  onClose: () => void
  /** питомец для мини-профиля в шапке меню */
  pet: PetState
  /** уведомления: состояние и переключение — из useNotifications в App */
  notifSupported: boolean
  notifEnabled: boolean
  notifBusy: boolean
  onToggleNotifications: () => void
  /** «Позови друга»: закрыть меню, открыть панель приглашения */
  onInvite: () => void
  /** «Как играть»: закрыть меню, открыть карточку правил */
  onHelp: () => void
  /** «Наш канал»: открыть штатным клиентом Telegram */
  onChannel: () => void
  /** «Написать автору»: открыть штатным клиентом Telegram */
  onAuthor: () => void
  /** показывать ли строку автора (ссылка не задана — строки нет) */
  authorUrl: string | null
  version: string
}

/**
 * Боковое меню-шторка справа: служебные действия — уведомления, приглашение
 * друзей, канал, связь с автором, правила. Фиксированный оверлей поверх
 * всего экрана; закрывается тапом по фону, ✕ и Escape.
 */
export default function AppMenu({
  open,
  onClose,
  pet,
  notifSupported,
  notifEnabled,
  notifBusy,
  onToggleNotifications,
  onInvite,
  onHelp,
  onChannel,
  onAuthor,
  authorUrl,
  version,
}: AppMenuProps) {
  // Escape закрывает шторку, пока она открыта
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className={open ? 'menu-root open' : 'menu-root'}>
      <button type="button" className="menu-backdrop" onClick={onClose} aria-label={str.menuClose} tabIndex={-1} />
      <aside className="menu-panel" role="dialog" aria-label={str.menuAria}>
        <div className="menu-head">
          <div className="menu-profile">
            <p className="menu-profile-name">{pet.name ?? str.stage[pet.stage]}</p>
            <p className="menu-profile-meta">
              {str.stage[pet.stage]} · {str.ageLabel} <span className="num">{str.formatAge(pet.ageMs)}</span>
            </p>
          </div>
          <button type="button" className="tool-btn" onClick={onClose} aria-label={str.menuClose}>
            ✕
          </button>
        </div>
        <nav className="menu-rows">
          {notifSupported && (
            <button type="button" className="menu-row" onClick={onToggleNotifications} disabled={notifBusy}>
              <span className="menu-row-icon" aria-hidden="true">
                {notifEnabled ? '🔔' : '🔕'}
              </span>
              <span className="menu-row-label">{notifEnabled ? str.menuNotifOn : str.menuNotifOff}</span>
              <span className={notifEnabled ? 'menu-row-state on' : 'menu-row-state'} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="menu-row" onClick={onInvite}>
            <span className="menu-row-icon" aria-hidden="true">
              ✨
            </span>
            <span className="menu-row-label">{str.inviteAria}</span>
          </button>
          <button type="button" className="menu-row" onClick={onChannel}>
            <span className="menu-row-icon" aria-hidden="true">
              📢
            </span>
            <span className="menu-row-label">{str.menuChannel}</span>
          </button>
          {authorUrl !== null && (
            <button type="button" className="menu-row" onClick={onAuthor}>
              <span className="menu-row-icon" aria-hidden="true">
                ✉️
              </span>
              <span className="menu-row-label">{str.authorAria}</span>
            </button>
          )}
          <button type="button" className="menu-row" onClick={onHelp}>
            <span className="menu-row-icon" aria-hidden="true">
              ❓
            </span>
            <span className="menu-row-label">{str.menuHelp}</span>
          </button>
        </nav>
        <p className="menu-footer">
          Eggo {str.menuVersion} {version}
        </p>
      </aside>
    </div>
  )
}
