import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import { serialize } from '../src/game/storage'
import worker from '../worker/src/index'
import { hatchedPet, signInitData } from './helpers'
import { FakeDb } from './worker-fake-db'

const BOT_TOKEN = '7000000001:TEST-TOKEN-abcdef'

function env(db: FakeDb) {
  return { DB: db, BOT_TOKEN, ALLOWED_ORIGIN: 'https://eggotg.ru' }
}

async function signedInitData(id: number, firstName: string): Promise<string> {
  return signInitData(
    {
      auth_date: String(Math.floor(Date.now() / 1000) - 30),
      query_id: 'T',
      user: JSON.stringify({ id, first_name: firstName }),
    },
    BOT_TOKEN,
  )
}

/** Сейв с рекордами мини-игр. */
function saveWithBest(best: Record<string, number>): string {
  return serialize(hatchedPet(DEFAULT_CONFIG, { minigameBest: best }))
}

function postSync(db: FakeDb, initData: string, save: string): Promise<Response> {
  return worker.fetch(
    new Request('http://api.test/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, save, tzOffset: 0 }),
    }),
    env(db),
  )
}

function getLeaderboard(db: FakeDb, initData: string | null, game: string | null): Promise<Response> {
  const params = new URLSearchParams()
  if (initData !== null) params.set('initData', initData)
  if (game !== null) params.set('game', game)
  return worker.fetch(new Request(`http://api.test/leaderboard?${params}`), env(db))
}

describe('POST /sync льёт рекорды в лидерборд', () => {
  it('рекорды сейва оказываются в таблице', async () => {
    const db = new FakeDb()
    const initData = await signedInitData(7, 'Кевин')
    const response = await postSync(db, initData, saveWithBest({ snake: 120, memory: 8 }))
    expect(response.status).toBe(200)
    expect(db.scores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ telegram_id: 7, game: 'snake', best: 120 }),
        expect.objectContaining({ telegram_id: 7, game: 'memory', best: 8 }),
      ]),
    )
  })

  it('повторный синк с меньшим счётом ничего не портит', async () => {
    const db = new FakeDb()
    const initData = await signedInitData(7, 'Кевин')
    await postSync(db, initData, saveWithBest({ snake: 120 }))
    await postSync(db, initData, saveWithBest({ snake: 90 }))
    const row = db.scores.find((s) => s.game === 'snake')
    expect(row?.best).toBe(120)
  })

  it('новый рекорд растёт по максимуму', async () => {
    const db = new FakeDb()
    const initData = await signedInitData(7, 'Кевин')
    await postSync(db, initData, saveWithBest({ snake: 120 }))
    await postSync(db, initData, saveWithBest({ snake: 300 }))
    expect(db.scores.find((s) => s.game === 'snake')?.best).toBe(300)
  })

  it('мусор в рекордах (нуль, отрицательный) не записывается', async () => {
    const db = new FakeDb()
    const initData = await signedInitData(7, 'Кевин')
    await postSync(db, initData, saveWithBest({ snake: 0, memory: -5, flappy: 42 }))
    expect(db.scores.map((s) => s.game)).toEqual(['flappy'])
  })
})

describe('GET /leaderboard', () => {
  async function filledDb(): Promise<FakeDb> {
    const db = new FakeDb([
      { telegram_id: 1, first_name: 'Аня' },
      { telegram_id: 2, first_name: 'Борис' },
      { telegram_id: 3, first_name: 'Вера' },
    ])
    db.scores.push(
      { telegram_id: 1, game: 'snake', best: 80, updated_at: 100 },
      { telegram_id: 2, game: 'snake', best: 200, updated_at: 100 },
      { telegram_id: 3, game: 'snake', best: 150, updated_at: 50 },
      { telegram_id: 1, game: 'memory', best: 9, updated_at: 100 },
    )
    return db
  }

  it('топ одной игры отсортирован, места с единицы', async () => {
    const db = await filledDb()
    const response = await getLeaderboard(db, await signedInitData(3, 'Вера'), 'snake')
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      rows: { place: number; name: string; best: number }[]
      you: number
    }
    expect(body.rows).toEqual([
      { place: 1, name: 'Борис', best: 200 },
      { place: 2, name: 'Вера', best: 150 },
      { place: 3, name: 'Аня', best: 80 },
    ])
    // у второй по счёту Веры — второе место (Борис выше)
    expect(body.you).toBe(2)
  })

  it('без рекорда в этой игре место не выдаётся', async () => {
    const db = await filledDb()
    const response = await getLeaderboard(db, await signedInitData(2, 'Борис'), 'memory')
    const body = (await response.json()) as { rows: unknown[]; you: number | null }
    expect(body.rows).toEqual([{ place: 1, name: 'Аня', best: 9 }])
    expect(body.you).toBeNull()
  })

  it('без auth — 401, битый запрос или чужая игра — 400 (как у GET /sync)', async () => {
    const db = await filledDb()
    // initData нет вовсе — битый запрос, как в GET /sync
    expect((await getLeaderboard(db, null, 'snake')).status).toBe(400)
    const badToken = await signInitData({}, 'другой-токен')
    expect((await getLeaderboard(db, badToken, 'snake')).status).toBe(401)
    expect((await getLeaderboard(db, await signedInitData(1, 'Аня'), null)).status).toBe(400)
    expect((await getLeaderboard(db, await signedInitData(1, 'Аня'), 'tetris')).status).toBe(400)
  })
})
