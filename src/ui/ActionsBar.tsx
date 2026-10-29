interface ActionsBarProps {
  isEgg: boolean
  sleeping: boolean
  onFeed: () => void
  onPlay: () => void
  onWash: () => void
  onToggleSleep: () => void
}

/** В яйце действия недоступны; во сне — доступны, но движок откажет с тостом. */
export default function ActionsBar({
  isEgg,
  sleeping,
  onFeed,
  onPlay,
  onWash,
  onToggleSleep,
}: ActionsBarProps) {
  return (
    <nav className="actions" aria-label="Действия">
      <button type="button" disabled={isEgg} onClick={onFeed}>
        <span className="icon">🍔</span>
        <span>Покормить</span>
      </button>
      <button type="button" disabled={isEgg} onClick={onPlay}>
        <span className="icon">🎮</span>
        <span>Играть</span>
      </button>
      <button type="button" disabled={isEgg} onClick={onWash}>
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
