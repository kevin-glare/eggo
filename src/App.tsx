import { useEffect, useState } from 'react'
import gsap from 'gsap'
import { DEFAULT_CONFIG, DEV_CONFIG, type GameConfig } from './game/config'
import { feed, play, wash } from './game/actions'
import { friendshipDay } from './game/streak'
import { desire, getMood } from './game/engine'
import type { Mood, Stage } from './game/types'
import ActionsBar from './ui/ActionsBar'
import CreatePetScreen from './ui/CreatePetScreen'
import { dirtLevel } from './ui/dirt'
import PetCanvas, { type PetActionKind } from './ui/PetCanvas'
import QuestsBar from './ui/QuestsBar'
import StatsBar from './ui/StatsBar'
import type { QuestId } from './game/quests'
import { usePet } from './ui/usePet'
import './ui/app.css'

// в dev-режиме время ×60 — эволюцию видно за минуты
const config: GameConfig = import.meta.env.DEV ? DEV_CONFIG : DEFAULT_CONFIG

const STAGE_TITLE: Record<Stage, string> = {
  egg: '🥚 Яйцо',
  baby: '🐣 Малыш',
  child: '🐤 Ребёнок',
  teen: '🐓 Подросток',
  adult: '🐥 Взрослый',
}

const MOOD_TEXT: Record<Mood, string> = {
  happy: '🤩 Счастлив',
  content: '😌 Спокоен',
  sad: '😢 Грустит',
  sick: '🤒 Болеет — нужен уход',
  sleeping: '😴 Спит',
}

function formatAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч ${minutes % 60} мин`
  return `${Math.floor(hours / 24)} дн ${hours % 24} ч`
}

/** Dev-переключатель неба: авто = локальное время пользователя. */
const SKY_MODES: { label: string; hour: number | null }[] = [
  { label: 'авто', hour: null },
  { label: '🌅 утро', hour: 6.5 },
  { label: '☀️ день', hour: 13 },
  { label: '🌆 вечер', hour: 19 },
  { label: '🌙 ночь', hour: 23.5 },
]

export default function App() {
  const {
    pet,
    notice,
    celebrate,
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
  // праздник дружбы: торт стоит весь юбилейный день
  const anniversary = pet !== null ? friendshipDay(pet, Date.now()) !== null : false
  const [skyHour, setSkyHour] = useState<number | null>(null)
  // активная интерактивная сценка; на время сценки остальные действия не стартуют
  const [scene, setScene] = useState<PetActionKind | null>(null)
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

  // забрать награду дня; успех — конфетти в сцене (usePet сам поднимает celebrate)
  const onClaim = () => {
    claimDaily()
  }

  /** Метки заданий дня на кнопках: «1/3» пока идёт, «✓» когда готово. */
  const questMarks = (() => {
    const daily = pet?.daily
    if (!daily || daily.claimed) return undefined
    const marks: Partial<Record<PetActionKind, string>> = {}
    const mark = (kind: PetActionKind, quest: QuestId) => {
      const i = daily.quests.indexOf(quest)
      if (i === -1) return
      const p = daily.progress[i] ?? 0
      const t = config.quests.targets[quest]
      marks[kind] = p >= t ? '✓' : `${p}/${t}`
    }
    mark('feed', 'feed')
    mark('play', 'play')
    mark('wash', 'wash')
    return Object.keys(marks).length > 0 ? marks : undefined
  })()

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
        <div className="loading">Загружаем питомца…</div>
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
              {pet.name ?? STAGE_TITLE[pet.stage]}
              {pet.streakDays >= 2 && <span className="streak" title="Дней подряд">🔥{pet.streakDays}</span>}
            </h1>
            <div className="header-meta">
              {pet.name && <p className="age-line">{STAGE_TITLE[pet.stage]}</p>}
              <p className="age-line header-age">
                Возраст: <span className="num">{formatAge(pet.ageMs)}</span>
              </p>
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
              skyHourOverride={skyHour}
              onPetTap={petPet}
              scene={scene}
              onSceneComplete={onSceneComplete}
              celebrate={celebrate}
              cake={anniversary}
            />
            <div className="mood">{MOOD_TEXT[mood]}</div>
          </div>

          {pet.stage !== 'egg' && pet.daily && (
            <QuestsBar daily={pet.daily} targets={config.quests.targets} onClaim={onClaim} onExplain={showNotice} />
          )}
          <StatsBar stats={pet.stats} lowBelow={config.criticalThreshold} />
          <ActionsBar
            isEgg={pet.stage === 'egg'}
            sleeping={pet.sleeping}
            questMarks={questMarks}
            onFeed={onFeed}
            onPlay={onPlay}
            onWash={onWash}
            onToggleSleep={() => {
              if (scene !== null) return
              toggleSleep()
            }}
          />
        </>
      )}

      <div className="toast-slot" aria-live="polite">
        {notice && <div className="toast">{notice}</div>}
      </div>

      {import.meta.env.DEV && (
        <div className="devtools">
          {import.meta.env.DEV && <span className="dev-badge">⚡ время ×{config.timeScale}</span>}
          <button type="button" onClick={() => advanceTime(60 * 60_000)}>
            +1 час
          </button>
          <button type="button" onClick={() => advanceTime(24 * 60 * 60_000)}>
            +1 день
          </button>
          <button
            type="button"
            onClick={() => {
              const i = SKY_MODES.findIndex((m) => m.hour === skyHour)
              const next = SKY_MODES[(i + 1) % SKY_MODES.length]!
              setSkyHour(next.hour)
            }}
          >
            Небо: {SKY_MODES.find((m) => m.hour === skyHour)?.label ?? 'авто'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Начать новую игру?')) reset()
            }}
          >
            Сброс
          </button>
        </div>
      )}
    </main>
  )
}
