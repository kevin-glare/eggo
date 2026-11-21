import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import {
  applyTraitHappiness,
  characterLevels,
  countTrait,
  traitHappinessBonus,
  traitLevel,
} from '../src/game/character'
import { deserialize, mergeStates, serialize } from '../src/game/storage'
import { hatchedPet, TEST_APPEARANCE } from './helpers'

const CFG = DEFAULT_CONFIG

describe('characterLevels', () => {
  it('пустые счётчики — все черты в нуле', () => {
    const pet = hatchedPet(CFG)
    expect(characterLevels(pet, CFG)).toEqual({ sweetTooth: 0, playful: 0, affectionate: 0 })
  })

  it('пороги уровней: 5/20/50 дают уровни 1/2/3', () => {
    expect(traitLevel(4, CFG)).toBe(0)
    expect(traitLevel(5, CFG)).toBe(1)
    expect(traitLevel(19, CFG)).toBe(1)
    expect(traitLevel(20, CFG)).toBe(2)
    expect(traitLevel(50, CFG)).toBe(3)
    expect(traitLevel(500, CFG)).toBe(3)
  })

  it('счётчик растёт только у своей черты', () => {
    let pet = hatchedPet(CFG)
    for (let i = 0; i < 5; i++) pet = countTrait(pet, 'sweetTooth')
    expect(pet.character.dishesFed).toBe(5)
    expect(pet.character.gamesPlayed).toBe(0)
    expect(pet.character.petsGiven).toBe(0)
    expect(characterLevels(pet, CFG).sweetTooth).toBe(1)
  })

  it('не мутирует исходное состояние', () => {
    const pet = hatchedPet(CFG)
    const before = structuredClone(pet)
    countTrait(pet, 'playful')
    expect(pet).toEqual(before)
  })
})

describe('бонусы черт', () => {
  it('до порога бонусов (уровень 2) бонуса нет', () => {
    let pet = hatchedPet(CFG)
    for (let i = 0; i < 5; i++) pet = countTrait(pet, 'sweetTooth') // уровень 1
    expect(traitHappinessBonus(pet, 'sweetTooth', CFG)).toBe(0)
    for (let i = 0; i < 15; i++) pet = countTrait(pet, 'sweetTooth') // уровень 2
    expect(traitHappinessBonus(pet, 'sweetTooth', CFG)).toBe(CFG.character.dish)
  })

  it('непоседа и неженка дают свои бонусы на втором уровне', () => {
    let pet = hatchedPet(CFG)
    for (let i = 0; i < 20; i++) pet = countTrait(pet, 'playful')
    expect(traitHappinessBonus(pet, 'playful', CFG)).toBe(CFG.character.party)
    for (let i = 0; i < 20; i++) pet = countTrait(pet, 'affectionate')
    expect(traitHappinessBonus(pet, 'affectionate', CFG)).toBe(CFG.character.pet)
  })

  it('бонус счастья прибавляется и не перепрыгивает сотню', () => {
    const pet = hatchedPet(CFG, {}, { happiness: 99 })
    const grown = applyTraitHappiness(pet, 2)
    expect(grown.stats.happiness).toBe(100)
    // нулевой и отрицательный бонус — состояние без изменений
    expect(applyTraitHappiness(pet, 0)).toBe(pet)
  })
})

describe('нормализация характера в сейве', () => {
  it('характер переживает сериализацию', () => {
    let pet = hatchedPet(CFG)
    pet = countTrait(countTrait(pet, 'sweetTooth'), 'playful')
    const back = deserialize(serialize(pet), TEST_APPEARANCE)
    expect(back?.character).toEqual({ dishesFed: 1, gamesPlayed: 1, petsGiven: 0 })
  })

  it('старый сейв без характера — счётчики в нуле', () => {
    const pet = hatchedPet(CFG)
    const raw = JSON.parse(serialize(pet)) as { pet: Record<string, unknown> }
    delete raw.pet.character
    const back = deserialize(JSON.stringify(raw), TEST_APPEARANCE)
    expect(back?.character).toEqual({ dishesFed: 0, gamesPlayed: 0, petsGiven: 0 })
  })

  it('битые счётчики отбрасываются', () => {
    const pet = hatchedPet(CFG)
    const raw = JSON.parse(serialize(pet)) as { pet: { character: Record<string, unknown> } }
    raw.pet.character.dishesFed = 'много'
    raw.pet.character.gamesPlayed = -3
    const back = deserialize(JSON.stringify(raw), TEST_APPEARANCE)
    expect(back?.character).toEqual({ dishesFed: 0, gamesPlayed: 0, petsGiven: 0 })
  })
})

describe('слияние девайсов', () => {
  it('счётчики характера — максимум с двух сторон', () => {
    const a = countTrait(countTrait(countTrait(hatchedPet(CFG), 'sweetTooth'), 'sweetTooth'), 'playful')
    const b = countTrait(countTrait(hatchedPet(CFG), 'affectionate'), 'affectionate')
    const merged = mergeStates(a, b, CFG)
    expect(merged.character).toEqual({ dishesFed: 2, gamesPlayed: 1, petsGiven: 2 })
  })

  it('перешагнувший порог на одном девайсе не теряет черту после слияния', () => {
    const a = hatchedPet(CFG)
    let b = hatchedPet(CFG)
    for (let i = 0; i < 20; i++) b = countTrait(b, 'affectionate')
    expect(characterLevels(mergeStates(a, b, CFG), CFG).affectionate).toBe(2)
  })
})
