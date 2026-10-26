import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import { serialize } from '../src/game/storage'
import worker from '../worker/src/index'
import { hatchedPet, signInitData } from './helpers'
import { FakeDb } from './worker-fake-db'

const BOT_TOKEN = '7000000001:TEST-TOKEN-abcdef'

async function signedInitData(): Promise<string> {
  return signInitData(
    {
      auth_date: String(Math.floor(Date.now() / 1000) - 30),
      query_id: 'T',
      user: JSON.stringify({ id: 7, first_name: 'Кевин', username: 'kevin' }),
    },
    BOT_TOKEN,
  )
}

function postNotify(db: FakeDb, initData: string, enabled: boolean): Promise<Response> {
  return worker.fetch(
    new Request('http://api.test/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, enabled }),
    }),
    { DB: db, BOT_TOKEN, ALLOWED_ORIGIN: '*' },
  )
}

/** Подписчик с питомцем-малышом, пуши выключены. */
function subscriberDb(): FakeDb {
  return new FakeDb([
    {
      telegram_id: 7,
      save_json: serialize(hatchedPet(DEFAULT_CONFIG, { name: 'Эгг' })),
      stage: 'baby',
      push_enabled: 0,
    },
  ])
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('POST /notify — включение', () => {
  it('бот доставил тестовое сообщение → пуши включены, стадия не будет поздравлена задним числом', async () => {
    const db = subscriberDb()
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit): Promise<Response> =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await postNotify(db, await signedInitData(), true)
    const data = (await response.json()) as { ok: boolean }

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(db.users[0]?.push_enabled).toBe(1)
    expect(db.sent.has('7:grown:baby')).toBe(true)
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { chat_id: number; text: string }
    expect(body.chat_id).toBe(7)
    expect(body.text).toContain('включены')
  })

  it('юзер не стартовал бота (403) → отказ, подписка не включается', async () => {
    const db = subscriberDb()
    vi.stubGlobal('fetch', vi.fn(async (): Promise<Response> =>
      new Response(JSON.stringify({ ok: false, error_code: 403 }), { status: 200 }),
    ))

    const response = await postNotify(db, await signedInitData(), true)
    const data = (await response.json()) as { ok: boolean; error: string }

    expect(data.ok).toBe(false)
    expect(data.error).toBe('blocked')
    expect(db.users[0]?.push_enabled).toBe(0)
    expect(db.users[0]?.bot_blocked).toBe(1)
  })

  it('подделанный initData → 401', async () => {
    const db = subscriberDb()
    const response = await postNotify(db, 'user=%7B%22id%22%3A7%7D', true)
    expect(response.status).toBe(401)
    expect(db.users[0]?.push_enabled).toBe(0)
  })
})

describe('POST /notify — выключение', () => {
  it('просто выключает, ничего боту не шлёт', async () => {
    const db = subscriberDb()
    db.users[0]!.push_enabled = 1
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await postNotify(db, await signedInitData(), false)
    const data = (await response.json()) as { ok: boolean }

    expect(data.ok).toBe(true)
    expect(db.users[0]?.push_enabled).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('GET /notify — состояние', () => {
  it('включено → enabled: true', async () => {
    const db = subscriberDb()
    db.users[0]!.push_enabled = 1
    const response = await worker.fetch(
      new Request(`http://api.test/notify?initData=${encodeURIComponent(await signedInitData())}`),
      { DB: db, BOT_TOKEN, ALLOWED_ORIGIN: '*' },
    )
    expect(((await response.json()) as { enabled: boolean }).enabled).toBe(true)
  })

  it('новый юзер без ряда → enabled: false', async () => {
    const db = new FakeDb()
    const response = await worker.fetch(
      new Request(`http://api.test/notify?initData=${encodeURIComponent(await signedInitData())}`),
      { DB: db, BOT_TOKEN, ALLOWED_ORIGIN: '*' },
    )
    expect(((await response.json()) as { enabled: boolean }).enabled).toBe(false)
  })
})
