import type { PetActionKind } from './PetCanvas'

interface ActionsBarProps {
  isEgg: boolean
  sleeping: boolean
  /** метка задания дня для кнопки: «1/3», «✓» или нет метки */
  questMarks?: Partial<Record<PetActionKind, string>>
  onFeed: () => void
  onPlay: () => void
  onWash: () => void
  onToggleSleep: () => void
}

/** В яйце действия недоступны; во сне — доступны, но движок откажет с тостом. */
export default function ActionsBar({
  isEgg,
  sleeping,
  questMarks,
  onFeed,
  onPlay,
  onWash,
  onToggleSleep,
}: ActionsBarProps) {
  const mark = (kind: PetActionKind) => {
    const text = questMarks?.[kind]
    if (!text) return null
    return <span className={text === '✓' ? 'qmark done' : 'qmark'} aria-hidden="true">{text}</span>
  }

  return (
    <nav className="actions" aria-label="Действия">
      <button type="button" disabled={isEgg} onClick={onFeed}>
        {mark('feed')}
        <span className="icon">🍔</span>
        <span>Покормить</span>
      </button>
      <button type="button" disabled={isEgg} onClick={onPlay}>
        {mark('play')}
        <span className="icon">🎮</span>
        <span>Играть</span>
      </button>
      <button type="button" disabled={isEgg} onClick={onWash}>
        {mark('wash')}
        <span className="icon">🛁</span>
        <span>Помыть</span>
      </button>
      <button type="button" disabled={isEgg} onClick={onToggleSleep}>
        <span className="icon">{sleeping ? '⏰' : '😴'}</span>
        <span>{sleeping ? 'Разбудить' : 'Спать'}</span>
      </button>
    </nav>
  )
}
