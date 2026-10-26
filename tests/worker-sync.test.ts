import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import { serialize } from '../src/game/storage'
import { resolveSync } from '../worker/src/sync'
import { hatchedPet, makePet } from './helpers'

const config = DEFAULT_CONFIG

function saveAt(lastTickAt: number): string {
  return serialize(makePet(config, { lastTickAt }))
}

describe('resolveSync — у кого lastTickAt новее, тот и главный', () => {
  it('сервер пуст → победил клиент, сервер его сохранит', () => {
    const decision = resolveSync(saveAt(1_000), null)
    expect(decision.fromClient).toBe(true)
    expect(decision.raw).toBe(saveAt(1_000))
  })

  it('клиент новее → победил клиент', () => {
    const decision = resolveSync(saveAt(5_000), saveAt(1_000))
    expect(decision.fromClient).toBe(true)
    expect(decision.raw).toBe(saveAt(5_000))
  })

  it('сервер новее → клиенту возвращается серверный сейв', () => {
    const decision = resolveSync(saveAt(1_000), saveAt(5_000))
    expect(decision.fromClient).toBe(false)
    expect(decision.raw).toBe(saveAt(5_000))
  })

  it('ничья по lastTickAt → сервер сохраняет свой, без перезаписи', () => {
    const decision = resolveSync(saveAt(5_000), saveAt(5_000))
    expect(decision.fromClient).toBe(false)
    expect(decision.raw).toBe(saveAt(5_000))
  })

  it('стадия победившего сейва видна крону (для пушей о взрослении)', () => {
    const clientRaw = serialize(hatchedPet(config, { lastTickAt: 5_000 }))
    expect(resolveSync(clientRaw, saveAt(1_000)).stage).toBe('baby')
    expect(resolveSync(saveAt(1_000), null).stage).toBe('egg')
  })

  it('битый клиентский сейв (не JSON / чужая версия) игнорируется', () => {
    expect(resolveSync('не json', saveAt(1_000)).fromClient).toBe(false)
    expect(resolveSync('{"version":2,"pet":{}}', saveAt(1_000)).fromClient).toBe(false)
  })

  it('битой строке в базе сервер не доверяет — клиент чинит', () => {
    const decision = resolveSync(saveAt(1_000), 'мусор из базы')
    expect(decision.fromClient).toBe(true)
    expect(decision.raw).toBe(saveAt(1_000))
  })

  it('оба пусты → пусто', () => {
    const decision = resolveSync(null, null)
    expect(decision).toEqual({ raw: null, stage: null, fromClient: false })
  })
})
