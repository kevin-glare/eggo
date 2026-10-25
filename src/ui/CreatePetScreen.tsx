import { useState } from 'react'

interface CreatePetScreenProps {
  maxLength: number
  /** возвращает true, если имя принято и питомец создан */
  onCreate: (name: string) => boolean
}

/** Главный экран: сначала вводим имя — потом появится яйцо. */
export default function CreatePetScreen({ maxLength, onCreate }: CreatePetScreenProps) {
  const [draft, setDraft] = useState('')

  return (
    <section className="create-screen">
      <div className="create-egg" aria-hidden>
        🥚
      </div>
      <h1 className="create-title">Eggo</h1>
      <p className="create-sub">Дай имя своему питомцу — имя даётся только раз</p>
      <form
        className="create-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (onCreate(draft)) setDraft('')
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={maxLength}
          placeholder="Имя питомца"
          aria-label="Имя питомца"
          required
          autoFocus
        />
        <button type="submit" disabled={!draft.trim()}>
          Создать
        </button>
      </form>
    </section>
  )
}
