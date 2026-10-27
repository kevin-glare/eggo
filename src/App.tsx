import { useEffect, useState } from 'react'
import gsap from 'gsap'
import { DEFAULT_CONFIG, DEV_CONFIG, type GameConfig } from './game/config'
import { getMood } from './game/engine'
import type { Mood, Stage } from './game/types'
import ActionsBar from './ui/ActionsBar'
import CreatePetScreen from './ui/CreatePetScreen'
import PetCanvas from './ui/PetCanvas'
import StatsBar from './ui/StatsBar'
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
  const { pet, notice, feedPet, playPet, washPet, toggleSleep, startGame, advanceTime, reset } = usePet(config)
  const [skyHour, setSkyHour] = useState<number | null>(null)
  // пока стартовый синк выясняет, есть ли питомец у пользователя (новое устройство), — загрузка
  const ready = pet !== null

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
            <h1 className="stage-title">{pet.name ?? STAGE_TITLE[pet.stage]}</h1>
            <div className="header-meta">
              {pet.name && <p className="age-line">{STAGE_TITLE[pet.stage]}</p>}
              <p className="age-line header-age">
                Возраст: <span className="num">{formatAge(pet.ageMs)}</span>
              </p>
            </div>
          </header>

          <div className="scene-card">
            <PetCanvas stage={pet.stage} mood={mood} appearance={pet.appearance} eggProgress={eggProgress} skyHourOverride={skyHour} />
          </div>
          <div className="mood">{MOOD_TEXT[mood]}</div>

          <StatsBar stats={pet.stats} lowBelow={config.criticalThreshold} />
          <ActionsBar
            isEgg={pet.stage === 'egg'}
            sleeping={pet.sleeping}
            onFeed={feedPet}
            onPlay={playPet}
            onWash={washPet}
            onToggleSleep={toggleSleep}
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
