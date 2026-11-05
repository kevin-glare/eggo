/**
 * «Память»: найди все пары карточек, пока не вышло время.
 * Чистое ядро: состояние → новое состояние. Случайность (перетасовка)
 * приходит снаружи через rng — тесты детерминированы.
 */

export interface MemoryBalance {
  /** сколько пар на поле */
  pairs: number
  /** время на всю партию, мс */
  timeLimitMs: number
}

export interface MemoryCard {
  /** вид карточки: 0..pairs-1; пара = одинаковый вид (в UI — одинаковая еда) */
  kind: number
  flipped: boolean
  matched: boolean
}

export interface MemoryState {
  cards: MemoryCard[]
  /** индексы открытых, ещё не разреши́вшихся карточек: 0, 1 или 2 */
  open: number[]
  /** мс до закрытия несовпавшей пары; null — ничего не ждёт закрытия */
  closeInMs: number | null
  matchedPairs: number
  timeLeftMs: number
  over: boolean
  won: boolean
}

/** Сколько мс игрок видит несовпавшую пару, прежде чем карточки закроются. */
const MISMATCH_SHOW_MS = 700

export function createMemory(balance: MemoryBalance, rng: () => number): MemoryState {
  const kinds: number[] = []
  for (let k = 0; k < balance.pairs; k++) kinds.push(k, k)
  // перетасовка Фишера—Йетса
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = kinds[i]!
    kinds[i] = kinds[j]!
    kinds[j] = t
  }
  return {
    cards: kinds.map((kind) => ({ kind, flipped: false, matched: false })),
    open: [],
    closeInMs: null,
    matchedPairs: 0,
    timeLeftMs: balance.timeLimitMs,
    over: false,
    won: false,
  }
}

/** Открыть карточку: одна — просто открывается; вторая — решает пару. */
export function flipMemory(state: MemoryState, index: number, balance: MemoryBalance): MemoryState {
  if (state.over || state.closeInMs !== null) return state
  const card = state.cards[index]
  if (!card || card.matched || card.flipped) return state
  if (state.open.length === 0) {
    return withCard(state, index, { flipped: true }, [index])
  }
  const firstIndex = state.open[0]!
  const first = state.cards[firstIndex]!
  const opened = withCard(state, index, { flipped: true }, [firstIndex, index])
  if (first.kind === card.kind) {
    // пара найдена: обе уходят в «собранные»
    const cards = opened.cards.map((c, i) =>
      i === index || i === firstIndex ? { ...c, flipped: true, matched: true } : c,
    )
    const matchedPairs = state.matchedPairs + 1
    const won = matchedPairs === balance.pairs
    return { ...opened, cards, open: [], matchedPairs, won, over: won }
  }
  // мимо: пара остаётся видимой на миг, время тикает — ходов не штрафуем
  return { ...opened, closeInMs: MISMATCH_SHOW_MS }
}

/** Шаг времени: таймер тикает, созревшая несовпавшая пара закрывается. */
export function stepMemory(state: MemoryState, dtMs: number): MemoryState {
  if (state.over) return state
  let next = state
  if (state.closeInMs !== null) {
    const closeInMs = state.closeInMs - dtMs
    next = closeInMs <= 0 ? closePair(state) : { ...state, closeInMs }
  }
  const timeLeftMs = Math.max(0, next.timeLeftMs - dtMs)
  if (timeLeftMs === 0) return { ...next, timeLeftMs, over: true, won: false }
  return { ...next, timeLeftMs }
}

/** Счёт: 10 за пару, при полной победе — плюс секунды, оставшиеся на таймере. */
export function memoryScore(state: MemoryState): number {
  return state.matchedPairs * 10 + (state.won ? Math.ceil(state.timeLeftMs / 1000) : 0)
}

function withCard(state: MemoryState, index: number, patch: Partial<MemoryCard>, open: number[]): MemoryState {
  return {
    ...state,
    cards: state.cards.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    open,
  }
}

function closePair(state: MemoryState): MemoryState {
  return {
    ...state,
    cards: state.cards.map((c, i) => (state.open.includes(i) ? { ...c, flipped: false } : c)),
    open: [],
    closeInMs: null,
  }
}
