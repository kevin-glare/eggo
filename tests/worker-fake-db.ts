import type { D1Database, UserRow } from '../worker/src/repo'

/**
 * Фейковая D1 в памяти: понимает ровно те запросы, что пишет worker/src/repo.ts.
 * Запросы опознаются по началу строки, параметры — по порядку bind.
 */
export class FakeDb implements D1Database {
  users: UserRow[] = []
  /** ключ `${telegram_id}:${kind}` → sent_at */
  sent = new Map<string, number>()

  constructor(rows: Array<Partial<UserRow> & { telegram_id: number }> = []) {
    this.users = rows.map((row) => ({
      username: null,
      first_name: null,
      save_json: null,
      stage: null,
      push_enabled: 0,
      bot_blocked: 0,
      utc_offset: 180,
      last_seen_at: 0,
      updated_at: 0,
      ...row,
    }))
  }

  prepare(query: string) {
    return this.statement(query, [])
  }

  private statement(query: string, vals: unknown[]) {
    return {
      bind: (...next: unknown[]) => this.statement(query, next),
      first: async <T>(): Promise<T | null> => {
        if (query.startsWith('SELECT * FROM users')) {
          const id = vals[0] as number
          return (this.users.find((u) => u.telegram_id === id) ?? null) as T | null
        }
        return null
      },
      all: async <T>(): Promise<{ results: T[] }> => {
        if (query.includes('WHERE push_enabled')) {
          const results = this.users.filter((u) => u.push_enabled === 1 && u.bot_blocked === 0)
          return { results: results as unknown as T[] }
        }
        if (query.startsWith('SELECT kind, sent_at')) {
          const id = vals[0] as number
          const results = [...this.sent.entries()]
            .filter(([key]) => key.startsWith(`${id}:`))
            .map(([key, sent_at]) => ({ kind: key.slice(String(id).length + 1), sent_at }))
          return { results: results as unknown as T[] }
        }
        return { results: [] }
      },
      run: async (): Promise<unknown> => {
        if (query.startsWith('INSERT INTO notifications')) {
          const [telegram_id, kind, sent_at] = vals as [number, string, number]
          this.sent.set(`${telegram_id}:${kind}`, sent_at)
        } else if (query.startsWith('INSERT INTO users')) {
          if (vals.length === 5) {
            // ensureUser: создать, если ещё нет
            const [telegram_id, username, first_name, last_seen_at, updated_at] = vals as [
              number, string | null, string | null, number, number,
            ]
            if (!this.users.some((u) => u.telegram_id === telegram_id)) {
              this.users.push({
                telegram_id, username, first_name, save_json: null, stage: null,
                push_enabled: 0, bot_blocked: 0, utc_offset: 180, last_seen_at, updated_at,
              })
            }
          } else {
            // upsertSyncUser: обновить профиль, сейв и таймзону
            const [telegram_id, username, first_name, save_json, stage, utc_offset, last_seen_at, updated_at] =
              vals as [number, string | null, string | null, string | null, string | null, number, number, number]
            const user = this.users.find((u) => u.telegram_id === telegram_id)
            if (user) {
              Object.assign(user, {
                username, first_name, save_json, stage, utc_offset, last_seen_at, updated_at,
              })
            } else {
              this.users.push({
                telegram_id, username, first_name, save_json, stage,
                push_enabled: 0, bot_blocked: 0, utc_offset, last_seen_at, updated_at,
              })
            }
          }
        } else if (query.includes('bot_blocked = 1')) {
          const id = vals[1] as number
          const user = this.users.find((u) => u.telegram_id === id)
          if (user) user.bot_blocked = 1
        } else if (query.includes('push_enabled = ?')) {
          const id = vals[2] as number
          const user = this.users.find((u) => u.telegram_id === id)
          if (user) {
            user.push_enabled = vals[0] as number
            user.bot_blocked = 0
          }
        }
        return {}
      },
    }
  }
}
