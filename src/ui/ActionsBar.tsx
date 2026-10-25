interface ActionsBarProps {
  isEgg: boolean
  sleeping: boolean
  onFeed: () => void
  onPlay: () => void
  onWash: () => void
  onToggleSleep: () => void
}

/** В яйце действия недоступны; во сне — доступны, но движок откажет с тостом. */
export default function ActionsBar({ isEgg, sleeping, onFeed, onPlay, onWash, onToggleSleep }: ActionsBarProps) {
  const disabled = isEgg
  return (
    <nav className="actions" aria-label="Действия">
      <button type="button" disabled={disabled} onClick={onFeed}>
        🍔<span>Покормить</span>
      </button>
      <button type="button" disabled={disabled} onClick={onPlay}>
        🎮<span>Играть</span>
      </button>
      <button type="button" disabled={disabled} onClick={onWash}>
        🛁<span>Помыть</span>
      </button>
      <button type="button" disabled={disabled} onClick={onToggleSleep}>
        {sleeping ? '⏰' : '😴'}
        <span>{sleeping ? 'Разбудить' : 'Спать'}</span>
      </button>
    </nav>
  )
}
