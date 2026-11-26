import { useEffect } from 'react'
import { useStrings } from './i18n'
import { track } from '../metrika'

interface FarewellScreenProps {
  /** имя ушедшего питомца — в заголовке прощания */
  name: string
  /** «Взять новое яйцо»: полная новая игра, всё с нуля */
  onRestart: () => void
}

/**
 * Экран прощания: питомца не навещали неделю, и он ушёл искать нового
 * хозяина. Кнопка начинает игру заново — обычный путь CreatePetScreen.
 */
export default function FarewellScreen({ name, onRestart }: FarewellScreenProps) {
  const str = useStrings()
  // считаем визиты на экран прощания (уход случается оффлайн, между сессиями,
  // и может быть виден несколько раз до «Взять новое яйцо»)
  useEffect(() => track('farewell-open'), [])
  return (
    <section className="create-screen">
      <div className="create-scene" style={{ display: 'grid', placeItems: 'center' }}>
        <span style={{ fontSize: '72px' }} aria-hidden="true">
          {str.farewell.emoji}
        </span>
      </div>
      <div className="create-panel">
        <h1 className="create-headline">{str.farewell.headline(name)}</h1>
        <p className="create-sub">{str.farewell.sub}</p>
        <form
          className="create-form"
          onSubmit={(e) => {
            e.preventDefault()
            onRestart()
          }}
        >
          <button type="submit">{str.farewell.restart}</button>
        </form>
      </div>
    </section>
  )
}
