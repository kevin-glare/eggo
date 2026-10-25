import { DEFAULT_CONFIG, DEV_CONFIG, type GameConfig } from './game/config'
import { getMood } from './game/engine'
import type { Mood, Stage } from './game/types'
import ActionsBar from './ui/ActionsBar'
import PetCanvas from './ui/PetCanvas'
import StatsBar from './ui/StatsBar'
import { usePet } from './ui/usePet'
import './ui/app.css'

// в dev-режиме время ×60 — эволюцию видно за минуты
const config: GameConfig = import.meta.env.DEV ? DEV_CONFIG : DEFAULT_CONFIG

const STAGE_TITLE: Record<Stage, string> = {
  egg: '🥚 Яйцо',
  baby: '🐣 Малыш',
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

export default function App() {
  const { pet, notice, feedPet, playPet, washPet, toggleSleep, advanceTime, reset } = usePet(config)
  const eggProgress = Math.min(1, pet.ageMs / config.evolution.eggMs)
  const mood = getMood(pet, config)

  return (
    <main className="app">
      <header className="header">
        <h1 className="stage-title">{STAGE_TITLE[pet.stage]}</h1>
        <p className="age-line">
          Возраст: {formatAge(pet.ageMs)}
          {import.meta.env.DEV && <span className="dev-badge">⚡ время ×{config.timeScale}</span>}
        </p>
      </header>

      <div className="pet-wrap">
        <PetCanvas stage={pet.stage} mood={mood} eggProgress={eggProgress} />
      </div>
      <p className="mood">{MOOD_TEXT[mood]}</p>

      <StatsBar stats={pet.stats} lowBelow={config.criticalThreshold} />
      <ActionsBar
        isEgg={pet.stage === 'egg'}
        sleeping={pet.sleeping}
        onFeed={feedPet}
        onPlay={playPet}
        onWash={washPet}
        onToggleSleep={toggleSleep}
      />

      {notice && <div className="toast">{notice}</div>}

      {import.meta.env.DEV && (
        <div className="devtools">
          <span className="devtools-label">dev:</span>
          <button type="button" onClick={() => advanceTime(60 * 60_000)}>
            +1 час
          </button>
          <button type="button" onClick={() => advanceTime(24 * 60 * 60_000)}>
            +1 день
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
