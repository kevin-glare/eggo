import { useEffect, useRef, useState } from 'react'
import type { PetState } from '../game/types'
import type { Mood } from '../game/types'
import { setLang, useLang, useStrings } from './i18n'
import InvitePanel from './InvitePanel'
import HelpPanel from './HelpPanel'
import { createVisualState, drawPet, GROUND_Y, SCENE_W } from './petArt'
import { track } from '../metrika'
import { hapticTap, tg } from '../telegram'

/** Подэкраны меню: корень с рядами и карточки-объяснения поверх главного экрана. */
type MenuView = 'root' | 'invite' | 'help'

interface MenuScreenProps {
  open: boolean
  onClose: () => void
  /** питомец для карточки-профиля и мини-арта */
  pet: PetState
  /** настроение питомца — рисуется в мини-арте */
  mood: Mood
  /** уведомления: состояние и переключение — из useNotifications в App */
  notifSupported: boolean
  notifEnabled: boolean
  notifBusy: boolean
  onToggleNotifications: () => void
  /** нотис тумблера пушей: показываем внутри меню, где он виден */
  notifNotice: string | null
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
  mood,
  notifSupported,
  notifEnabled,
  notifBusy,
  onToggleNotifications,
  notifNotice,
  onShare,
  onChannel,
  onAuthor,
  authorUrl,
  invited,
  milestones,
  version,
}: MenuScreenProps) {
  const str = useStrings()
  const lang = useLang()
  const [view, setView] = useState<MenuView>('root')
  const panelRef = useRef<HTMLElement>(null)
  const artRef = useRef<HTMLCanvasElement>(null)
  // экран закрыт — подэкран сбрасывается, следующее открытие начинается с корня
  useEffect(() => {
    if (!open) setView('root')
  }, [open])
  // фокус-менеджмент диалога: фокус в панель на открытии, Tab не выпускает,
  // на закрытии фокус возвращается на кнопку, открывшую меню
  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
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
  }, [open, onClose])
  // Telegram BackButton: из корня закрывает меню, из подэкрана ведёт назад
  useEffect(() => {
    if (!open) return
    const btn = tg()?.BackButton
    if (!btn) return
    btn.show()
    const onBack = () => {
      if (view === 'root') onClose()
      else setView('root')
    }
    btn.onClick(onBack)
    return () => {
      btn.offClick(onBack)
      btn.hide()
    }
  }, [open, view, onClose])
  // мини-арт питомца: один статичный кадр движка petArt в карточке профиля
  useEffect(() => {
    const canvas = artRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const s = 0.42
    ctx.setTransform(2, 0, 0, 2, 0, 0)
    ctx.clearRect(0, 0, 120, 110)
    ctx.translate(60 - (SCENE_W / 2) * s, 100 - (GROUND_Y + 6) * s)
    ctx.scale(s, s)
    drawPet(ctx, pet.stage, mood, pet.appearance, createVisualState(), 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }, [pet.appearance, pet.stage, mood])

  // каждый ряд экрана отвечает на тап хаптикой
  const tap = (fn: () => void) => () => {
    hapticTap()
    fn()
  }

  const back = () => setView('root')

  // смена языка на живую: useStrings/useLang перерисовывают меню сами, без перезагрузки
  const switchLang = () => {
    track('lang-switch')
    setLang(lang === 'ru' ? 'en' : 'ru')
  }

  return (
    <div className={open ? 'menu-root open' : 'menu-root'} aria-hidden={!open}>
      <section
        className="menu-screen"
        role="dialog"
        aria-modal="true"
        aria-label={str.menuAria}
        ref={panelRef}
        tabIndex={-1}
      >
        <div className="menu-head">
          <p className="menu-title">{str.menuAria}</p>
          <button type="button" className="tool-btn" onClick={tap(onClose)} aria-label={str.menuClose}>
            ✕
          </button>
        </div>
        {/* тост тумблера пушей: внутри меню, где его не накрывает оверлей */}
        {notifNotice && <div className="menu-toast">{notifNotice}</div>}
        <div className="menu-body">
          {view === 'root' ? (
            <>
              <div className="menu-profile">
                <canvas ref={artRef} className="menu-avatar" width={240} height={220} aria-hidden="true" />
                <div className="menu-profile-text">
                  <p className="menu-profile-name">{pet.name ?? str.stage[pet.stage]}</p>
                  <p className="menu-profile-meta">
                    {str.stage[pet.stage]} · {str.ageLabel} <span className="num">{str.formatAge(pet.ageMs)}</span>
                  </p>
                </div>
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
                <button type="button" className="menu-row" onClick={tap(switchLang)}>
                  <span className="menu-row-icon" aria-hidden="true">
                    🌐
                  </span>
                  <span className="menu-row-label">
                    {str.menuLang}: {lang === 'ru' ? 'Русский' : 'English'}
                  </span>
                </button>
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
                  <span className="menu-row-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button type="button" className="menu-row" onClick={tap(onChannel)}>
                  <span className="menu-row-icon" aria-hidden="true">
                    📢
                  </span>
                  <span className="menu-row-label">{str.menuChannel}</span>
                  <span className="menu-row-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                {authorUrl !== null && (
                  <button type="button" className="menu-row" onClick={tap(onAuthor)}>
                    <span className="menu-row-icon" aria-hidden="true">
                      ✉️
                    </span>
                    <span className="menu-row-label">{str.authorAria}</span>
                    <span className="menu-row-chevron" aria-hidden="true">
                      ›
                    </span>
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
                  <span className="menu-row-chevron" aria-hidden="true">
                    ›
                  </span>
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
                <InvitePanel invited={invited} stars={pet.appearance.refMark} milestones={milestones} onShare={onShare} />
              ) : (
                <HelpPanel />
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
