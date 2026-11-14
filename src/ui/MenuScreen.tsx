import { useEffect, useRef, useState } from 'react'
import type { ActionResult } from '../game/actions'
import type { ShopItemConfig } from '../game/config'
import type { BuyReason } from '../game/economy'
import type { ServiceId } from '../game/services'
import type { PetState } from '../game/types'
import type { Mood } from '../game/types'
import { setLang, useLang, useStrings } from './i18n'
import InvitePanel from './InvitePanel'
import HelpPanel from './HelpPanel'
import PetBadge from './PetBadge'
import Toggle from './Toggle'
import { useDialogFocus } from './useDialogFocus'
import { isSoundOn, playSound, setSoundOn } from './sound'
import { track } from '../metrika'
import { hapticTap, hapticWarning, tg } from '../telegram'

/** Подэкраны меню: корень с рядами и карточки-объяснения поверх главного экрана. */
export type MenuView = 'root' | 'invite' | 'help' | 'achievements' | 'shop'

interface MenuScreenProps {
  open: boolean
  /** какой подэкран открывать: ☰ ведёт в корень, кнопка магазина — сразу в магазин */
  openView: MenuView
  onClose: () => void
  /** питомец для карточки-профиля и мини-арта */
  pet: PetState
  /** переименование: ActionResult с reason для ошибки формы; null — питомца нет */
  onRename: (name: string) => ActionResult | null
  /** предел длины имени из config.nameMaxLength */
  nameMaxLength: number
  /** цена смены имени из config.shop.renamePrice */
  renamePrice: number
  /** полный каталог достижений — порядок строк подэкрана */
  achievementIds: string[]
  /** открытые достижения питомца */
  unlockedAchievements: string[]
  /** каталог магазина из config.shop.items */
  shopItems: ShopItemConfig[]
  /** покупка: отказ несёт reason для тоста в меню */
  onBuy: (id: string) => { ok: boolean; reason?: BuyReason }
  /** цены автосервисов из config.services.prices */
  servicePrices: { feed: number; wash: number; sleep: number; vitamin: number; nanny: number }
  /** покупка суточного пропуска («няня» — все три) */
  onBuyService: (id: ServiceId | 'nanny') => { ok: boolean; reason?: 'no-stars' }
  /** витамин: лечит сразу; здоровому не нужен */
  onVitamin: () => { ok: boolean; reason?: 'healthy' | 'no-stars' }
  /** надеть/снять купленную косметику */
  onActivate: (id: string) => { ok: boolean }
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
  openView,
  onClose,
  pet,
  onRename,
  nameMaxLength,
  renamePrice,
  achievementIds,
  unlockedAchievements,
  shopItems,
  onBuy,
  servicePrices,
  onBuyService,
  onVitamin,
  onActivate,
  mood,
  notifSupported,
  notifEnabled,
  notifBusy,
  onToggleNotifications,
  notifNotice,
  onShare,
  onAuthor,
  authorUrl,
  invited,
  milestones,
  version,
}: MenuScreenProps) {
  const str = useStrings()
  const lang = useLang()
  const [view, setView] = useState<MenuView>('root')
  // открытие с нужным подэкраном: ☰ → корень, кнопка магазина → магазин
  useEffect(() => {
    if (open) setView(openView)
  }, [open, openView])
  // смена имени за звёздочки: инлайн-форма в разделе магазина «Имя питомца»
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')

  const startRename = () => {
    setDraftName(pet.name ?? '')
    setRenaming(true)
  }

  const submitRename = () => {
    const result = onRename(draftName)
    setShopNoticeFlash(result?.ok ? str.renameDone : str.reason[result?.reason ?? 'invalid-name'])
    if (result?.ok) {
      setRenaming(false)
      playSound('win')
    } else {
      hapticWarning()
    }
  }

  // магазин: тост результата покупки внутри меню (слот нотиса пушей свободен)
  const [shopNotice, setShopNotice] = useState<string | null>(null)
  const shopNoticeRef = useRef<number>(0)

  const setShopNoticeFlash = (text: string) => {
    setShopNotice(text)
    window.clearTimeout(shopNoticeRef.current)
    shopNoticeRef.current = window.setTimeout(() => setShopNotice(null), 2600)
  }

  const handleBuy = (id: string) => {
    const item = shopItems.find((it) => it.id === id)
    const title = str.shopItem[id]?.title ?? id
    const res = onBuy(id)
    if (res.ok) playSound('win')
    else hapticWarning()
    setShopNoticeFlash(res.ok ? str.shopBought(item?.emoji ? `${item.emoji} ${title}` : title) : res.reason === 'dish-active' ? str.shopDishActive : str.shopNoStars)
  }

  const buyServiceRow = (id: ServiceId | 'nanny', title: string) => {
    const res = onBuyService(id)
    if (res.ok) playSound('win')
    else hapticWarning()
    setShopNoticeFlash(res.ok ? str.shopBought(title) : str.shopNoStars)
  }

  const buyVitaminRow = () => {
    const res = onVitamin()
    if (res.ok) playSound('win')
    else hapticWarning()
    setShopNoticeFlash(res.ok ? str.shopBought(str.svcVitamin) : res.reason === 'healthy' ? str.serviceHealthy : str.shopNoStars)
  }

  /** Сколько часов осталось у пропуска сервиса; null — не активен. */
  const serviceLeftHours = (until: number): number | null => {
    const ms = until - Date.now()
    return ms > 0 ? Math.ceil(ms / 3_600_000) : null
  }
  // звук: локальная настройка устройства, как язык
  const [soundOn, setSoundOnState] = useState(isSoundOn())
  const panelRef = useRef<HTMLElement>(null)
  // экран закрыт — подэкран сбрасывается, следующее открытие начинается с корня
  useEffect(() => {
    if (!open) setView('root')
  }, [open])
  // фокус-менеджмент диалога: фокус в панель, Tab не выпускает, Escape закрывает
  useDialogFocus(panelRef, open, onClose)
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

  // тумблер звука: включение подтверждаем коротким «дзынь»
  const toggleSound = () => {
    const on = !soundOn
    setSoundOn(on)
    setSoundOnState(on)
    if (on) playSound('ding')
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
        {/* тосты внутри меню: нотис пушей и результат покупки */}
        {notifNotice && <div className="menu-toast">{notifNotice}</div>}
        {shopNotice && <div className="menu-toast">{shopNotice}</div>}
        <div className="menu-body">
          {/* ключ = подэкран: смена вьюхи переигрывает слайд-анимацию */}
          <div className="menu-pane" key={view}>
          {view === 'root' ? (
            <>
              <div className="menu-profile">
                <PetBadge
                  stage={pet.stage}
                  mood={mood}
                  appearance={pet.appearance}
                  accessories={[
                    pet.cosmetics.accessories.head,
                    pet.cosmetics.accessories.face,
                    pet.cosmetics.accessories.neck,
                  ].filter((x): x is string => x !== null)}
                  className="menu-avatar"
                />
                <p className="menu-profile-name">{pet.name ?? str.stage[pet.stage]}</p>
                <div className="menu-profile-right">
                  <p className="menu-profile-stage">{str.stage[pet.stage]}</p>
                  <p className="menu-profile-age">
                    {str.ageLabel} <span className="num">{str.formatAge(pet.ageMs)}</span>
                  </p>
                </div>
              </div>
              {/* порядок пунктов задан владельцем: магазин → достижения →
                  как играть → позови друга → автор; настройки — внизу */}
              <nav className="menu-rows">
                <button
                  type="button"
                  className="menu-row"
                  onClick={tap(() => {
                    track('shop-open')
                    setView('shop')
                  })}
                >
                  <span className="menu-row-icon" aria-hidden="true">
                    🛍
                  </span>
                  <span className="menu-row-label">{str.menuShop}</span>
                  <span className="menu-profile-stars num">⭐ {pet.stars}</span>
                  <span className="menu-row-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button
                  type="button"
                  className="menu-row"
                  onClick={tap(() => {
                    track('achievements-open')
                    setView('achievements')
                  })}
                >
                  <span className="menu-row-icon" aria-hidden="true">
                    🏅
                  </span>
                  <span className="menu-row-label">{str.menuAchievements}</span>
                  <span className="mg-chip">
                    {str.achievementsCount(unlockedAchievements.length, achievementIds.length)}
                  </span>
                  <span className="menu-row-chevron" aria-hidden="true">
                    ›
                  </span>
                </button>
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
              </nav>
              <p className="menu-section">{str.menuSettings}</p>
              <nav className="menu-rows">
                <button type="button" className="menu-row" onClick={tap(switchLang)}>
                  <span className="menu-row-icon" aria-hidden="true">
                    🌐
                  </span>
                  <span className="menu-row-label">
                    {str.menuLang}: {lang === 'ru' ? 'Русский' : 'English'}
                  </span>
                </button>
                <button type="button" className="menu-row" onClick={tap(toggleSound)}>
                  <span className="menu-row-icon" aria-hidden="true">
                    {soundOn ? '🔊' : '🔇'}
                  </span>
                  <span className="menu-row-label">{soundOn ? str.menuSoundOn : str.menuSoundOff}</span>
                  <Toggle on={soundOn} label={soundOn ? str.menuSoundOn : str.menuSoundOff} />
                </button>
                {notifSupported && (
                  <button type="button" className="menu-row" onClick={tap(onToggleNotifications)} disabled={notifBusy}>
                    <span className="menu-row-icon" aria-hidden="true">
                      {notifEnabled ? '🔔' : '🔕'}
                    </span>
                    <span className="menu-row-label">{notifEnabled ? str.menuNotifOn : str.menuNotifOff}</span>
                    <Toggle on={notifEnabled} label={notifEnabled ? str.menuNotifOn : str.menuNotifOff} />
                  </button>
                )}
              </nav>
              <p className="menu-footer">
                Eggo {str.menuVersion} {version}
              </p>
            </>
          ) : (
            <div className="menu-sub">
              {/* возврат — компактной кнопкой у правого края */}
              <div className="menu-sub-head">
                <button type="button" className="tool-btn" onClick={tap(back)} aria-label={str.menuBack}>
                  ←
                </button>
              </div>
              {view === 'shop' ? (
                <div className="shop">
                  {(['dish', 'accessory', 'decor'] as const).map((kind) => {
                    const items = shopItems.filter((it) => it.kind === kind)
                    if (items.length === 0) return null
                    const section = kind === 'dish' ? str.shopDishes : kind === 'accessory' ? str.shopAccessories : str.shopDecor
                    return (
                      <div key={kind}>
                        <p className="menu-section">{section}</p>
                        <div className="shop-rows">
                          {items.map((it) => {
                            const title = str.shopItem[it.id]?.title ?? it.id
                            const active = it.kind === 'dish' && pet.dish === it.id
                            const worn = it.kind === 'accessory' && it.accSlot !== undefined && pet.cosmetics.accessories[it.accSlot] === it.id
                            const decorOn =
                              it.kind === 'decor' &&
                              it.decorSlot !== undefined &&
                              pet.cosmetics.decor[it.decorSlot] === it.id
                            const owned = it.kind !== 'dish' && pet.cosmetics.owned.includes(it.id)
                            return (
                              <div key={it.id} className="shop-row">
                                <span className="shop-row-emoji" aria-hidden="true">
                                  {it.emoji}
                                </span>
                                <span className="shop-row-title">{title}</span>
                                {active ? (
                                  <span className="mg-chip">{str.shopActive}</span>
                                ) : owned ? (
                                  <button
                                    type="button"
                                    className="shop-buy ghost"
                                    onClick={tap(() => onActivate(it.id))}
                                  >
                                    {worn || decorOn ? str.remove : str.wear}
                                  </button>
                                ) : (
                                  <button type="button" className="shop-buy" onClick={tap(() => handleBuy(it.id))}>
                                    ⭐ {it.price}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  <p className="menu-section">{str.shopServices}</p>
                  <div className="shop-rows">
                    {(
                      [
                        { id: 'feed' as const, emoji: '🍽', title: str.svcFeed, price: servicePrices.feed, until: pet.services.feedUntil },
                        { id: 'wash' as const, emoji: '🧼', title: str.svcWash, price: servicePrices.wash, until: pet.services.washUntil },
                        { id: 'sleep' as const, emoji: '🌙', title: str.svcSleep, price: servicePrices.sleep, until: pet.services.sleepUntil },
                      ]
                    ).map((svc) => {
                      const left = serviceLeftHours(svc.until)
                      return (
                        <div key={svc.id} className="shop-row">
                          <span className="shop-row-emoji" aria-hidden="true">
                            {svc.emoji}
                          </span>
                          <span className="shop-row-title">{svc.title}</span>
                          {left !== null ? (
                            <span className="mg-chip">{str.serviceLeft(left)}</span>
                          ) : (
                            <button type="button" className="shop-buy" onClick={tap(() => buyServiceRow(svc.id, svc.title))}>
                              ⭐ {svc.price}
                            </button>
                          )}
                        </div>
                      )
                    })}
                    <div className="shop-row">
                      <span className="shop-row-emoji" aria-hidden="true">
                        💊
                      </span>
                      <span className="shop-row-title">{str.svcVitamin}</span>
                      <button type="button" className="shop-buy" onClick={tap(buyVitaminRow)}>
                        ⭐ {servicePrices.vitamin}
                      </button>
                    </div>
                    <div className="shop-row">
                      <span className="shop-row-emoji" aria-hidden="true">
                        🧑‍🍼
                      </span>
                      <span className="shop-row-title">{str.svcNanny}</span>
                      <button type="button" className="shop-buy" onClick={tap(() => buyServiceRow('nanny', str.svcNanny))}>
                        ⭐ {servicePrices.nanny}
                      </button>
                    </div>
                  </div>
                  <p className="menu-section">{str.shopNameSection}</p>
                  <div className="shop-row">
                    <span className="shop-row-emoji" aria-hidden="true">
                      ✏️
                    </span>
                    {renaming ? (
                      <form
                        className="menu-rename"
                        onSubmit={(e) => {
                          e.preventDefault()
                          submitRename()
                        }}
                      >
                        <input
                          className="menu-rename-input"
                          value={draftName}
                          maxLength={nameMaxLength}
                          onChange={(e) => setDraftName(e.target.value)}
                          aria-label={str.renameAria}
                          autoFocus
                        />
                        <span className="menu-rename-price" aria-hidden="true">
                          {str.renamePriceHint(renamePrice)}
                        </span>
                        <button type="submit" className="menu-rename-btn save" aria-label={str.renameSave}>
                          ✓
                        </button>
                        <button
                          type="button"
                          className="menu-rename-btn"
                          onClick={tap(() => setRenaming(false))}
                          aria-label={str.renameCancel}
                        >
                          ✕
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className="shop-row-title">{str.shopRenameTitle}</span>
                        <button type="button" className="shop-buy" onClick={tap(startRename)}>
                          ⭐ {renamePrice}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : view === 'invite' ? (
                <InvitePanel invited={invited} stars={pet.appearance.refMark} milestones={milestones} onShare={onShare} />
              ) : view === 'achievements' ? (
                <div className="menu-ach">
                  {achievementIds.map((id) => {
                    const open = unlockedAchievements.includes(id)
                    return (
                      <div key={id} className={open ? 'menu-ach-row open' : 'menu-ach-row'}>
                        <span className="menu-ach-icon" aria-hidden="true">
                          {open ? '🏅' : '🔒'}
                        </span>
                        <span className="menu-ach-title">{str.achievements[id]?.title ?? id}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <HelpPanel />
              )}
            </div>
          )}
          </div>
        </div>
      </section>
    </div>
  )
}
