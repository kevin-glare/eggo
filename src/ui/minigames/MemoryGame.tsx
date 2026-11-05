import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameConfig } from '../../game/config'
import { createMemory, flipMemory, memoryScore, stepMemory, type MemoryState } from '../../game/minigames/memory'
import type { MinigameOutcome } from '../../game/minigames/types'
import { hapticTap } from '../../telegram'
import { useStrings } from '../i18n'
import { playSound } from '../sound'

interface MemoryGameProps {
  config: GameConfig
  /** false — пауза оверлея: таймер стоит, тапы не считаются */
  running: boolean
  /** партия доиграна (победа или время вышло); вызывается один раз */
  onOver: (outcome: MinigameOutcome) => void
}

/** Еда на карточках — тема Eggo. Вида́ должно быть не меньше config pairs. */
const CARD_KINDS = ['🍓', '🍎', '🥕', '🌽', '🍗', '🥚', '🍪', '🍭'] as const

/** Как часто тикает таймер (мс и шаг ядра — совпадают, чтобы не плыть). */
const TICK_MS = 200
/** Мгновение тишины после последней пары, прежде чем показать итог. */
const SETTLE_MS = 700

/** «Память»: DOM-сетка карточек в языке конфетных кнопок. */
export default function MemoryGame({ config, running, onOver }: MemoryGameProps) {
  const str = useStrings()
  const balance = config.minigames.memory
  const [state, setState] = useState<MemoryState>(() => createMemory(balance, Math.random))
  const overRef = useRef(false)
  const onOverRef = useRef(onOver)
  onOverRef.current = onOver

  // таймер партии: стоит на паузе и после конца
  useEffect(() => {
    if (!running || state.over) return
    const id = window.setInterval(() => setState((s) => (s.over ? s : stepMemory(s, TICK_MS))), TICK_MS)
    return () => window.clearInterval(id)
  }, [running, state.over])

  // конец партии: дать увидеть последнюю пару, затем отдать итог
  useEffect(() => {
    if (!state.over || overRef.current) return
    overRef.current = true
    const outcome: MinigameOutcome = { score: memoryScore(state), won: state.won }
    const timer = window.setTimeout(() => onOverRef.current(outcome), SETTLE_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.over, state.won])

  const flip = useCallback(
    (index: number) => {
      if (!running) return
      const card = state.cards[index]
      if (!card || card.matched || card.flipped) return
      hapticTap()
      playSound('tap')
      // вторая карточка решает пару: совпала — дзынь
      const first = state.open[0]
      if (first !== undefined && state.cards[first]?.kind === card.kind) playSound('ding')
      setState((s) => flipMemory(s, index, balance))
    },
    [balance, running, state.cards],
  )

  const seconds = Math.ceil(state.timeLeftMs / 1000)
  const pairsLeft = balance.pairs - state.matchedPairs

  return (
    <div className="mg-memory">
      <div className="mg-timer" role="timer" aria-label={str.mgTime(seconds)}>
        <div className="mg-timer-fill" style={{ width: `${(state.timeLeftMs / balance.timeLimitMs) * 100}%` }} />
      </div>
      <div className="mg-grid">
        {state.cards.map((card, index) => {
          const face = CARD_KINDS[card.kind] ?? '🍓'
          const shown = card.flipped || card.matched
          return (
            <button
              type="button"
              key={index}
              className={card.matched ? 'mg-card matched' : card.flipped ? 'mg-card open' : 'mg-card'}
              disabled={!running && !card.matched}
              onClick={() => flip(index)}
              aria-label={
                shown ? `${face}${card.matched ? ` — ${str.mgMatched}` : ''}` : str.mgCardHidden
              }
            >
              <span className="mg-card-face" aria-hidden="true">
                {shown ? face : '🥚'}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mg-note">{pairsLeft > 0 ? str.mgPairsLeft(pairsLeft) : ''}</p>
    </div>
  )
}
