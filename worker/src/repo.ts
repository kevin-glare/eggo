/**
 * Доступ к D1. Типы описаны минимально — только методы, которыми пользуемся,
 * чтобы не тянуть @cloudflare/workers-types.
 */

export interface D1Statement {
  bind(...values: unknown[]): D1Statement
  first<T = unknown>(): Promise<T | null>
  all<T = unknown>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

export interface D1Database {
  prepare(query: string): D1Statement
}

/** Пока клиент не прислал свою таймзону, считаем Москвой: аудитория русскоязычная. */
export const FALLBACK_UTC_OFFSET_MIN = 180

export interface UserRow {
  telegram_id: number
  username: string | null
  first_name: string | null
  save_json: string | null
  stage: string | null
  push_enabled: number
  bot_blocked: number
  utc_offset: number
  last_seen_at: number
  updated_at: number
  created_at: number
}

export interface SyncUserUpdate {
  telegramId: number
  username: string | null
  firstName: string | null
  saveJson: string | null
  stage: string | null
  utcOffsetMin: number
  lastSeenAt: number
}

export async function fetchUser(db: D1Database, telegramId: number): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').bind(telegramId).first<UserRow>()
}

/**
 * Создаёт юзера или обновляет профиль и сейв. Флаги пушей (push_enabled,
 * bot_blocked) специально не трогаем — их меняют только /notify и крон.
 */
export async function upsertSyncUser(db: D1Database, u: SyncUserUpdate): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (telegram_id, username, first_name, save_json, stage, utc_offset, last_seen_at, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(telegram_id) DO UPDATE SET
         username = excluded.username,
         first_name = excluded.first_name,
         save_json = excluded.save_json,
         stage = excluded.stage,
         utc_offset = excluded.utc_offset,
         last_seen_at = excluded.last_seen_at,
         updated_at = excluded.updated_at`,
      // created_at в DO UPDATE нет сознательно: это дата первой встречи,
      // приток по дням в worker/metrics.sql опирается на её неизменность.
    )
    .bind(u.telegramId, u.username, u.firstName, u.saveJson, u.stage, u.utcOffsetMin, u.lastSeenAt, u.lastSeenAt, u.lastSeenAt)
    .run()
}

/** Ряд юзера должен существовать до смены флагов пушей. */
export async function ensureUser(
  db: D1Database,
  u: { telegramId: number; username: string | null; firstName: string | null },
  nowMs: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (telegram_id, username, first_name, last_seen_at, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(telegram_id) DO NOTHING`,
    )
    .bind(u.telegramId, u.username, u.firstName, nowMs, nowMs, nowMs)
    .run()
}

/** Подписчики крона: пуши включены и бот не заблокирован. */
export interface PushTargetRow {
  telegram_id: number
  save_json: string | null
  stage: string | null
  utc_offset: number
  last_seen_at: number
}

export async function fetchPushTargets(db: D1Database): Promise<PushTargetRow[]> {
  const result = await db
    .prepare(
      'SELECT telegram_id, save_json, stage, utc_offset, last_seen_at FROM users WHERE push_enabled = 1 AND bot_blocked = 0',
    )
    .all<PushTargetRow>()
  return result.results
}

/** Карта уже отправленных уведомлений: kind → sent_at. */
export async function fetchSentMap(db: D1Database, telegramId: number): Promise<Record<string, number>> {
  const result = await db
    .prepare('SELECT kind, sent_at FROM notifications WHERE telegram_id = ?')
    .bind(telegramId)
    .all<{ kind: string; sent_at: number }>()
  const sent: Record<string, number> = {}
  for (const row of result.results) sent[row.kind] = row.sent_at
  return sent
}

export async function markNotificationSent(db: D1Database, telegramId: number, kind: string, sentAt: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO notifications (telegram_id, kind, sent_at) VALUES (?, ?, ?)
       ON CONFLICT(telegram_id, kind) DO UPDATE SET sent_at = excluded.sent_at`,
    )
    .bind(telegramId, kind, sentAt)
    .run()
}

/** Меняет подписку; заодно сбрасывает bot_blocked — включение лечит блокировку. */
export async function setPushEnabled(db: D1Database, telegramId: number, enabled: boolean, nowMs: number): Promise<void> {
  await db
    .prepare('UPDATE users SET push_enabled = ?, bot_blocked = 0, updated_at = ? WHERE telegram_id = ?')
    .bind(enabled ? 1 : 0, nowMs, telegramId)
    .run()
}

export async function setBotBlocked(db: D1Database, telegramId: number, nowMs: number): Promise<void> {
  await db
    .prepare('UPDATE users SET bot_blocked = 1, updated_at = ? WHERE telegram_id = ?')
    .bind(nowMs, telegramId)
    .run()
}
