/**
 * Кормление-ловля: еда падает сверху, питомец бежит под тап и ловит ртом.
 * Несъедобное дезориентирует (ступор и сброс серии), промах грустит,
 * перекорм (сытость добита за сессию) заканчивает партию «объелся».
 *
 * Чистое ядро в координатах сцены (ширина/высота совпадают с petArt,
 * но слои не связаны: ui рисует мир по этим константам). rng снаружи.
 */

export const FEEDING_WORLD = {
  w: 390,
  h: 420,
  groundY: 348,
  /** линия рта: еда ловится, когда долетает до неё */
  mouthY: 288,
  /** безопасная полоса падения: бока канваса режутся cover'ом */
  bandMin: 110,
  bandMax: 280,
} as const

export interface FeedingBalance {
  /** +сытости за пойманное (решение о перекорме — вместе со стартовой сытостью) */
  perFood: number
  /** сколько предметов упадёт за сессию */
  spawnCount: number
  /** мс между предметами */
  spawnIntervalMs: number
  /** скорость падения, px/с */
  fallSpeed: number
  /** половина ширины зоны поимки, px */
  catchHalfWidth: number
  /** скорость бега к тапу, px/с */
  runSpeed: number
  /** доля несъедобного среди падающего */
  junkChance: number
  /** серия пойманных подряд для усиленной радости */
  streakN: number
  /** ступор от несъедобного, мс */
  stunMs: number
}

export interface FoodItem {
  id: number
  x: number
  y: number
  kind: 'edible' | 'junk'
  /** решена судьба: поймано или разбилось о землю */
  resolved: boolean
}

/** Что случилось на шаге — UI разыгрывает реакцию питомца. */
export type FeedEvent =
  | { kind: 'catch'; x: number; y: number }
  | { kind: 'junk'; x: number; y: number }
  | { kind: 'miss'; x: number; y: number }

export interface FeedingState {
  petX: number
  targetX: number | null
  items: FoodItem[]
  caught: number
  missed: number
  streak: number
  /** события шага: реагирует UI, ядро только сообщает */
  events: FeedEvent[]
  stunnedMsLeft: number
  spawned: number
  nextSpawnMsLeft: number
  over: boolean
  /** чем кончилось: сытость добита («объелся») или предметы кончились */
  ended: 'full' | 'done' | null
}

export function createFeeding(balance: FeedingBalance, startFullness: number): FeedingState {
  const state: FeedingState = {
    petX: (FEEDING_WORLD.bandMin + FEEDING_WORLD.bandMax) / 2,
    targetX: null,
    items: [],
    caught: 0,
    missed: 0,
    streak: 0,
    events: [],
    stunnedMsLeft: 0,
    spawned: 0,
    nextSpawnMsLeft: 600,
    over: false,
    ended: null,
  }
  // сытый питомец с порога объедается: первый же пойманный — конец
  return checkFull(state, balance, startFullness)
}

/** Тап: питомец бежит под точку тапа (в пределах полосы). */
export function feedTap(state: FeedingState, x: number): FeedingState {
  if (state.over) return state
  const targetX = Math.min(FEEDING_WORLD.bandMax, Math.max(FEEDING_WORLD.bandMin, x))
  return { ...state, targetX }
}

export function stepFeeding(
  state: FeedingState,
  dtMs: number,
  balance: FeedingBalance,
  startFullness: number,
  rng: () => number,
): FeedingState {
  if (state.over) return state
  const dt = dtMs / 1000
  const events: FeedEvent[] = []

  // ступор от несъедобного: стоит, ловить не может
  const stunnedMsLeft = Math.max(0, state.stunnedMsLeft - dtMs)
  const stunned = stunnedMsLeft > 0

  // бег к тапу
  let petX = state.petX
  if (!stunned && state.targetX !== null) {
    const dx = state.targetX - petX
    const step = balance.runSpeed * dt
    if (Math.abs(dx) <= step) {
      petX = state.targetX
    } else {
      petX += Math.sign(dx) * step
    }
  }

  // падение еды и поимка на линии рта
  const items: FoodItem[] = []
  let caught = state.caught
  let missed = state.missed
  let streak = state.streak
  let stunSet = 0
  for (const item of state.items) {
    if (item.resolved) continue
    const y = item.y + balance.fallSpeed * dt
    if (y >= FEEDING_WORLD.mouthY) {
      const inZone = !stunned && Math.abs(item.x - petX) <= balance.catchHalfWidth
      if (inZone) {
        items.push({ ...item, y, resolved: true })
        if (item.kind === 'junk') {
          // несъедобное: не еда — сытости не даёт, только дезориентирует
          streak = 0
          stunSet = balance.stunMs
          events.push({ kind: 'junk', x: item.x, y: FEEDING_WORLD.mouthY })
        } else {
          caught += 1
          streak += 1
          events.push({ kind: 'catch', x: item.x, y: FEEDING_WORLD.mouthY })
        }
      } else if (y >= FEEDING_WORLD.groundY) {
        items.push({ ...item, y: FEEDING_WORLD.groundY, resolved: true })
        if (item.kind === 'edible') {
          missed += 1
          streak = 0
          events.push({ kind: 'miss', x: item.x, y: FEEDING_WORLD.groundY })
        }
      } else {
        items.push({ ...item, y })
      }
    } else {
      items.push({ ...item, y })
    }
  }

  // спавн по расписанию
  let spawned = state.spawned
  let nextSpawnMsLeft = state.nextSpawnMsLeft - dtMs
  if (nextSpawnMsLeft <= 0 && spawned < balance.spawnCount) {
    const junk = rng() < balance.junkChance
    items.push({
      id: spawned,
      x: FEEDING_WORLD.bandMin + rng() * (FEEDING_WORLD.bandMax - FEEDING_WORLD.bandMin),
      y: -20,
      kind: junk ? 'junk' : 'edible',
      resolved: false,
    })
    spawned += 1
    nextSpawnMsLeft += balance.spawnIntervalMs
  }

  let next: FeedingState = {
    ...state,
    petX,
    items,
    caught,
    missed,
    streak,
    events,
    stunnedMsLeft: stunSet > 0 ? stunSet : stunnedMsLeft,
    spawned,
    nextSpawnMsLeft,
  }

  // перекорм: сытость добита пойманным — «объелся», партия кончена
  next = checkFull(next, balance, startFullness)

  // всё упало и решилось — сессия сыграна
  const allResolved = next.spawned >= balance.spawnCount && next.items.every((i) => i.resolved)
  if (!next.over && allResolved) {
    next = { ...next, over: true, ended: 'done' }
  }
  return next
}

/** Сытость с учётом пойманного; добита до сотни — объелся. */
function checkFull(state: FeedingState, balance: FeedingBalance, startFullness: number): FeedingState {
  if (state.over) return state
  const fullness = Math.min(100, startFullness + state.caught * balance.perFood)
  if (fullness >= 100 && startFullness < 100) {
    return { ...state, over: true, ended: 'full' }
  }
  return state
}
