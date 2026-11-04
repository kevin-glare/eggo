import { useEffect, useState } from 'react'
import type { PetState } from '../game/types'
import { getStrings } from './i18n'
import InvitePanel from './InvitePanel'
import HelpPanel from './HelpPanel'
import { track } from '../metrika'
import { hapticTap } from '../telegram'

const str = getStrings()

/** Подэкраны меню: корень с рядами и карточки-объяснения поверх главного экрана. */
type MenuView = 'root' | 'invite' | 'help'

interface MenuScreenProps {
  open: boolean
  onClose: () => void
  /** питомец для карточки-профиля */
  pet: PetState
  /** уведомления: состояние и переключение — из useNotifications в App */
  notifSupported: boolean
  notifEnabled: boolean
  notifBusy: boolean
  onToggleNotifications: () => void
  /** «Позови друга»: штатный шер Telegram со ссылкой-приглашением */
  onShare: () => void
  /** «Наш канал»: открыть штатным клиентом Telegram */
  onChannel: () => void
  /** «Написать автору»: открыть штатным клиентом Telegram */
  onAuthor: () => void
  /** показывать ли строку автора (ссылка не задана — строки нет) */
  authorUrl: string | null
  /** сколько друзей пришло (с сервера); null — счётчик ещё не приходил */
  invited: number | null
  /** пороги звёзд дружбы из config.referrals.milestones */
  milestones: number[]
  version: string
}

/**
 * Полноэкранный экран меню поверх игры: карточка-профиль, настройки, ссылки
 * и правила. «Позови друга» и «Как играть» — подэкраны внутри меню, больше
 * не карточки в потоке главного экрана. Закрывается ✕ и Escape.
 */
export default function MenuScreen({
  open,
  onClose,
  pet,
  notifSupported,
  notifEnabled,
  notifBusy,
  onToggleNotifications,
  onShare,
  onChannel,
  onAuthor,
  authorUrl,
  invited,
  milestones,
  version,
}: MenuScreenProps) {
  const [view, setView] = useState<MenuView>('root')
  // экран закрыт — подэкран сбрасывается, следующее открытие начинается с корня
  useEffect(() => {
    if (!open) setView('root')
  }, [open])
  // Escape закрывает экран, пока он открыт
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // каждый ряд экрана отвечает на тап хаптикой
  const tap = (fn: () => void) => () => {
    hapticTap()
    fn()
  }

  const back = () => setView('root')

  return (
    <div className={open ? 'menu-root open' : 'menu-root'} aria-hidden={!open}>
      <section className="menu-screen" role="dialog" aria-modal="true" aria-label={str.menuAria}>
        <div className="menu-head">
          <p className="menu-title">{str.menuAria}</p>
          <button type="button" className="tool-btn" onClick={tap(onClose)} aria-label={str.menuClose}>
            ✕
          </button>
        </div>
        <div className="menu-body">
          {view === 'root' ? (
            <>
              <div className="menu-profile">
                <p className="menu-profile-name">{pet.name ?? str.stage[pet.stage]}</p>
                <p className="menu-profile-meta">
                  {str.stage[pet.stage]} · {str.ageLabel} <span className="num">{str.formatAge(pet.ageMs)}</span>
                </p>
              </div>
              <p className="menu-section">{str.menuSettings}</p>
              <nav className="menu-rows">
                {notifSupported && (
                  <button type="button" className="menu-row" onClick={tap(onToggleNotifications)} disabled={notifBusy}>
                    <span className="menu-row-icon" aria-hidden="true">
                      {notifEnabled ? '🔔' : '🔕'}
                    </span>
                    <span className="menu-row-label">{notifEnabled ? str.menuNotifOn : str.menuNotifOff}</span>
                    <span className={notifEnabled ? 'menu-row-state on' : 'menu-row-state'} aria-hidden="true" />
                  </button>
                )}
              </nav>
              <p className="menu-section">{str.menuMore}</p>
              <nav className="menu-rows">
                <button
                  type="button"
                  className="menu-row"
                  onClick={tap(() => {
                    track('invite-open')
                    setView('invite')
                  })}
                >
                  <span className="menu-row-icon" aria-hidden="true">
                    ✨
                  </span>
                  <span className="menu-row-label">{str.inviteAria}</span>
                </button>
                <button type="button" className="menu-row" onClick={tap(onChannel)}>
                  <span className="menu-row-icon" aria-hidden="true">
                    📢
                  </span>
                  <span className="menu-row-label">{str.menuChannel}</span>
                </button>
                {authorUrl !== null && (
                  <button type="button" className="menu-row" onClick={tap(onAuthor)}>
                    <span className="menu-row-icon" aria-hidden="true">
                      ✉️
                    </span>
                    <span className="menu-row-label">{str.authorAria}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="menu-row"
                  onClick={tap(() => {
                    track('help-open')
                    setView('help')
                  })}
                >
                  <span className="menu-row-icon" aria-hidden="true">
                    ❓
                  </span>
                  <span className="menu-row-label">{str.menuHelp}</span>
                </button>
              </nav>
              <p className="menu-footer">
                Eggo {str.menuVersion} {version}
              </p>
            </>
          ) : (
            <div className="menu-sub">
              <button type="button" className="menu-row" onClick={tap(back)}>
                <span className="menu-row-icon" aria-hidden="true">
                  ←
                </span>
                <span className="menu-row-label">{str.menuBack}</span>
              </button>
              {view === 'invite' ? (
                <InvitePanel
                  invited={invited}
                  stars={pet.appearance.refMark}
                  milestones={milestones}
                  onShare={onShare}
                  onClose={back}
                />
              ) : (
                <HelpPanel onClose={back} />
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
