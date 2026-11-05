import { useCallback, useEffect, useRef, useState } from 'react'
import type { PetAppearance } from '../../game/appearance'
import type { GameConfig } from '../../game/config'
import type { Mood, Stage } from '../../game/types'
import type { MinigameId, MinigameOutcome } from '../../game/minigames/types'
import { hapticTap, tg } from '../../telegram'
import { useStrings } from '../i18n'
import PetBadge from '../PetBadge'
import { useDialogFocus } from '../useDialogFocus'
import MemoryGame from './MemoryGame'
import RunnerGame from './RunnerGame'
import FlappyGame from './FlappyGame'
import SnakeGame from './SnakeGame'
import BubblesGame from './BubblesGame'

/** Показ результата: счёт, рекорд и бонус — уже применённые в usePet. */
export interface MinigameResultView {
  score: number
  won: boolean
  isRecord: boolean
  bonus: number
}

interface MinigameOverlayProps {
  id: MinigameId
  config: GameConfig
  /** текущий рекорд этой игры; null — ещё не играли */
  best: number | null
  stage: Stage
  mood: Mood
  appearance: PetAppearance
  /** итог сыгранной партии; null — интро или партия в разгаре */
  result: MinigameResultView | null
  onFinish: (outcome: MinigameOutcome) => void
  /** «Ещё раз»: сбросить итог и начать ту же игру заново */
  onRestart: () => void
  onClose: () => void
}

/**
 * Полноэкранный оверлей мини-игры поверх игры (паттерн меню: фокус-ловушка,
 * Escape, BackButton). Интро → партия → результат; пауза по кнопке и по
 * сворачиванию вкладки. Выход посреди партии награды не даёт.
 */
export default function MinigameOverlay({
  id,
  config,
  best,
  stage,
  mood,
  appearance,
  result,
  onFinish,
  onRestart,
  onClose,
}: MinigameOverlayProps) {
  const str = useStrings()
  const panelRef = useRef<HTMLElement>(null)
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)
  const [gameKey, setGameKey] = useState(0)

  // Escape и BackButton: в партии — пауза (случайный выход не роняет прогресс),
  // на интро и результате — закрытие
  const backRef = useRef<() => void>(() => {})
  backRef.current = () => {
    if (result !== null || !started) onClose()
    else setPaused(true)
  }
  const stableBack = useCallback(() => backRef.current(), [])
  useDialogFocus(panelRef, true, stableBack)

  useEffect(() => {
    const btn = tg()?.BackButton
    if (!btn) return
    btn.show()
    const onBack = () => backRef.current()
    btn.onClick(onBack)
    return () => {
      btn.offClick(onBack)
      btn.hide()
    }
  }, [])

  // свернули вкладку/мини-апп — партия встаёт на паузу
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPaused(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const finishRef = useRef(onFinish)
  finishRef.current = onFinish
  const handleOver = useCallback((outcome: MinigameOutcome) => finishRef.current(outcome), [])

  const start = () => {
    hapticTap()
    setStarted(true)
    setPaused(false)
  }
  const restart = () => {
    hapticTap()
    onRestart()
    setGameKey((k) => k + 1)
    setPaused(false)
  }
  const resume = () => {
    hapticTap()
    setPaused(false)
  }

  const playing = started && result === null

  return (
    <div className="mg-root">
      <section
        className="mg-screen"
        role="dialog"
        aria-modal="true"
        aria-label={str.game[id].title}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="mg-head">
          <p className="mg-title">{str.game[id].title}</p>
          {playing && (
            <button type="button" className="tool-btn" onClick={resume} aria-label={str.mgPause}>
              {paused ? '▶️' : '⏸'}
            </button>
          )}
        </header>

        {result !== null ? (
          <div className="mg-panel">
            <PetBadge stage={stage} mood={result.won ? 'happy' : 'sad'} appearance={appearance} className="mg-pet" />
            <p className="mg-big">{result.score}</p>
            {result.isRecord ? (
              <p className="mg-record">{str.mgNewRecord}</p>
            ) : best !== null ? (
              <p className="mg-note">{str.mgBest(best)}</p>
            ) : null}
            {result.bonus > 0 ? (
              <p className="mg-note">{str.mgBonus(result.bonus)}</p>
            ) : !result.won ? (
              <p className="mg-note">{str.mgLost}</p>
            ) : null}
            <button type="button" className="mg-btn" onClick={restart}>
              {str.mgAgain}
            </button>
            <button type="button" className="mg-btn ghost" onClick={onClose}>
              {str.mgDone}
            </button>
          </div>
        ) : !started ? (
          <div className="mg-panel">
            <PetBadge stage={stage} mood={mood} appearance={appearance} className="mg-pet" />
            <p className="mg-hint">{str.game[id].hint}</p>
            {best !== null && <p className="mg-chip">{str.mgBest(best)}</p>}
            <button type="button" className="mg-btn" onClick={start}>
              {str.mgStart}
            </button>
          </div>
        ) : (
          <div className="mg-area">
            {id === 'memory' && <MemoryGame key={gameKey} config={config} running={!paused} onOver={handleOver} />}
            {id === 'runner' && (
              <RunnerGame key={gameKey} config={config} appearance={appearance} running={!paused} onOver={handleOver} />
            )}
            {id === 'flappy' && (
              <FlappyGame key={gameKey} config={config} appearance={appearance} running={!paused} onOver={handleOver} />
            )}
            {id === 'snake' && (
              <SnakeGame key={gameKey} config={config} appearance={appearance} running={!paused} onOver={handleOver} />
            )}
            {id === 'bubbles' && (
              <BubblesGame key={gameKey} config={config} running={!paused} onOver={handleOver} />
            )}
            {paused && (
              <div className="mg-veil">
                <p className="mg-veil-title">{str.mgPause}</p>
                <button type="button" className="mg-btn" onClick={resume}>
                  {str.mgResume}
                </button>
                <button type="button" className="mg-btn ghost" onClick={onClose}>
                  {str.mgExit}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
