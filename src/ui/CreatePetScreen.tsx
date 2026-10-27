import { useState } from 'react'
import type { PetAppearance } from '../game/appearance'
import type { Mood } from '../game/types'
import PetCanvas from './PetCanvas'

interface CreatePetScreenProps {
  maxLength: number
  /** внешность («гены») питомца — из её палитры рисуется яйцо */
  appearance: PetAppearance
  /** dev: подменный час неба; null = локальное время пользователя */
  skyHourOverride?: number | null
  /** возвращает true, если имя принято и питомец ожил */
  onCreate: (name: string) => boolean
}

/** Главный экран Eggo: живая поляна с яйцом ждёт имени. */
export default function CreatePetScreen({ maxLength, appearance, skyHourOverride, onCreate }: CreatePetScreenProps) {
  const [draft, setDraft] = useState('')
  // имя согревает яйцо: заметнее покачивается и теплее свет.
  // выше 0.3 не поднимаем — трещины появляются с 0.35, а вылупление не сейчас
  const typed = draft.trim().length
  const eggProgress = Math.min(0.3, (typed / maxLength) * 0.3)
  const mood: Mood = typed > 0 ? 'happy' : 'content'

  return (
    <section className="create-screen">
      <div className="create-scene">
        <PetCanvas
          stage="egg"
          mood={mood}
          appearance={appearance}
          eggProgress={eggProgress}
          skyHourOverride={skyHourOverride}
        />
        <p className="create-brand">
          Egg<span className="create-brand-o">o</span>
        </p>
      </div>
      <div className="create-panel">
        <h1 className="create-headline">Как назовём питомца?</h1>
        <p className="create-sub">Питомец вылупится, когда получит имя</p>
        <form
          className="create-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (onCreate(draft)) setDraft('')
          }}
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={maxLength}
            placeholder="Имя питомца"
            aria-label="Имя питомца"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            required
          />
          <button type="submit" disabled={!draft.trim()}>
            Дать имя
          </button>
        </form>
        <p className="create-pitch">Корми, играй и смотри, как он растёт</p>
      </div>
    </section>
  )
}
