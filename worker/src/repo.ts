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
  /** кто пригласил: telegram_id пригласившего; 0 — никто */
  referrer_tg_id: number
}

export interface SyncUserUpdate {
  telegramId: number
  username: string | null
  firstName: string | null
  saveJson: string | null
  stage: string | null
  utcOffsetMin: number
  lastSeenAt: number
  /** из start_param=ref_<id>; null — не задан (поле не заполняется) */
  referrerTgId: number | null
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
      `INSERT INTO users (telegram_id, username, first_name, save_json, stage, utc_offset, last_seen_at, updated_at, created_at, referrer_tg_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(telegram_id) DO UPDATE SET
         username = excluded.username,
         first_name = excluded.first_name,
         save_json = excluded.save_json,
         stage = excluded.stage,
         utc_offset = excluded.utc_offset,
         last_seen_at = excluded.last_seen_at,
         updated_at = excluded.updated_at,
         referrer_tg_id = CASE
           WHEN users.referrer_tg_id = 0 AND excluded.referrer_tg_id > 0 THEN excluded.referrer_tg_id
           ELSE users.referrer_tg_id
         END`,
      // created_at и referrer_tg_id меняются только «заполняющим» правилом:
      // дата знакомства (приток в worker/metrics.sql) и первый пригласивший
      // фиксируются навсегда
    )
    .bind(
      u.telegramId,
      u.username,
      u.firstName,
      u.saveJson,
      u.stage,
      u.utcOffsetMin,
      u.lastSeenAt,
      u.lastSeenAt,
      u.lastSeenAt,
      u.referrerTgId ?? 0,
    )
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

/** Сколько игроков пришли по ссылке этого игрока (для звёзд дружбы). */
export async function countInvited(db: D1Database, telegramId: number): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM users WHERE referrer_tg_id = ?').bind(telegramId).first<{ n: number }>()
  return row?.n ?? 0
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

/* ---------- лидерборд мини-игр ---------- */

/** Ряд таблицы рекордов: кто и сколько, имя для показа — из users (JOIN). */
export interface LeaderRow {
  telegram_id: number
  first_name: string | null
  best: number
}

/**
 * Апсерт рекордов сейва в таблицу лидерборда: по максимуму — повторный
 * синк с меньшим счётом ничего не портит. Мусор (не числа, нули и меньше)
 * не записывается.
 */
export async function upsertScores(
  db: D1Database,
  telegramId: number,
  best: Partial<Record<string, number>>,
  nowMs: number,
): Promise<void> {
  for (const [game, score] of Object.entries(best)) {
    if (typeof score !== 'number' || !Number.isFinite(score) || score <= 0) continue
    await db
      .prepare(
        `INSERT INTO scores (telegram_id, game, best, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(telegram_id, game) DO UPDATE SET
           best = MAX(best, excluded.best),
           updated_at = excluded.updated_at`,
      )
      .bind(telegramId, game, Math.floor(score), nowMs)
      .run()
  }
}

/** Топ-таблица одной игры: сильнейшие сверху, при равенстве — кто раньше. */
export async function fetchLeaderboard(db: D1Database, game: string, limit: number): Promise<LeaderRow[]> {
  const result = await db
    .prepare(
      `SELECT s.telegram_id, u.first_name, s.best
       FROM scores s JOIN users u ON u.telegram_id = s.telegram_id
       WHERE s.game = ?
       ORDER BY s.best DESC, s.updated_at ASC
       LIMIT ?`,
    )
    .bind(game, limit)
    .all<LeaderRow>()
  return result.results
}

/** Место игрока в игре: сколько рекордов строго выше его собственного; null — рекорда нет. */
export async function fetchScoreRank(db: D1Database, game: string, telegramId: number): Promise<number | null> {
  const mine = await db
    .prepare('SELECT best FROM scores WHERE game = ? AND telegram_id = ?')
    .bind(game, telegramId)
    .first<{ best: number }>()
  if (mine === null) return null
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM scores WHERE game = ? AND best > ?')
    .bind(game, mine.best)
    .first<{ n: number }>()
  return (row?.n ?? 0) + 1
}
