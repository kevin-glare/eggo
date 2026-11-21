import { useCallback, useEffect, useRef, useState } from 'react'
import { MINIGAME_IDS } from '../../game/minigames'
import type { MinigameId } from '../../game/minigames/types'
import { fetchLeaderboard, hapticTap, tg, type LeaderboardView } from '../../telegram'
import { useStrings } from '../i18n'
import { useDialogFocus } from '../useDialogFocus'

interface MinigamePickerProps {
  /** рекорды игр: у неигранных плитки рекорда нет */
  best: Partial<Record<MinigameId, number>>
  /** игра дня: на её плитке бейдж 🔥 ×2 */
  dayGameId: MinigameId
  onPick: (id: MinigameId | 'random') => void
  onClose: () => void
}

/** Сколько строк чужого топа показывать: пикер должен остаться компактным. */
const LB_ROWS_SHOWN = 5

/**
 * Выбор мини-игры кнопкой «Играть»: плитка «Случайная» сохраняет сюрприз,
 * дальше — все игры с рекордами и бейджем игры дня. Паттерн меню:
 * фокус-ловушка, Escape, BackButton; выход без выбора награды не трогает.
 */
export default function MinigamePicker({ best, dayGameId, onPick, onClose }: MinigamePickerProps) {
  const str = useStrings()
  const panelRef = useRef<HTMLElement>(null)
  useDialogFocus(panelRef, true, onClose)
  // лидерборд игры дня: тянется один раз при открытии пикера; сети нет
  // или таблица пуста — секция тихо не рисуется
  const [board, setBoard] = useState<LeaderboardView | null>(null)
  useEffect(() => {
    let cancelled = false
    void fetchLeaderboard(dayGameId).then((b) => {
      if (!cancelled && b !== null) setBoard(b)
    })
    return () => {
      cancelled = true
    }
  }, [dayGameId])

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
          {/* закрыть — как в меню: без выбора награды не трогаем */}
          <button
            type="button"
            className="tool-btn"
            onClick={() => {
              hapticTap()
              onClose()
            }}
            aria-label={str.menuClose}
          >
            ✕
          </button>
        </header>
        <div className="picker-list">
          <button type="button" className="picker-tile random" onClick={() => pick('random')}>
            <span className="picker-name">🎲 {str.pickRandom}</span>
          </button>
          {MINIGAME_IDS.map((id) => (
            <button key={id} type="button" className="picker-tile" onClick={() => pick(id)}>
              <span className="picker-name">{str.game[id].title}</span>
              {id === dayGameId && <span className="picker-day" title={str.pickDayTitle}>🎯 ×2</span>}
              {best[id] !== undefined && <span className="mg-chip">{str.mgBest(best[id]!)}</span>}
            </button>
          ))}
        </div>
        {board !== null && (
          <section className="lb" aria-label={str.lbTitle}>
            <p className="lb-title">
              {str.lbTitle} · {str.game[dayGameId].title}
            </p>
            {board.you !== null && <p className="lb-you">{str.lbYou(board.you)}</p>}
            <ul className="lb-rows">
              {board.rows.slice(0, LB_ROWS_SHOWN).map((r) => (
                <li key={r.place} className={r.place === board.you ? 'lb-row me' : 'lb-row'}>
                  <span className="lb-place num">{r.place}</span>
                  <span className="lb-name">{r.name || str.lbAnon}</span>
                  <span className="lb-best num">{r.best}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </div>
  )
}
