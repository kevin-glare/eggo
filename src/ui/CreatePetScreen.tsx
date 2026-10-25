import { useState } from 'react'

interface CreatePetScreenProps {
  maxLength: number
  /** возвращает true, если имя принято и питомец ожил */
  onCreate: (name: string) => boolean
}

/** Главный экран Eggo: питомец не начнёт жить, пока не получит имя. */
export default function CreatePetScreen({ maxLength, onCreate }: CreatePetScreenProps) {
  const [draft, setDraft] = useState('')

  return (
    <section className="create-screen">
      <div className="create-egg" aria-hidden />
      <h1 className="create-title">
        Egg<span className="create-title-o">o</span>
      </h1>
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
          required
          autoFocus
        />
        <button type="submit" disabled={!draft.trim()}>
          Дать имя
        </button>
      </form>
    </section>
  )
}
