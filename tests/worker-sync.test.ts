import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import { catchUp, deserialize, serialize } from '../src/game/storage'
import { resolveSync } from '../worker/src/sync'
import { HOUR, TEST_APPEARANCE, hatchedPet, makePet } from './helpers'

const config = DEFAULT_CONFIG

function saveAt(lastTickAt: number): string {
  return serialize(makePet(config, { lastTickAt }))
}

describe('resolveSync — слияние сейвов по полям (статы/возраст по максимуму, события у свежего)', () => {
  it('сервер пуст → клиентский сейв сохраняется как есть', () => {
    const decision = resolveSync(saveAt(1_000), null)
    expect(decision.raw).toBe(saveAt(1_000))
    expect(decision.stage).toBe('egg')
  })

  it('клиент пуст → серверный сейв возвращается без изменений', () => {
    const decision = resolveSync(null, saveAt(5_000))
    expect(decision.raw).toBe(saveAt(5_000))
    expect(decision.stage).toBe('egg')
  })

  it('битый клиентский сейв (не JSON / чужая версия) игнорируется', () => {
    expect(resolveSync('не json', saveAt(1_000)).raw).toBe(saveAt(1_000))
    expect(resolveSync('{"version":2,"pet":{}}', saveAt(1_000)).raw).toBe(saveAt(1_000))
  })

  it('битой строке в базе сервер не доверяет — клиент чинит', () => {
    const decision = resolveSync(saveAt(1_000), 'мусор из базы')
    expect(decision.raw).toBe(saveAt(1_000))
  })

  it('оба пусты → пусто', () => {
    const decision = resolveSync(null, null)
    expect(decision).toEqual({ raw: null, stage: null })
  })

  it('безымянный клиентский сейв не перезаписывает именованного питомца, даже если он «новее»', () => {
    const freshEgg = serialize(makePet(config, { lastTickAt: 9_000, lastEventAt: 9_000, name: null }))
    const namedPet = saveAt(1_000) // makePet по умолчанию даёт имя
    const decision = resolveSync(freshEgg, namedPet)
    expect(decision.raw).toBe(namedPet)
  })

  it('именованный клиент не теряет имя и стадию из-за безымянного яйца в базе, даже «созданного позже»', () => {
    const named = serialize(hatchedPet(config, { lastTickAt: 1_500, lastEventAt: HOUR, name: 'Настоящий' }))
    const freshEgg = serialize(makePet(config, { lastTickAt: 9_000, lastEventAt: 9_000, name: null }))
    const decision = resolveSync(named, freshEgg)
    const merged = decision.raw === null ? null : deserialize(decision.raw, TEST_APPEARANCE)
    expect(merged?.name).toBe('Настоящий')
    expect(merged?.stage).toBe('baby')
    expect(decision.stage).toBe('baby')
  })

  it('кормление клиента выживает, хотя серверный сейв тикал до более позднего момента', () => {
    const base = hatchedPet(config, { lastTickAt: 0, lastEventAt: 0 }, { fullness: 70 })
    // клиент в момент HOUR кормит (→ 100) и уходит в оффлайн
    const client = { ...base, lastTickAt: HOUR, lastEventAt: HOUR, stats: { ...base.stats, fullness: 100 } }
    const clientRaw = serialize(client)
    // сервер без событий, но его lastTickAt «новее» — старое правило затёрло бы кормление
    const serverRaw = serialize(catchUp(base, 5 * HOUR, config))
    const decision = resolveSync(clientRaw, serverRaw)
    const merged = decision.raw === null ? null : deserialize(decision.raw, TEST_APPEARANCE)
    expect(merged?.stats.fullness).toBe(catchUp(client, 5 * HOUR, config).stats.fullness)
    expect(merged?.stats.fullness).toBeGreaterThan(70 - 12 * 5) // не распавшаяся серверная сытость
    expect(merged?.lastTickAt).toBe(5 * HOUR)
  })

  it('сон с сервера доезжает до клиента: событийные поля у более свежего события', () => {
    const base = hatchedPet(config, { lastTickAt: 0, lastEventAt: 0 })
    const clientRaw = serialize({ ...base, lastTickAt: HOUR, lastEventAt: HOUR })
    const serverRaw = serialize(catchUp({ ...base, lastEventAt: 2 * HOUR, sleeping: true }, 2 * HOUR, config))
    const decision = resolveSync(clientRaw, serverRaw)
    const merged = decision.raw === null ? null : deserialize(decision.raw, TEST_APPEARANCE)
    expect(merged?.sleeping).toBe(true)
  })

  it('стадия слитого сейва видна крону (для пушей о взрослении)', () => {
    const clientRaw = serialize(hatchedPet(config, { lastTickAt: 5_000, lastEventAt: 5_000 }))
    const decision = resolveSync(clientRaw, saveAt(1_000))
    expect(decision.stage).toBe('baby')
    expect(resolveSync(saveAt(1_000), null).stage).toBe('egg')
  })
})
