import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, type GameConfig } from '../src/game/config'
import { activateItem, buyItem, earnStars, itemById } from '../src/game/economy'
import { hatchedPet } from './helpers'

describe('earnStars', () => {
  it('начисляет звёздочки', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { stars: 10 })
    expect(earnStars(pet, 5).stars).toBe(15)
  })

  it('отрицательная и нулевая сумма — ничего, дробная округляется вниз', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { stars: 10 })
    expect(earnStars(pet, -3).stars).toBe(10)
    expect(earnStars(pet, 0).stars).toBe(10)
    expect(earnStars(pet, 2.9).stars).toBe(12)
  })

  it('нулевое начисление возвращает тот же объект', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { stars: 1 })
    expect(earnStars(pet, 0)).toBe(pet)
  })

  it('не мутирует исходное состояние', () => {
    const pet = hatchedPet(DEFAULT_CONFIG, { stars: 1 })
    earnStars(pet, 4)
    expect(pet.stars).toBe(1)
  })
})

describe('itemById', () => {
  it('находит товар каталога; неизвестный id — null', () => {
    expect(itemById(DEFAULT_CONFIG, 'dish-cake')?.price).toBe(DEFAULT_CONFIG.shop.items[0]!.price)
    expect(itemById(DEFAULT_CONFIG, 'nope')).toBeNull()
  })
})

describe('buyItem', () => {
  const CFG = DEFAULT_CONFIG

  it('блюдо списывает звёздочки и занимает слот «подано»', () => {
    const pet = hatchedPet(CFG, { stars: 10 })
    const res = buyItem(pet, 'dish-cake', CFG)
    expect(res.ok).toBe(true)
    expect(res.state.stars).toBe(10 - CFG.shop.items[0]!.price)
    expect(res.state.dish).toBe('dish-cake')
  })

  it('не хватает звёздочек — отказ без списания', () => {
    const pet = hatchedPet(CFG, { stars: 3 })
    const res = buyItem(pet, 'dish-cake', CFG)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('no-stars')
    expect(res.state.stars).toBe(3)
  })

  it('слот блюда занят — второй не продаём до кормления', () => {
    const pet = hatchedPet(CFG, { stars: 50, dish: 'dish-cake' })
    const res = buyItem(pet, 'dish-feast', CFG)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('dish-active')
    expect(res.state.stars).toBe(50)
  })

  it('неизвестный товар — отказ', () => {
    expect(buyItem(hatchedPet(CFG, { stars: 50 }), 'nope', CFG).reason).toBe('unknown-item')
  })

  it('косметика: покупка кладёт в owned и активирует; повторно не продаём', () => {
    const cfg: GameConfig = {
      ...CFG,
      shop: { ...CFG.shop, items: [...CFG.shop.items, { id: 'acc-hat', kind: 'accessory', price: 25, emoji: '🧢', accSlot: 'head' }] },
    }
    const res = buyItem(hatchedPet(CFG, { stars: 30 }), 'acc-hat', cfg)
    expect(res.ok).toBe(true)
    expect(res.state.cosmetics.owned).toEqual(['acc-hat'])
    expect(res.state.cosmetics.accessories.head).toBe('acc-hat')
    expect(buyItem(res.state, 'acc-hat', cfg).reason).toBe('already-owned')
  })

  it('декор: покупка занимает свой слот', () => {
    const cfg: GameConfig = {
      ...CFG,
      shop: {
        ...CFG.shop,
        items: [...CFG.shop.items, { id: 'dec-flower', kind: 'decor', price: 10, emoji: '🌸', decorSlot: 'meadow' as const }],
      },
    }
    const res = buyItem(hatchedPet(CFG, { stars: 20 }), 'dec-flower', cfg)
    expect(res.ok).toBe(true)
    expect(res.state.cosmetics.decor.meadow).toBe('dec-flower')
  })
})

describe('activateItem', () => {
  const CFG = DEFAULT_CONFIG
  const cfgWithDeco: GameConfig = {
    ...CFG,
    shop: {
      ...CFG.shop,
      items: [...CFG.shop.items, { id: 'dec-flower', kind: 'decor', price: 10, emoji: '🌸', decorSlot: 'meadow' as const }],
    },
  }

  it('декор — тумблер слота: включение и снятие', () => {
    const pet = hatchedPet(CFG, { cosmetics: { owned: ['dec-flower'], accessories: { head: null, face: null, neck: null }, decor: { meadow: null, sea: null } } })
    const on = activateItem(pet, 'dec-flower', cfgWithDeco)
    expect(on.ok).toBe(true)
    expect(on.state.cosmetics.decor.meadow).toBe('dec-flower')
    const off = activateItem(on.state, 'dec-flower', cfgWithDeco)
    expect(off.state.cosmetics.decor.meadow).toBeNull()
  })

  it('аксессуар — надеть/снять в своём слоте', () => {
    const res = activateItem(hatchedPet(CFG, { cosmetics: { owned: ['acc-glasses'], accessories: { head: null, face: 'acc-glasses', neck: null }, decor: { meadow: null, sea: null } } }), 'acc-glasses', CFG)
    expect(res.ok).toBe(true)
    expect(res.state.cosmetics.accessories.face).toBeNull()
    const on = activateItem(res.state, 'acc-glasses', CFG)
    expect(on.state.cosmetics.accessories.face).toBe('acc-glasses')
  })

  it('очки и шарф носятся одновременно — слоты независимы', () => {
    const pet = hatchedPet(CFG, { cosmetics: { owned: ['acc-glasses', 'acc-bandana'], accessories: { head: null, face: 'acc-glasses', neck: 'acc-bandana' }, decor: { meadow: null, sea: null } } })
    expect(pet.cosmetics.accessories.face).toBe('acc-glasses')
    expect(pet.cosmetics.accessories.neck).toBe('acc-bandana')
  })

  it('некупленную косметику не активирует', () => {
    const res = activateItem(hatchedPet(CFG), 'dec-flower', cfgWithDeco)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('not-owned')
  })
})
