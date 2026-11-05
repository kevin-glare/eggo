import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, type GameConfig } from '../src/game/config'
import { feedCatch } from '../src/game/actions'
import {
  createFeeding,
  feedTap,
  FEEDING_WORLD,
  stepFeeding,
  type FeedingBalance,
} from '../src/game/feeding'
import { hatchedPet } from './helpers'

const F: FeedingBalance = DEFAULT_CONFIG.feeding
const config: GameConfig = DEFAULT_CONFIG

/** rng-скрипт: спавн вызовет rng дважды — «мусор?» и «x в полосе». */
function scripted(seq: number[]): () => number {
  let i = 0
  return () => seq[i++ % seq.length]!
}

/** Съедобный предмет над x: 0.9 — не мусор, вторая — нормированный x. */
function edibleAt(x: number): () => number {
  return scripted([0.9, (x - FEEDING_WORLD.bandMin) / (FEEDING_WORLD.bandMax - FEEDING_WORLD.bandMin)])
}

/** Несъедобный предмет над x. */
function junkAt(x: number): () => number {
  return scripted([0.05, (x - FEEDING_WORLD.bandMin) / (FEEDING_WORLD.bandMax - FEEDING_WORLD.bandMin)])
}

describe('feeding — ядро кормления-ловли', () => {
  it('тап переносит питомца в пределах полосы', () => {
    let s = createFeeding(F, 50)
    s = feedTap(s, 50)
    s = stepFeeding(s, 16, F, 50, () => 0.99)
    expect(s.targetX).toBe(FEEDING_WORLD.bandMin) // зажато к полосе
    s = feedTap(s, FEEDING_WORLD.w / 2)
    for (let i = 0; i < 60; i += 1) s = stepFeeding(s, 16, F, 50, () => 0.99)
    expect(s.petX).toBeCloseTo(FEEDING_WORLD.w / 2, 0)
  })

  it('питомец ловит еду, подбежав под тап', () => {
    let s = createFeeding(F, 50)
    const x = FEEDING_WORLD.bandMin + 30
    s = feedTap(s, x)
    // ждём предмет и его падение до линии рта
    let sawCatch = false
    for (let i = 0; i < 800 && !s.over; i += 1) {
      s = stepFeeding(s, 16, F, 50, edibleAt(x))
      if (s.events.some((e) => e.kind === 'catch')) sawCatch = true
      if (sawCatch) break
    }
    expect(sawCatch).toBe(true)
    expect(s.caught).toBe(1)
    expect(s.streak).toBe(1)
  })

  it('промах: еда падает на землю, серия сбрасывается', () => {
    let s = createFeeding(F, 50)
    s = feedTap(s, FEEDING_WORLD.bandMin) // стоим у левого края
    let sawMiss = false
    for (let i = 0; i < 900 && !s.over; i += 1) {
      s = stepFeeding(s, 16, F, 50, edibleAt(200)) // еда падает далеко
      if (s.events.some((e) => e.kind === 'miss')) sawMiss = true
      if (sawMiss) break
    }
    expect(sawMiss).toBe(true)
    expect(s.missed).toBe(1)
    expect(s.streak).toBe(0)
  })

  it('несъедобное оглушает и сбрасывает серию, очков не даёт', () => {
    let s = createFeeding(F, 50)
    const x = FEEDING_WORLD.bandMin + 30
    s = { ...s, streak: 2 }
    s = feedTap(s, x)
    let sawJunk = false
    for (let i = 0; i < 900 && !s.over; i += 1) {
      s = stepFeeding(s, 16, F, 50, junkAt(x))
      if (s.events.some((e) => e.kind === 'junk')) sawJunk = true
      if (sawJunk) break
    }
    expect(sawJunk).toBe(true)
    expect(s.caught).toBe(0) // банка не считается пойманной едой
    expect(s.streak).toBe(0)
    expect(s.stunnedMsLeft).toBeGreaterThan(0)
    // в ступоре питомец не бежит
    const stood = s.petX
    const next = stepFeeding(s, 100, F, 50, junkAt(x))
    expect(next.petX).toBe(stood)
  })

  it('перекорм: сытость добита — сессия кончается «объелся»', () => {
    // startFullness 96, perFood 8: один пойманный — сотня
    let s = createFeeding(F, 96)
    const x = 160
    s = feedTap(s, x)
    for (let i = 0; i < 900 && !s.over; i += 1) s = stepFeeding(s, 16, F, 96, edibleAt(x))
    expect(s.over).toBe(true)
    expect(s.ended).toBe('full')
    expect(s.caught).toBe(1)
  })

  it('предметы кончились — сессия сыграна («done»)', () => {
    let s = createFeeding(F, 50)
    for (let i = 0; i < 6000 && !s.over; i += 1) s = stepFeeding(s, 16, F, 50, () => 0.99)
    expect(s.over).toBe(true)
    expect(s.ended).toBe('done')
    expect(s.spawned).toBe(F.spawnCount)
  })
})

describe('feedCatch — применение итога сессии', () => {
  it('сытость капает за пойманное, не выше сотни', () => {
    const pet = hatchedPet(config, {}, { fullness: 60 })
    const result = feedCatch(pet, 3, config, 0)
    expect(result.ok).toBe(true)
    expect(result.state.stats.fullness).toBe(84)
    expect(result.state.overfedUntil).toBe(0)
  })

  it('просьба «покормить» удваивает эффект и закрывается', () => {
    const pet = hatchedPet(config, { request: { kind: 'feed', expiresAt: 1 } }, { fullness: 60 })
    const result = feedCatch(pet, 2, config, 0)
    expect(result.requestBonus).toBe(true)
    expect(result.state.request).toBeNull()
    expect(result.state.stats.fullness).toBe(60 + 2 * F.perFood * 2)
  })

  it('перекорм: сотня пробита — питомец отдыхает overfedMs', () => {
    const pet = hatchedPet(config, {}, { fullness: 96 })
    const result = feedCatch(pet, 2, config, 1000)
    expect(result.state.stats.fullness).toBe(100)
    expect(result.state.overfedUntil).toBe(1000 + config.feeding.overfedMs)
  })

  it('полная сытость с порога не считается перееданием', () => {
    const pet = hatchedPet(config, {}, { fullness: 100 })
    const result = feedCatch(pet, 2, config, 1000)
    expect(result.state.overfedUntil).toBe(0)
  })

  it('пока отдыхает после объедения — мягкий отказ', () => {
    const pet = hatchedPet(config, { overfedUntil: 5_000 }, { fullness: 50 })
    const result = feedCatch(pet, 2, config, 1_000)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('overfed')
    // после срока — снова ест
    expect(feedCatch(pet, 2, config, 6_000).ok).toBe(true)
  })

  it('спящего не кормим', () => {
    const pet = hatchedPet(config, { sleeping: true })
    expect(feedCatch(pet, 2, config, 0).reason).toBe('sleeping')
  })

  it('ничего не поймали — сессия без эффекта', () => {
    const pet = hatchedPet(config, {}, { fullness: 60 })
    const result = feedCatch(pet, 0, config, 0)
    expect(result.ok).toBe(true)
    expect(result.state.stats.fullness).toBe(60)
  })
})
