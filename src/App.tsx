import { useEffect, useState } from 'react'
import gsap from 'gsap'
import { DEFAULT_CONFIG, DEV_CONFIG, type GameConfig } from './game/config'
import { feed, play, wash } from './game/actions'
import { friendshipDay } from './game/streak'
import { desire, getMood } from './game/engine'
import ActionsBar from './ui/ActionsBar'
import CreatePetScreen from './ui/CreatePetScreen'
import { dirtLevel } from './ui/dirt'
import { getStrings } from './ui/i18n'
import { isRequestHintDone } from './ui/hints'
import PetCanvas, { type PetActionKind } from './ui/PetCanvas'
import QuestsBar from './ui/QuestsBar'
import StatsBar from './ui/StatsBar'
import { track } from './metrika'
import { hapticTap, referralLink, tg } from './telegram'
import { useNotifications } from './ui/useNotifications'
import { usePet } from './ui/usePet'
import MenuScreen from './ui/MenuScreen'
import { version as APP_VERSION } from '../package.json'
import './ui/app.css'

// в dev-режиме время ×60 — эволюцию видно за минуты
const config: GameConfig = import.meta.env.DEV ? DEV_CONFIG : DEFAULT_CONFIG

const str = getStrings()

/** Кнопка «написать автору»: t.me-ссылка из VITE_AUTHOR_URL; не задана — кнопки нет. */
const envAuthorUrl: unknown = import.meta.env.VITE_AUTHOR_URL
const AUTHOR_URL: string | null = typeof envAuthorUrl === 'string' && envAuthorUrl !== '' ? envAuthorUrl : null

/** Наш канал: бот — админ, пункт меню открывает его штатным клиентом Telegram. */
const CHANNEL_URL = 'https://t.me/EggoTg'

/** Dev-переключатель неба: авто = локальное время пользователя. */
const SKY_MODES: { label: string; hour: number | null }[] = [
  { label: str.dev.skyAuto, hour: null },
  { label: str.dev.skyMorning, hour: 6.5 },
  { label: str.dev.skyDay, hour: 13 },
  { label: str.dev.skyEvening, hour: 19 },
  { label: str.dev.skyNight, hour: 23.5 },
]

export default function App() {
  const {
    pet,
    notice,
    celebrate,
    invited,
    feedPet,
    playPet,
    washPet,
    petPet,
    claimDaily,
    showNotice,
    toggleSleep,
    startGame,
    advanceTime,
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
  // полноэкранный экран меню; «Позови друга» и «Как играть» — подэкраны внутри
  const [menuOpen, setMenuOpen] = useState(false)
  const onFeed = () => {
    if (scene !== null || pet === null) return
    // guard'ы проверяются чистым вызовом: отказ — тост и хаптика как раньше
    if (!feed(pet, config).ok) {
      feedPet()
      return
    }
    setScene('feed')
  }
  // сценка доиграла: действие применяется один раз, здесь
  const onSceneComplete = (kind: PetActionKind) => {
    setScene(null)
    track(kind)
    if (kind === 'feed') feedPet()
    else if (kind === 'wash') washPet()
    else if (kind === 'play') playPet()
  }
  const onPlay = () => {
    if (scene !== null || pet === null) return
    if (!play(pet, config).ok) {
      playPet()
      return
    }
    setScene('play')
  }
  const onWash = () => {
    if (scene !== null || pet === null) return
    // guard'ы — чистым вызовом: отказ с тостом как раньше, успех — сценка
    if (!wash(pet, config).ok) {
      washPet()
      return
    }
    setScene('wash')
  }
  // пока стартовый синк выясняет, есть ли питомец у пользователя (новое устройство), — загрузка
  const ready = pet !== null

  // механика просьб должна самообъясняться: тост, пока игрок ни разу не закрыл просьбу
  useEffect(() => {
    if (pet?.request == null || isRequestHintDone()) return
    showNotice(str.requestHint)
  }, [pet?.request?.kind, pet?.request?.expiresAt, showNotice])

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
              {pet.streakDays >= 2 && <span className="streak" title={str.streakTitle}>🔥{pet.streakDays}</span>}
            </h1>
            <div className="header-meta">
              {pet.name && <p className="age-line">{str.stage[pet.stage]}</p>}
              <p className="age-line header-age">
                {str.ageLabel} <span className="num">{str.formatAge(pet.ageMs)}</span>
              </p>
            </div>
            <div className="header-tools">
              <button
                type="button"
                className="tool-btn"
                onClick={() => {
                  track('menu-open')
                  hapticTap()
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
              desire={desireKind}
              request={pet.request}
              skyHourOverride={skyHour}
              onPetTap={() => {
                track('pet')
                petPet()
              }}
              scene={scene}
              onSceneComplete={onSceneComplete}
              celebrate={celebrate}
              cake={anniversary}
            />
            {/* тост всплывает на небе, в верхней части сцены;
                нотис тумблера пушей показываем, пока слот тоста свободен */}
            <div className="toast-slot" aria-live="polite">
              {notice ? (
                <div className="toast">{notice}</div>
              ) : (
                notifNotice && <div className="toast">{notifNotice}</div>
              )}
            </div>
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
              const i = SKY_MODES.findIndex((m) => m.hour === skyHour)
              const next = SKY_MODES[(i + 1) % SKY_MODES.length]!
              setSkyHour(next.hour)
            }}
          >
            {str.dev.skyButton(SKY_MODES.find((m) => m.hour === skyHour)?.label ?? str.dev.skyAuto)}
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

      {/* экран меню: фиксированный оверлей, из потока layout'а не выпадает */}
      {!isCreating && (
        <MenuScreen
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          pet={pet}
          notifSupported={notifSupported}
          notifEnabled={notifEnabled}
          notifBusy={notifBusy}
          onToggleNotifications={() => void toggleNotifications()}
          onShare={shareEggo}
          onChannel={() => {
            track('channel')
            openTgLink(CHANNEL_URL)
          }}
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
