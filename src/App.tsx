import { useEffect, useState } from 'react'
import gsap from 'gsap'
import { DEFAULT_CONFIG, DEV_CONFIG, type GameConfig } from './game/config'
import { feed, play, wash } from './game/actions'
import { dayGame } from './game/dailyChallenge'
import { allAchievementIds } from './game/achievements'
import { itemById } from './game/economy'
import { AVAILABLE_MINIGAMES, pickMinigame } from './game/minigames'
import { dayKey } from './game/quests'
import type { MinigameId, MinigameOutcome } from './game/minigames/types'
import { friendshipDay } from './game/streak'
import { desire, getMood, neglectLevel } from './game/engine'
import ActionsBar from './ui/ActionsBar'
import CreatePetScreen from './ui/CreatePetScreen'
import { dirtLevel } from './ui/dirt'
import { useStrings } from './ui/i18n'
import { isRequestHintDone, isWhatsNewDone, markWhatsNewDone } from './ui/hints'
import PetCanvas, { type PetActionKind } from './ui/PetCanvas'
import QuestsBar from './ui/QuestsBar'
import StatsBar from './ui/StatsBar'
import { track } from './metrika'
import { hapticTap, hapticWarning, referralLink, tg } from './telegram'
import { useNotifications } from './ui/useNotifications'
import { usePet } from './ui/usePet'
import MenuScreen, { type MenuView } from './ui/MenuScreen'
import MinigamePicker from './ui/minigames/MinigamePicker'
import MinigameOverlay, { type MinigameResultView } from './ui/minigames/MinigameOverlay'
import { version as APP_VERSION } from '../package.json'
import './ui/app.css'

// в dev-режиме время ×60 — эволюцию видно за минуты
const config: GameConfig = import.meta.env.DEV ? DEV_CONFIG : DEFAULT_CONFIG

/** Кнопка «написать автору»: t.me-ссылка из VITE_AUTHOR_URL; не задана — кнопки нет. */
const envAuthorUrl: unknown = import.meta.env.VITE_AUTHOR_URL
const AUTHOR_URL: string | null = typeof envAuthorUrl === 'string' && envAuthorUrl !== '' ? envAuthorUrl : null

export default function App() {
  const str = useStrings()
  // dev-переключатель неба: авто = локальное время пользователя
  const skyModes: { label: string; hour: number | null }[] = [
    { label: str.dev.skyAuto, hour: null },
    { label: str.dev.skyMorning, hour: 6.5 },
    { label: str.dev.skyDay, hour: 13 },
    { label: str.dev.skyEvening, hour: 19 },
    { label: str.dev.skyNight, hour: 23.5 },
  ]
  const {
    pet,
    notice,
    celebrate,
    invited,
    feedPet,
    playPet,
    washPet,
    finishMinigame,
    finishFeeding,
    petPet,
    claimDaily,
    showNotice,
    toggleSleep,
    startGame,
    advanceTime,
    renamePet,
    buy,
    buyService,
    useVitaminItem,
    activate,
    reset,
  } = usePet(config)
  // служебные кнопки шапки: состояние тумблера пушей живёт на сервере
  const {
    supported: notifSupported,
    enabled: notifEnabled,
    busy: notifBusy,
    toggle: toggleNotifications,
    notice: notifNotice,
  } = useNotifications()
  // праздник дружбы: торт стоит весь юбилейный день
  const anniversary = pet !== null ? friendshipDay(pet, Date.now()) !== null : false
  const [skyHour, setSkyHour] = useState<number | null>(null)
  // активная интерактивная сценка; на время сценки остальные действия не стартуют
  const [scene, setScene] = useState<PetActionKind | null>(null)
  // полноэкранный экран меню; ☰ открывает корень, кнопка магазина — сразу магазин
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuView, setMenuView] = useState<MenuView>('root')
  // мини-игра кнопки «Играть»: выбор в пикере, id запущенной партии и её итог
  const [pickerOpen, setPickerOpen] = useState(false)
  const [minigameId, setMinigameId] = useState<MinigameId | null>(null)
  const [minigameResult, setMinigameResult] = useState<MinigameResultView | null>(null)
  const onFeed = () => {
    if (scene !== null || pet === null) return
    // перекорм: питомец отдыхает после объедения — мягкий отказ вместо сессии
    if (pet.overfedUntil > Date.now()) {
      showNotice(str.reason.overfed)
      hapticWarning()
      return
    }
    // guard'ы проверяются чистым вызовом: отказ — тост и хаптика как раньше
    if (!feed(pet, config).ok) {
      feedPet()
      return
    }
    setScene('feed')
  }
  // сценка доиграла: действие применяется один раз, здесь
  const onSceneComplete = (kind: PetActionKind, data?: { caught?: number }) => {
    setScene(null)
    track(kind)
    if (kind === 'feed') finishFeeding(data?.caught ?? 0)
    else if (kind === 'wash') washPet()
  }
  const onPlay = () => {
    if (scene !== null || minigameId !== null || pet === null) return
    // guard'ы — чистым вызовом: отказ с тостом как раньше, успех — выбор игры
    if (!play(pet, config).ok) {
      playPet()
      return
    }
    setPickerOpen(true)
  }
  // плитка пикера выбрана: «случайная» — честный rng
  const launchGame = (id: MinigameId | 'random') => {
    track('minigame-open')
    setPickerOpen(false)
    setMinigameResult(null)
    setMinigameId(id === 'random' ? pickMinigame(AVAILABLE_MINIGAMES) : id)
  }
  // партия доиграна: награда применяется один раз, здесь; итог — на экран результата
  const onMinigameFinish = (id: MinigameId, outcome: MinigameOutcome) => {
    track('minigame-finish')
    const summary = finishMinigame(id, outcome)
    setMinigameResult({ ...outcome, ...summary })
  }
  const onWash = () => {
    if (scene !== null || pet === null) return
    // guard'ы — чистым вызовом: отказ с тостом как раньше, успех — сценка
    if (!wash(pet, config).ok) {
      washPet()
      return
    }
    // короткая подсказка во всплывашке: как мыть питомца
    showNotice(str.sceneHint.wash)
    setScene('wash')
  }
  // пока стартовый синк выясняет, есть ли питомец у пользователя (новое устройство), — загрузка
  const ready = pet !== null

  // механика просьб должна самообъясняться: тост, пока игрок ни разу не закрыл просьбу
  useEffect(() => {
    if (pet?.request == null || isRequestHintDone()) return
    showNotice(str.requestHint)
  }, [pet?.request?.kind, pet?.request?.expiresAt, showNotice])

  // карточка «что нового»: один раз, когда появился названный питомец
  const [whatsNewShown, setWhatsNewShown] = useState(false)
  useEffect(() => {
    if (pet !== null && pet.name !== null && !isWhatsNewDone()) setWhatsNewShown(true)
  }, [pet?.name])

  // t.me-ссылки внутри Telegram открывает сам клиент, снаружи — новая вкладка
  const openTgLink = (url: string) => {
    const app = tg()
    if (app?.openTelegramLink) app.openTelegramLink(url)
    else window.open(url, '_blank', 'noopener')
  }

  // поделиться питомцем: штатный шер Telegram со ссылкой-приглашением
  const shareEggo = () => {
    if (pet === null) return
    track('share')
    const url = referralLink() ?? window.location.origin
    const text = str.shareText(str.stage[pet.stage], Math.floor(pet.ageMs / 86_400_000))
    openTgLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`)
  }

  // забрать награду дня; успех — конфетти в сцене (usePet сам поднимает celebrate)
  const onClaim = () => {
    track('quest-claim')
    claimDaily()
  }

  // вход: блоки softly всплывают каскадом — когда питомец уже показан
  useEffect(() => {
    if (!ready) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.from('.app > *', {
      y: 16,
      opacity: 0,
      duration: 0.55,
      stagger: 0.08,
      ease: 'power2.out',
      clearProps: 'all',
    })
  }, [ready])

  // питомца ещё нет: локаль пуста, ждём ответа сервера (вне Telegram — мгновенно)
  if (pet === null) {
    return (
      <main className="app">
        <div className="loading">{str.loading}</div>
      </main>
    )
  }

  const eggProgress = Math.min(1, pet.ageMs / config.evolution.eggMs)
  const mood = getMood(pet, config)
  const desireKind = desire(pet, config)
  // каталог достижений стабилен от конфига: порядок строк и счётчик «N из M»
  const achievementIds = allAchievementIds(config)
  // активное блюдо из магазина усиливает еду сессии кормления; базовая еда бесплатна
  const dishItem = pet.dish !== null ? itemById(config, pet.dish) : null
  const feedBalance =
    dishItem?.bonusPerFood !== undefined
      ? { ...config.feeding, perFood: config.feeding.perFood + dishItem.bonusPerFood }
      : config.feeding
  // надетые аксессуары: список в порядке отрисовки — голова, лицо, шея
  const wornAccessories = [
    pet.cosmetics.accessories.head,
    pet.cosmetics.accessories.face,
    pet.cosmetics.accessories.neck,
  ].filter((x): x is string => x !== null)
  // главный экран: без имени игра не начинается — в том числе старые безымянные сейвы
  const isCreating = pet.name === null

  return (
    <main className="app">
      {isCreating ? (
        <CreatePetScreen
          maxLength={config.nameMaxLength}
          appearance={pet.appearance}
          skyHourOverride={skyHour}
          onCreate={startGame}
        />
      ) : (
        <>
          <header className="header">
            <h1 className="stage-title">
              {pet.name ?? str.stage[pet.stage]}
              {pet.stage !== 'egg' && <span className="stars" aria-label={str.walletAria}>⭐{pet.stars}</span>}
              {pet.streakDays >= 2 && <span className="streak" title={str.streakTitle}>📅{pet.streakDays}</span>}
            </h1>
            <div className="header-tools">
              <button
                type="button"
                className="tool-btn"
                onClick={() => {
                  track('menu-open')
                  hapticTap()
                  setMenuView('root')
                  setMenuOpen(true)
                }}
                aria-label={str.menuAria}
              >
                ☰
              </button>
            </div>
          </header>

          <div className="scene-card">
            <PetCanvas
              stage={pet.stage}
              mood={mood}
              appearance={pet.appearance}
              eggProgress={eggProgress}
              dirtLevel={dirtLevel(pet.stats.cleanliness)}
              accessories={wornAccessories}
              decor={pet.cosmetics.decor}
              neglectLevel={neglectLevel(pet, config)}
              desire={desireKind}
              request={pet.request}
              skyHourOverride={skyHour}
              onPetTap={() => {
                track('pet')
                petPet()
              }}
              scene={scene}
              onSceneComplete={onSceneComplete}
              feeding={feedBalance}
              fullness={pet.stats.fullness}
              celebrate={celebrate}
              cake={anniversary}
            />
            {/* тосты всплывают на небе, в верхней части сцены, колонкой:
                игровой и нотис тумблера пушей не конкурируют за слот */}
            <div className="toast-slot" aria-live="polite">
              {notice && <div className="toast">{notice}</div>}
              {notifNotice && <div className="toast secondary">{notifNotice}</div>}
            </div>
            {/* карточка «что нового»: разовое сообщение об обновлении */}
            {whatsNewShown && (
              <div className="whatsnew" role="status">
                <p className="whatsnew-text">{str.whatsNewText}</p>
                <div className="whatsnew-btns">
                  <button
                    type="button"
                    className="mg-btn"
                    onClick={() => {
                      track('shop-open')
                      hapticTap()
                      markWhatsNewDone()
                      setWhatsNewShown(false)
                      setMenuView('shop')
                      setMenuOpen(true)
                    }}
                  >
                    {str.whatsNewOpen}
                  </button>
                  <button
                    type="button"
                    className="whatsnew-close"
                    aria-label={str.menuClose}
                    onClick={() => {
                      markWhatsNewDone()
                      setWhatsNewShown(false)
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            <div className="mood">{str.mood[mood]}</div>
          </div>

          {pet.stage !== 'egg' && pet.daily && (
            <QuestsBar daily={pet.daily} targets={config.quests.targets} onClaim={onClaim} onExplain={showNotice} />
          )}
          <StatsBar stats={pet.stats} lowBelow={config.criticalThreshold} />
          <ActionsBar
            isEgg={pet.stage === 'egg'}
            sleeping={pet.sleeping}
            onFeed={onFeed}
            onPlay={onPlay}
            onWash={onWash}
            onToggleSleep={() => {
              if (scene !== null) return
              track(pet.sleeping ? 'wake' : 'sleep')
              toggleSleep()
            }}
            onShop={() => {
              track('shop-open')
              hapticTap()
              setMenuView('shop')
              setMenuOpen(true)
            }}
          />
        </>
      )}

      {import.meta.env.DEV && (
        <div className="devtools">
          {import.meta.env.DEV && <span className="dev-badge">{str.dev.timeBadge(config.timeScale)}</span>}
          <button type="button" onClick={() => advanceTime(60 * 60_000)}>
            {str.dev.plusHour}
          </button>
          <button type="button" onClick={() => advanceTime(24 * 60 * 60_000)}>
            {str.dev.plusDay}
          </button>
          <button
            type="button"
            onClick={() => {
              const i = skyModes.findIndex((m) => m.hour === skyHour)
              const next = skyModes[(i + 1) % skyModes.length]!
              setSkyHour(next.hour)
            }}
          >
            {str.dev.skyButton(skyModes.find((m) => m.hour === skyHour)?.label ?? str.dev.skyAuto)}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(str.dev.resetConfirm)) reset()
            }}
          >
            {str.dev.reset}
          </button>
        </div>
      )}

      {/* выбор мини-игры: рекорды на плитках, «случайная» сохраняет сюрприз, игра дня — с бейджем ×2 */}
      {pickerOpen && (
        <MinigamePicker
          best={pet.minigameBest}
          dayGameId={dayGame(dayKey(Date.now()))}
          onPick={launchGame}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* мини-игра: полноэкранный оверлей над всем, награда применяется один раз в конце */}
      {minigameId !== null && (
        <MinigameOverlay
          id={minigameId}
          config={config}
          best={pet.minigameBest[minigameId] ?? null}
          stage={pet.stage}
          mood={mood}
          appearance={pet.appearance}
          result={minigameResult}
          onFinish={(outcome) => onMinigameFinish(minigameId, outcome)}
          onRestart={() => setMinigameResult(null)}
          onClose={() => {
            setMinigameId(null)
            setMinigameResult(null)
          }}
        />
      )}

      {/* экран меню: фиксированный оверлей, из потока layout'а не выпадает */}
      {!isCreating && (
        <MenuScreen
          open={menuOpen}
          openView={menuView}
          onClose={() => setMenuOpen(false)}
          pet={pet}
          onRename={renamePet}
          nameMaxLength={config.nameMaxLength}
          renamePrice={config.shop.renamePrice}
          achievementIds={achievementIds}
          unlockedAchievements={pet.achievements}
          shopItems={config.shop.items}
          onBuy={buy}
          servicePrices={config.services.prices}
          onBuyService={buyService}
          onVitamin={useVitaminItem}
          onActivate={activate}
          mood={mood}
          notifSupported={notifSupported}
          notifEnabled={notifEnabled}
          notifBusy={notifBusy}
          onToggleNotifications={() => void toggleNotifications()}
          notifNotice={notifNotice}
          onShare={shareEggo}
          onAuthor={() => {
            if (AUTHOR_URL !== null) {
              track('author')
              openTgLink(AUTHOR_URL)
            }
          }}
          authorUrl={AUTHOR_URL}
          invited={invited}
          milestones={config.referrals.milestones}
          version={APP_VERSION}
        />
      )}
    </main>
  )
}
