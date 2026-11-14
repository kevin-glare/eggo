import { useCallback, useEffect, useRef } from 'react'
import { MINIGAME_IDS } from '../../game/minigames'
import type { MinigameId } from '../../game/minigames/types'
import { hapticTap, tg } from '../../telegram'
import { useStrings } from '../i18n'
import { useDialogFocus } from '../useDialogFocus'

interface MinigamePickerProps {
  /** рекорды игр: у неигранных плитки рекорда нет */
  best: Partial<Record<MinigameId, number>>
  onPick: (id: MinigameId | 'random') => void
  onClose: () => void
}

/**
 * Выбор мини-игры кнопкой «Играть»: плитка «Случайная» сохраняет сюрприз,
 * дальше — все игры с рекордами. Паттерн меню: фокус-ловушка, Escape,
 * BackButton; выход без выбора награды не трогает.
 */
export default function MinigamePicker({ best, onPick, onClose }: MinigamePickerProps) {
  const str = useStrings()
  const panelRef = useRef<HTMLElement>(null)
  useDialogFocus(panelRef, true, onClose)

  // BackButton Telegram: закрытие без выбора
  useEffect(() => {
    const btn = tg()?.BackButton
    if (!btn) return
    btn.show()
    btn.onClick(onClose)
    return () => {
      btn.offClick(onClose)
      btn.hide()
    }
  }, [onClose])

  const pick = useCallback(
    (id: MinigameId | 'random') => {
      hapticTap()
      onPick(id)
    },
    [onPick],
  )

  return (
    <div className="mg-root">
      <section
        className="mg-screen"
        role="dialog"
        aria-modal="true"
        aria-label={str.pickTitle}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="mg-head">
          <p className="mg-title">{str.pickTitle}</p>
        </header>
        <div className="picker-list">
          <button type="button" className="picker-tile random" onClick={() => pick('random')}>
            <span className="picker-name">🎲 {str.pickRandom}</span>
          </button>
          {MINIGAME_IDS.map((id) => (
            <button key={id} type="button" className="picker-tile" onClick={() => pick(id)}>
              <span className="picker-name">{str.game[id].title}</span>
              {best[id] !== undefined && <span className="mg-chip">{str.mgBest(best[id]!)}</span>}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
