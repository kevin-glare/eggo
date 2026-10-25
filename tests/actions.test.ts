import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import { feed, play, startSleep, wake, wash } from '../src/game/actions'
import { hatchedPet, makePet } from './helpers'

describe('feed', () => {
  it('повышает сытость', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, {}, { fullness: 40 })
    const result = feed(pet, DEFAULT_CONFIG)
    expect(result.ok).toBe(true)
    expect(result.state.stats.fullness).toBe(40 + DEFAULT_CONFIG.actions.feed.fullness)
  })

  it('не поднимает сытость выше 100', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, {}, { fullness: 90 })
    const result = feed(pet, DEFAULT_CONFIG)
    expect(result.state.stats.fullness).toBe(100)
  })

  it('отклоняется в яйце', () => {
    const result = feed(makePet(DEFAULT_CONFIG), DEFAULT_CONFIG)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not-hatched')
  })

  it('отклоняется во сне', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { sleeping: true })
    const result = feed(pet, DEFAULT_CONFIG)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('sleeping')
  })
})

describe('play', () => {
  it('повышает счастье и тратит энергию', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, {}, { happiness: 50, energy: 80 })
    const result = play(pet, DEFAULT_CONFIG)
    expect(result.ok).toBe(true)
    expect(result.state.stats.happiness).toBe(50 + DEFAULT_CONFIG.actions.play.happiness)
    expect(result.state.stats.energy).toBe(80 - DEFAULT_CONFIG.actions.play.energy)
  })

  it('отказывает при нехватке энергии', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, {}, { energy: 10 })
    const result = play(pet, DEFAULT_CONFIG)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('too-tired')
    expect(result.state).toEqual(pet)
  })
})

describe('wash', () => {
  it('повышает чистоту', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, {}, { cleanliness: 30 })
    const result = wash(pet, DEFAULT_CONFIG)
    expect(result.ok).toBe(true)
    expect(result.state.stats.cleanliness).toBe(70)
  })
})

describe('sleep / wake', () => {
  it('укладывает спать не-яйцо', () => {
    const result = startSleep(hatchedPet(DEFAULT_CONFIG))
    expect(result.ok).toBe(true)
    expect(result.state.sleeping).toBe(true)
  })

  it('яйцо не может уснуть', () => {
    const result = startSleep(makePet(DEFAULT_CONFIG))
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('not-hatched')
  })

  it('wake будит', () => {
    const result = wake(hatchedPet(DEFAULT_CONFIG, { sleeping: true }))
    expect(result.state.sleeping).toBe(false)
  })
})

describe('чистота функций', () => {
  it('ни одно действие не мутирует исходное состояние', () => {
    const pet = hatchedPet(DEFAULT_CONFIG)
    const before = structuredClone(pet)
    feed(pet, DEFAULT_CONFIG)
    wash(pet, DEFAULT_CONFIG)
    play(pet, DEFAULT_CONFIG)
    wake(pet)
    expect(pet).toEqual(before)
  })
})
