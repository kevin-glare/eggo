import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import { serialize } from '../src/game/storage'
import worker from '../worker/src/index'
import { hatchedPet, signInitData } from './helpers'
import { FakeDb } from './worker-fake-db'

const BOT_TOKEN = '7000000002:TEST-TOKEN-abcdef'

function signed(id: number, startParam?: string): Promise<string> {
  const params: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000) - 30),
    query_id: 'T',
    user: JSON.stringify({ id, first_name: 'Гость', username: `u${id}` }),
  }
  if (startParam !== undefined) params.start_param = startParam
  return signInitData(params, BOT_TOKEN)
}

async function sync(db: FakeDb, initData: string): Promise<{ invited: number }> {
  const response = await worker.fetch(
    new Request('http://api.test/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, save: serialize(hatchedPet(DEFAULT_CONFIG, { name: 'Друг' })) }),
    }),
    { DB: db, BOT_TOKEN, ALLOWED_ORIGIN: '*' },
  )
  return (await response.json()) as { invited: number }
}

describe('POST /sync — рефералка', () => {
  it('новый игрок со start_param=ref_123 запоминает пригласившего, тот видит счётчик', async () => {
    const db = new FakeDb([{ telegram_id: 123, save_json: serialize(hatchedPet(DEFAULT_CONFIG)), stage: 'baby' }])
    await sync(db, await signed(555, 'ref_123'))
    expect(db.users.find((u) => u.telegram_id === 555)?.referrer_tg_id).toBe(123)
    const inviter = await sync(db, await signed(123))
    expect(inviter.invited).toBe(1)
  })

  it('повторные синки не меняют пригласившего (первый — навсегда)', async () => {
    const db = new FakeDb()
    await sync(db, await signed(555, 'ref_123'))
    await sync(db, await signed(555, 'ref_999'))
    expect(db.users.find((u) => u.telegram_id === 555)?.referrer_tg_id).toBe(123)
  })

  it('пригласить самого себя нельзя', async () => {
    const db = new FakeDb()
    await sync(db, await signed(555, 'ref_555'))
    expect(db.users.find((u) => u.telegram_id === 555)?.referrer_tg_id).toBe(0)
  })

  it('мусорный start_param игнорируется', async () => {
    const db = new FakeDb()
    const result = await sync(db, await signed(555, 'friend_123'))
    expect(db.users.find((u) => u.telegram_id === 555)?.referrer_tg_id).toBe(0)
    expect(result.invited).toBe(0)
  })

  it('без start_param счётчик тоже приходит (0 у нового игрока)', async () => {
    const db = new FakeDb()
    const result = await sync(db, await signed(555))
    expect(result.invited).toBe(0)
  })
})
