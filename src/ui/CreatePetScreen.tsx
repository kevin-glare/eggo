import { useState } from 'react'
import type { PetAppearance } from '../game/appearance'
import type { Mood } from '../game/types'
import { getStrings } from './i18n'
import PetCanvas from './PetCanvas'

const str = getStrings()

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
        <svg className="create-brand" viewBox="0 0 260 100" role="img" aria-label="Eggo">
          <defs>
            <path id="eggo-arc" d="M 16 84 Q 130 4 244 84" fill="none" />
          </defs>
          <text
            fontFamily="'Comfortaa', 'Nunito', system-ui, sans-serif"
            fontWeight="700"
            fontSize="42"
            letterSpacing="2"
          >
            <textPath href="#eggo-arc" startOffset="50%" textAnchor="middle">
              Egg<tspan className="create-brand-o">o</tspan>
            </textPath>
          </text>
        </svg>
      </div>
      <div className="create-panel">
        <h1 className="create-headline">{str.create.headline}</h1>
        <p className="create-sub">{str.create.sub}</p>
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
            placeholder={str.create.namePlaceholder}
            aria-label={str.create.namePlaceholder}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            required
          />
          <button type="submit" disabled={!draft.trim()}>
            {str.create.nameButton}
          </button>
        </form>
        <p className="create-pitch">{str.create.pitch}</p>
      </div>
    </section>
  )
}
