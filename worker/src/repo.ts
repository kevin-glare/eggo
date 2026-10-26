/**
 * Доступ к D1. Типы описаны минимально — только методы, которыми пользуемся,
 * чтобы не тянуть @cloudflare/workers-types.
 */

interface D1Bound {
  first<T = unknown>(): Promise<T | null>
  run(): Promise<unknown>
}

interface D1Statement {
  bind(...values: unknown[]): D1Bound
}

export interface D1Database {
  prepare(query: string): D1Statement
}

export interface UserRow {
  telegram_id: number
  username: string | null
  first_name: string | null
  save_json: string | null
  stage: string | null
  push_enabled: number
  bot_blocked: number
  last_seen_at: number
  updated_at: number
}

export interface SyncUserUpdate {
  telegramId: number
  username: string | null
  firstName: string | null
  saveJson: string | null
  stage: string | null
  lastSeenAt: number
}

export async function fetchUser(db: D1Database, telegramId: number): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').bind(telegramId).first<UserRow>()
}

/**
 * Создаёт юзера или обновляет профиль и сейв. Флаги пушей (push_enabled,
 * bot_blocked) специально не трогаем — их меняет только /notify и крон.
 */
export async function upsertSyncUser(db: D1Database, u: SyncUserUpdate): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (telegram_id, username, first_name, save_json, stage, last_seen_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(telegram_id) DO UPDATE SET
         username = excluded.username,
         first_name = excluded.first_name,
         save_json = excluded.save_json,
         stage = excluded.stage,
         last_seen_at = excluded.last_seen_at,
         updated_at = excluded.updated_at`,
    )
    .bind(u.telegramId, u.username, u.firstName, u.saveJson, u.stage, u.lastSeenAt, u.lastSeenAt)
    .run()
}
