import { useEffect, useState } from 'react'
import { DEFAULT_CONFIG, DEV_CONFIG, type GameConfig } from './game/config'
import { catchUp } from './game/storage'
import { createPet, getMood } from './game/engine'
import type { PetState } from './game/types'
import PetCanvas from './ui/PetCanvas'

// в dev-режиме время ×60 — эволюцию видно за минуты
const config: GameConfig = import.meta.env.DEV ? DEV_CONFIG : DEFAULT_CONFIG

export default function App() {
  const [pet, setPet] = useState<PetState>(() => createPet(Date.now(), config))

  useEffect(() => {
    const id = window.setInterval(() => setPet((p) => catchUp(p, Date.now(), config)), 1000)
    return () => window.clearInterval(id)
  }, [])

  const eggProgress = Math.min(1, pet.ageMs / config.evolution.eggMs)

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#141a26',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: 'monospace',
        color: '#e8ecf4',
      }}
    >
      <PetCanvas stage={pet.stage} mood={getMood(pet, config)} eggProgress={eggProgress} />
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        {pet.stage === 'egg'
          ? 'Яйцо трясётся — скоро вылупится…'
          : `Возраст: ${Math.floor(pet.ageMs / 60_000)} мин · ${pet.stage === 'baby' ? 'малыш' : 'взрослый'}`}
      </p>
    </main>
  )
}
