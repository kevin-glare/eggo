import { validateInitData } from './auth'
import { runPushCron } from './pushes'
import {
  ensureUser,
  fetchUser,
  markNotificationSent,
  setBotBlocked,
  setPushEnabled,
  upsertSyncUser,
  FALLBACK_UTC_OFFSET_MIN,
  type D1Database,
} from './repo'
import { resolveSync } from './sync'
import { sendBotMessage } from './telegram-api'

export interface Env {
  DB: D1Database
  BOT_TOKEN: string
  ALLOWED_ORIGIN: string
}

interface SyncBody {
  initData?: unknown
  save?: unknown
  tzOffset?: unknown
}

interface NotifyBody {
  initData?: unknown
  enabled?: unknown
}

/** Структурные типы контекста крона (без @cloudflare/workers-types). */
interface ScheduledController {
  scheduledTime: number
  cron: string
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

function json(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } })
}

function readBody(body: SyncBody): { initData: string; save: string | null; tzOffset: number | null } | null {
  if (typeof body.initData !== 'string' || body.initData === '') return null
  if (body.save !== null && typeof body.save !== 'string') return null
  // таймзона игрока: минуты к востоку от UTC (UTC−12…+14); без поля оставляем прежнюю
  if (body.tzOffset !== undefined && typeof body.tzOffset !== 'number') return null
  if (typeof body.tzOffset === 'number' && (!Number.isSafeInteger(body.tzOffset) || body.tzOffset < -720 || body.tzOffset > 840)) return null
  return { initData: body.initData, save: body.save ?? null, tzOffset: body.tzOffset ?? null }
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
        utcOffsetMin: body.tzOffset ?? row?.utc_offset ?? FALLBACK_UTC_OFFSET_MIN,
        lastSeenAt: nowMs,
      })
      return json({ save: decision.raw }, 200, cors)
    }

    if (url.pathname === '/notify') {
      if (request.method === 'GET') {
        const initData = url.searchParams.get('initData')
        if (!initData) return json({ error: 'bad request' }, 400, cors)
        const user = await validateInitData(initData, env.BOT_TOKEN, Math.floor(Date.now() / 1000))
        if (!user) return json({ error: 'unauthorized' }, 401, cors)
        const row = await fetchUser(env.DB, user.id)
        return json({ enabled: row?.push_enabled === 1 }, 200, cors)
      }

      if (request.method === 'POST') {
        let parsed: NotifyBody
        try {
          parsed = (await request.json()) as NotifyBody
        } catch {
          return json({ error: 'bad request' }, 400, cors)
        }
        if (typeof parsed.initData !== 'string' || parsed.initData === '' || typeof parsed.enabled !== 'boolean') {
          return json({ error: 'bad request' }, 400, cors)
        }
        const user = await validateInitData(parsed.initData, env.BOT_TOKEN, Math.floor(Date.now() / 1000))
        if (!user) return json({ error: 'unauthorized' }, 401, cors)

        const nowMs = Date.now()
        await ensureUser(env.DB, { telegramId: user.id, username: user.username, firstName: user.first_name }, nowMs)

        if (parsed.enabled) {
          // тестовое сообщение гарантирует, что юзер стартовал бота
          const test = await sendBotMessage(
            env.BOT_TOKEN,
            user.id,
            '🔔 Уведомления включены: напишу, если питомец в беде, вырастет или заскучает.',
          )
          if (test === 'blocked') {
            await setPushEnabled(env.DB, user.id, false, nowMs)
            await setBotBlocked(env.DB, user.id, nowMs)
            return json({ ok: false, error: 'blocked' }, 200, cors)
          }
          // текущую стадию не поздравляем задним числом
          const row = await fetchUser(env.DB, user.id)
          if (row?.stage && row.stage !== 'egg') {
            await markNotificationSent(env.DB, user.id, `grown:${row.stage}`, nowMs)
          }
          await setPushEnabled(env.DB, user.id, true, nowMs)
          return json({ ok: true }, 200, cors)
        }

        await setPushEnabled(env.DB, user.id, false, nowMs)
        return json({ ok: true }, 200, cors)
      }
    }

    return json({ error: 'not found' }, 404, cors)
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runPushCron(env.DB, env.BOT_TOKEN))
  },
}
