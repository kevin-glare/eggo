import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG, HOUR } from '../src/game/config'
import { serialize } from '../src/game/storage'
import { runPushCron } from '../worker/src/pushes'
import { hatchedPet, MINUTE } from './helpers'
import { FakeDb } from './worker-fake-db'

const config = DEFAULT_CONFIG
const BOT_TOKEN = '7000000001:TEST-TOKEN-abcdef'

/** Ответ Bot API: ok или ошибка с кодом (403/400 = юзер нас заблокировал). */
function botFetch(ok: boolean, errorCode = 403) {
  return vi.fn(async (_url: string, _init: RequestInit): Promise<Response> =>
    new Response(JSON.stringify(ok ? { ok: true } : { ok: false, error_code: errorCode }), { status: 200 }),
  )
}

/** Критичный питомец (голодает), синкнутый только что — крону нечего досчитывать. */
function hungryPetSave(): string {
  return serialize(hatchedPet(config, { lastTickAt: Date.now() }, { fullness: 20 }))
}

/**
 * Смещение, при котором у юзера сейчас ровно hour часов по месту:
 * тесты днём/ночью не зависят от реального времени запуска.
 */
function utcOffsetWithLocalHour(hour: number): number {
  const utcHour = new Date().getUTCHours()
  return (((hour - utcHour) % 24) + 24) % 24 * 60
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runPushCron', () => {
  it('критичный питомец → шлём самое важное уведомление и ставим отметку', async () => {
    const db = new FakeDb([
      { telegram_id: 7, save_json: hungryPetSave(), push_enabled: 1, utc_offset: utcOffsetWithLocalHour(14), last_seen_at: Date.now() - HOUR },
    ])
    const fetchMock = botFetch(true)
    vi.stubGlobal('fetch', fetchMock)

    await runPushCron(db, BOT_TOKEN)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(`bot${BOT_TOKEN}/sendMessage`)
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { chat_id: number; text: string }
    expect(body.chat_id).toBe(7)
    expect(body.text).toContain('голодает')
    expect(db.sent.has('7:critical')).toBe(true)
  })

  it('свежая отметка «в беде» (кулдаун 6 ч) и поздравленное взросление → молчим', async () => {
    const db = new FakeDb([
      { telegram_id: 7, save_json: hungryPetSave(), push_enabled: 1, utc_offset: utcOffsetWithLocalHour(14), last_seen_at: Date.now() - HOUR },
    ])
    db.sent.set('7:critical', Date.now() - HOUR)
    db.sent.set('7:grown:baby', 1)
    const fetchMock = botFetch(true)
    vi.stubGlobal('fetch', fetchMock)

    await runPushCron(db, BOT_TOKEN)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('юзер заблокировал бота (403) → помечаем bot_blocked, отметку не ставим', async () => {
    const db = new FakeDb([{ telegram_id: 7, save_json: hungryPetSave(), push_enabled: 1, utc_offset: utcOffsetWithLocalHour(14) }])
    vi.stubGlobal('fetch', botFetch(false, 403))

    await runPushCron(db, BOT_TOKEN)

    expect(db.users[0]?.bot_blocked).toBe(1)
    expect(db.sent.has('7:critical')).toBe(false)
  })

  it('сетевая ошибка Telegram → без отметки и без блокировки, крон повторит', async () => {
    const db = new FakeDb([{ telegram_id: 7, save_json: hungryPetSave(), push_enabled: 1, utc_offset: utcOffsetWithLocalHour(14) }])
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('сеть')
    }))

    await runPushCron(db, BOT_TOKEN)

    expect(db.sent.has('7:critical')).toBe(false)
    expect(db.users[0]?.bot_blocked).toBe(0)
  })

  it('подписчик без сейва пропускается', async () => {
    const db = new FakeDb([{ telegram_id: 7, save_json: null, push_enabled: 1 }])
    const fetchMock = botFetch(true)
    vi.stubGlobal('fetch', fetchMock)

    await runPushCron(db, BOT_TOKEN)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('выключенные уведомления не обрабатываются вовсе', async () => {
    const db = new FakeDb([{ telegram_id: 7, save_json: hungryPetSave(), push_enabled: 0 }])
    const fetchMock = botFetch(true)
    vi.stubGlobal('fetch', fetchMock)

    await runPushCron(db, BOT_TOKEN)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ночь (3 часа по месту): «в беде» уходит молча, но отметка стоит', async () => {
    const db = new FakeDb([
      { telegram_id: 7, save_json: hungryPetSave(), push_enabled: 1, utc_offset: utcOffsetWithLocalHour(3) },
    ])
    const fetchMock = botFetch(true)
    vi.stubGlobal('fetch', fetchMock)

    await runPushCron(db, BOT_TOKEN)

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { disable_notification?: boolean }
    expect(body.disable_notification).toBe(true)
    expect(db.sent.has('7:critical')).toBe(true)
  })

  it('ночь: взросление и «скучаем» придерживаются — молчим, отметок нет', async () => {
    const db = new FakeDb([
      {
        telegram_id: 7,
        // настоящий возраст подростка: стадию выводит движок из ageMs,
        // а lastTickAt на минуту в прошлом — крон гарантированно тикает
        // (без этого тест плавал: успела ли пройти мс между setup и кроном)
        save_json: serialize(
          hatchedPet(config, {
            stage: 'teen',
            ageMs: config.evolution.eggMs + config.evolution.babyMs + config.evolution.childMs + HOUR,
            lastTickAt: Date.now() - MINUTE,
          }),
        ),
        push_enabled: 1,
        utc_offset: utcOffsetWithLocalHour(23),
        last_seen_at: Date.now() - 30 * HOUR,
      },
    ])
    const fetchMock = botFetch(true)
    vi.stubGlobal('fetch', fetchMock)

    await runPushCron(db, BOT_TOKEN)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(db.sent.has('7:grown:teen')).toBe(false)
    expect(db.sent.has('7:missYou')).toBe(false)
  })

  it('утро (9 по месту): придержанное взросление догоняет утренний крон, громко', async () => {
    const db = new FakeDb([
      {
        telegram_id: 7,
        // настоящий возраст подростка: стадию выводит движок из ageMs,
        // а lastTickAt на минуту в прошлом — крон гарантированно тикает
        // (без этого тест плавал: успела ли пройти мс между setup и кроном)
        save_json: serialize(
          hatchedPet(config, {
            stage: 'teen',
            ageMs: config.evolution.eggMs + config.evolution.babyMs + config.evolution.childMs + HOUR,
            lastTickAt: Date.now() - MINUTE,
          }),
        ),
        push_enabled: 1,
        utc_offset: utcOffsetWithLocalHour(9),
        last_seen_at: Date.now() - 30 * HOUR,
      },
    ])
    const fetchMock = botFetch(true)
    vi.stubGlobal('fetch', fetchMock)

    await runPushCron(db, BOT_TOKEN)

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      chat_id: number
      text: string
      disable_notification?: boolean
    }
    expect(body.chat_id).toBe(7)
    expect(body.text).toContain('подросток')
    expect(body.disable_notification).toBe(false)
    expect(db.sent.has('7:grown:teen')).toBe(true)
  })
})
