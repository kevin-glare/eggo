import { validateInitData } from './auth'
import { fetchUser, upsertSyncUser, type D1Database } from './repo'
import { resolveSync } from './sync'

export interface Env {
  DB: D1Database
  BOT_TOKEN: string
  ALLOWED_ORIGIN: string
}

interface SyncBody {
  initData?: unknown
  save?: unknown
}

function json(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } })
}

function readBody(body: SyncBody): { initData: string; save: string | null } | null {
  if (typeof body.initData !== 'string' || body.initData === '') return null
  if (body.save !== null && typeof body.save !== 'string') return null
  return { initData: body.initData, save: body.save ?? null }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // фронт живёт на GitHub Pages, API — на своём домене, поэтому нужен CORS
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const url = new URL(request.url)
    if (url.pathname === '/sync' && request.method === 'POST') {
      let parsed: SyncBody
      try {
        parsed = (await request.json()) as SyncBody
      } catch {
        return json({ error: 'bad request' }, 400, cors)
      }
      const body = readBody(parsed)
      if (!body) return json({ error: 'bad request' }, 400, cors)

      const user = await validateInitData(body.initData, env.BOT_TOKEN, Math.floor(Date.now() / 1000))
      if (!user) return json({ error: 'unauthorized' }, 401, cors)

      const nowMs = Date.now()
      const row = await fetchUser(env.DB, user.id)
      const decision = resolveSync(body.save, row?.save_json ?? null)
      await upsertSyncUser(env.DB, {
        telegramId: user.id,
        username: user.username,
        firstName: user.first_name,
        saveJson: decision.fromClient ? body.save : row?.save_json ?? null,
        stage: decision.stage,
        lastSeenAt: nowMs,
      })
      return json({ save: decision.raw }, 200, cors)
    }

    return json({ error: 'not found' }, 404, cors)
  },
}
