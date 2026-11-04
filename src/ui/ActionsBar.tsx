import { useStrings } from './i18n'

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
  const str = useStrings()
  return (
    <nav className="actions" aria-label={str.actionsAria}>
      <button type="button" disabled={isEgg} onClick={onFeed}>
        <span className="icon">🍔</span>
        <span>{str.action.feed}</span>
      </button>
      <button type="button" disabled={isEgg} onClick={onPlay}>
        <span className="icon">🎮</span>
        <span>{str.action.play}</span>
      </button>
      <button type="button" disabled={isEgg} onClick={onWash}>
        <span className="icon">🛁</span>
        <span>{str.action.wash}</span>
      </button>
      <button type="button" disabled={isEgg} onClick={onToggleSleep}>
        <span className="icon">{sleeping ? '⏰' : '😴'}</span>
        <span>{sleeping ? str.action.wake : str.action.sleep}</span>
      </button>
    </nav>
  )
}
