/**
 * «Память»: находи пары карточек. Партия бесконечна: собранный ряд
 * добавляет время и открывает следующий — на пару больше, и таймер
 * тикает быстрее. Чистое ядро: состояние → новое состояние.
 * Случайность (перетасовка) приходит снаружи через rng — тесты
 * детерминированы.
 */

export interface MemoryBalance {
  /** сколько пар на поле в первом ряду */
  pairs: number
  /** стартовое время партии, мс */
  timeLimitMs: number
  /** сколько мс добавляет собранный ряд */
  levelBonusMs: number
  /** сколько пар прибавляется за каждый следующий ряд */
  pairsPerLevel: number
  /** предел пар на поле */
  pairsMax: number
  /** насколько таймер тикает быстрее за каждый собранный ряд (доля от 1) */
  timerRamp: number
  /** потолок скорости тика, ×N от реального времени */
  timerRateMax: number
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
  /** собранных пар за всю партию (счёт = ×10) */
  matchedPairs: number
  /** номер ряда, с 1 */
  level: number
  timeLeftMs: number
  over: boolean
}

/** Сколько мс игрок видит несовпавшую пару, прежде чем карточки закроются. */
const MISMATCH_SHOW_MS = 700

/** Сколько пар на поле в этом ряду: рост ограничен pairsMax. */
export function memoryLevelPairs(balance: MemoryBalance, level: number): number {
  return Math.min(balance.pairsMax, balance.pairs + (level - 1) * balance.pairsPerLevel)
}

/** Во сколько раз таймер тикает быстрее в этом ряду: +timerRamp за ряд, потолок timerRateMax. */
export function memoryTimerRate(balance: MemoryBalance, level: number): number {
  return Math.min(balance.timerRateMax, 1 + (level - 1) * balance.timerRamp)
}

/** Перетасованная колода на pairs пар (Фишер—Йетс). */
function makeDeck(pairs: number, rng: () => number): MemoryCard[] {
  const kinds: number[] = []
  for (let k = 0; k < pairs; k++) kinds.push(k, k)
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = kinds[i]!
    kinds[i] = kinds[j]!
    kinds[j] = t
  }
  return kinds.map((kind) => ({ kind, flipped: false, matched: false }))
}

export function createMemory(balance: MemoryBalance, rng: () => number): MemoryState {
  return {
    cards: makeDeck(memoryLevelPairs(balance, 1), rng),
    open: [],
    closeInMs: null,
    matchedPairs: 0,
    level: 1,
    timeLeftMs: balance.timeLimitMs,
    over: false,
  }
}

/** Открыть карточку: одна — просто открывается; вторая — решает пару
 *  (rng нужен, когда пара закрывает ряд — разыгрывается новая колода). */
export function flipMemory(state: MemoryState, index: number, balance: MemoryBalance, rng: () => number): MemoryState {
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
    const levelPairs = cards.length / 2
    const levelMatched = cards.filter((c) => c.matched).length / 2
    if (levelMatched < levelPairs) return { ...opened, cards, open: [], matchedPairs }
    // ряд собран: новый ряд больше, время продлевается — партия бесконечна
    const nextLevel = state.level + 1
    return {
      cards: makeDeck(memoryLevelPairs(balance, nextLevel), rng),
      open: [],
      closeInMs: null,
      matchedPairs,
      level: nextLevel,
      timeLeftMs: state.timeLeftMs + balance.levelBonusMs,
      over: false,
    }
  }
  // мимо: пара остаётся видимой на миг, время тикает — ходов не штрафуем
  return { ...opened, closeInMs: MISMATCH_SHOW_MS }
}

/** Шаг времени: таймер тикает (в поздних рядах быстрее реального времени),
 *  созревшая несовпавшая пара закрывается. */
export function stepMemory(state: MemoryState, dtMs: number, balance: MemoryBalance): MemoryState {
  if (state.over) return state
  let next = state
  if (state.closeInMs !== null) {
    const closeInMs = state.closeInMs - dtMs
    next = closeInMs <= 0 ? closePair(state) : { ...state, closeInMs }
  }
  const timeLeftMs = Math.max(0, next.timeLeftMs - dtMs * memoryTimerRate(balance, state.level))
  if (timeLeftMs === 0) return { ...next, timeLeftMs, over: true }
  return { ...next, timeLeftMs }
}

/** Счёт: 10 за каждую собранную пару. */
export function memoryScore(state: MemoryState): number {
  return state.matchedPairs * 10
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
