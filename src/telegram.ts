/**
 * Интеграция с Telegram WebApp: хаптика, хром под цвет ночи,
 * синхронизация сейва с нашим API (Cloudflare Worker).
 * Вне Telegram всё превращается в безопасный no-op.
 */

import { track } from './metrika'

/** Минимальная типизация нужной части официального SDK. */
interface TgWebApp {
  ready: () => void
  expand: () => void
  /** вне Telegram SDK отдаёт platform 'unknown' — по этому и отличаем */
  platform: string
  /** подписанные данные пользователя — на них построен вход в API */
  initData: string
  /** разобранные данные запуска; нужны язык пользователя и его id (ссылка-приглашение) */
  initDataUnsafe?: { user?: { id?: number; language_code?: string } }
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  }
  /** облако Telegram: аварийная копия сейва (живёт мимо Cloudflare и чистки localStorage) */
  CloudStorage?: {
    getItem: (key: string, cb?: (err: unknown, value: string | null) => void) => void
    setItem: (key: string, value: string, cb?: (err: unknown, ok: boolean) => void) => void
  }
  /** открыть ссылку t.me/… штатным клиентом Telegram (шер, канал, чат автора) */
  openTelegramLink?: (url: string) => void
  /** системная кнопка «Назад» в шапке Telegram: показываем в меню */
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  /** Bot API 7.7+: вертикальный свайп не сворачивает мини-апп — игры водят пальцем по экрану */
  disableVerticalSwipes?: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp }
  }
}

/** Цвет хрома Telegram совпадает с фоном приложения — бесшовный переход. */
const APP_BG = '#221736'

export const SAVE_KEY = 'tamagotchi.save.v1'

/** Отметка в localStorage: старое облако Telegram уже переехало на сервер. */
const MIGRATED_FLAG = 'tamagotchi.migrated.v1'

/** Адрес API-воркера; для продакшена задаётся VITE_API_URL при сборке. */
const envApiUrl: unknown = import.meta.env.VITE_API_URL
const API_URL = typeof envApiUrl === 'string' && envApiUrl !== '' ? envApiUrl : 'http://localhost:8787'

/** Ссылка на бота (t.me/…): шер и заглушка гейта; задаётся VITE_BOT_URL при сборке. */
const envBotUrl: unknown = import.meta.env.VITE_BOT_URL
export const BOT_URL: string | null = typeof envBotUrl === 'string' && envBotUrl !== '' ? envBotUrl : null

/** Сколько ждём ответа API, прежде чем жить дальше по локальному сейву. */
const SYNC_TIMEOUT_MS = 10_000

/** POST с телом часто теряется по пути (мобильные сети) — повторяем попытки. */
const SYNC_RETRIES = 3
/** Пауза перед ретраем растёт с номером попытки: душащая сеть отпускает не сразу. */
const SYNC_RETRY_DELAYS_MS = [1_500, 3_000, 6_000] as const

/** Сколько ждём старое облако Telegram: замолчавший колбэк не должен вешать загрузку. */
const CLOUD_STORAGE_TIMEOUT_MS = 5_000

export function tg(): TgWebApp | null {
  const app = window.Telegram?.WebApp
  if (!app || app.platform === 'unknown') return null
  return app
}

/** Ссылка «позови друга»: t.me/<бот>?startapp=ref_<мой id>. null — вне Telegram или нет ссылки на бота. */
export function referralLink(): string | null {
  if (BOT_URL === null) return null
  const id = tg()?.initDataUnsafe?.user?.id
  return typeof id === 'number' ? `${BOT_URL}?startapp=ref_${id}` : null
}

/**
 * Открыто как мини-апп: подписанные данные запуска на месте.
 * Платформу намеренно не проверяем: часть клиентов (старые десктопы,
 * сторонние сборки) отдаёт platform 'unknown', но initData им приходит.
 */
export function hasTelegramSession(): boolean {
  const data = window.Telegram?.WebApp?.initData
  return typeof data === 'string' && data !== ''
}

/** Вызвать один раз на старте. */
export function initTelegram(): void {
  const app = tg()
  if (!app) return
  app.ready()
  app.expand()
  app.setHeaderColor?.(APP_BG)
  app.setBackgroundColor?.(APP_BG)
  // свайп вниз не должен сворачивать мини-апп: змейка и кормление водят пальцем вниз
  app.disableVerticalSwipes?.()
}

export function hapticTap(): void {
  tg()?.HapticFeedback?.impactOccurred('light')
}

export function hapticSuccess(): void {
  tg()?.HapticFeedback?.notificationOccurred('success')
}

export function hapticWarning(): void {
  tg()?.HapticFeedback?.notificationOccurred('warning')
}

function loadLocalRaw(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY)
  } catch {
    return null
  }
}

function saveLocalRaw(raw: string): void {
  try {
    localStorage.setItem(SAVE_KEY, raw)
  } catch {
    // приватный режим браузера — сейв просто останется только в памяти сессии
  }
}

/**
 * Разовая миграция: последний раз читаем сейв из облака Telegram
 * (теперь главное облако — наш сервер). null — мигрировать нечего или уже.
 */
async function legacyCloudLoadRaw(): Promise<string | null> {
  try {
    if (localStorage.getItem(MIGRATED_FLAG) !== null) return null
  } catch {
    return null
  }
  // ответ «окончательный», только если колбэк пришёл: при таймауте миграцию
  // не отмечаем — вдруг облако просто медленное, попробуем в следующий запуск
  let definitive = false
  const raw = await new Promise<string | null>((resolve) => {
    const cs = tg()?.CloudStorage
    if (!cs) {
      definitive = true
      resolve(null)
      return
    }
    const timer = setTimeout(() => resolve(null), CLOUD_STORAGE_TIMEOUT_MS)
    cs.getItem(SAVE_KEY, (err, value) => {
      clearTimeout(timer)
      definitive = true
      resolve(err ? null : value)
    })
  })
  if (!definitive) return raw
  try {
    localStorage.setItem(MIGRATED_FLAG, '1')
  } catch {
    // приватный режим: попробуем ещё в следующий запуск
  }
  return raw
}

/**
 * Одна попытка POST /sync: шлём свой сейв, получаем главный (у кого
 * lastTickAt новее) и счётчик приглашённых (для звёзд дружбы).
 * null — сети нет или мы не в Telegram.
 */
async function syncAttempt(
  clientRaw: string | null,
  keepalive: boolean,
): Promise<{ save: string | null; invited: number | null } | null> {
  const initData = tg()?.initData
  if (!initData) return null
  // AbortController руками, а не AbortSignal.timeout: старые WebView его не умеют
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // tzOffset — таймзона устройства в минутах к востоку от UTC:
      // по ней сервер знает местный час и не будит ночными пушами
      body: JSON.stringify({ initData, save: clientRaw, tzOffset: -new Date().getTimezoneOffset() }),
      keepalive,
      signal: controller.signal,
    })
    if (!response.ok) return null
    const data = JSON.parse(await response.text()) as { save?: unknown; invited?: unknown }
    const saveRaw = typeof data.save === 'string' ? data.save : null
    const invited = typeof data.invited === 'number' && data.invited >= 0 ? data.invited : null
    return { save: saveRaw, invited }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Пауза перед ретраем: база растёт с номером попытки (1.5с → 3с → 6с),
 * поверх — джиттер ±30%, чтобы ретраи разных устройств не ходили стаей.
 */
function retryDelayMs(attempt: number): number {
  const index = Math.max(0, Math.min(attempt - 1, SYNC_RETRY_DELAYS_MS.length - 1))
  const base = SYNC_RETRY_DELAYS_MS[index] ?? SYNC_RETRY_DELAYS_MS[0]
  return Math.round(base * (0.7 + Math.random() * 0.6))
}

/**
 * Синк с сервером с ретраями: мобильные сети нередко теряют POST с телом,
 * повторные попытки через растущую паузу часто доезжают. Успех со 2+ попытки
 * и полный провал считаем в Метрике — видно, скольким сетям не везёт.
 * keepalive (финальное сохранение при уходе со страницы) не повторяется —
 * страница умирает.
 */
async function serverSyncRaw(
  clientRaw: string | null,
  keepalive = false,
): Promise<{ save: string | null; invited: number | null } | null> {
  if (!tg()?.initData) return null
  const attempts = keepalive ? 1 : 1 + SYNC_RETRIES
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt)))
    const result = await syncAttempt(clientRaw, keepalive)
    if (result !== null) {
      if (attempt > 0) track('sync-recovered')
      return result
    }
  }
  track('sync-fail')
  return null
}

/**
 * Запасной pull: часть мобильных сетей стабильно теряет POST с телом,
 * а простой GET доезжает. Читаем слитый сейв из базы, ничего не шлём;
 * отсутствие Content-Type в запросе избавляет от preflight-OPTIONS.
 */
async function serverPullRaw(): Promise<{ save: string | null } | null> {
  const initData = tg()?.initData
  if (!initData) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_URL}/sync?initData=${encodeURIComponent(initData)}`, {
      signal: controller.signal,
    })
    if (!response.ok) return null
    const data = JSON.parse(await response.text()) as { save?: unknown }
    return { save: typeof data.save === 'string' ? data.save : null }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Публичное API хранилища для usePet. */
/**
 * Одна запись в CloudStorage с таймаутом: замолчавший колбэк не вешает сохранение.
 * false — вне Telegram, нет API или сеть подвела.
 */
function cloudSetItem(key: string, value: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cs = tg()?.CloudStorage
    if (!cs?.setItem) {
      resolve(false)
      return
    }
    const timer = setTimeout(() => resolve(false), CLOUD_STORAGE_TIMEOUT_MS)
    cs.setItem(key, value, (err) => {
      clearTimeout(timer)
      resolve(!err)
    })
  })
}

/** Одно чтение из CloudStorage с таймаутом; null — нет API, ошибка или тишина. */
function cloudGetItem(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    const cs = tg()?.CloudStorage
    if (!cs) {
      resolve(null)
      return
    }
    const timer = setTimeout(() => resolve(null), CLOUD_STORAGE_TIMEOUT_MS)
    cs.getItem(key, (err, value) => {
      clearTimeout(timer)
      resolve(err ? null : value)
    })
  })
}

/** Лимит значения CloudStorage — 4096 символов: чанк с запасом. */
const BACKUP_CHUNK_CHARS = 3600
/** Ключи бэкапа: счётчик чанков и сами чанки (точки в ключах CloudStorage запрещены). */
const BACKUP_COUNT_KEY = 'eggo_bk_n'
const BACKUP_MAX_CHUNKS = 8
const backupChunkKey = (i: number): string => `eggo_bk_${i}`

/**
 * Аварийная копия сейва в облаке Telegram: localStorage в мини-аппе вычищается
 * между сессиями, а сервер может не получить последний POST (душащая сеть).
 * Облако ходит через Telegram, мимо Cloudflare, и переживает чистку хранилища.
 * Чанки ≤ BACKUP_CHUNK_CHARS, счётчик пишется последним и служит маркером
 * целостности: не дошла запись до конца — старый счётчик оставит бэкап
 * целиком предыдущим, а не пополам со старым.
 */
export async function cloudBackupSave(raw: string): Promise<void> {
  const chunks: string[] = []
  for (let i = 0; i < raw.length; i += BACKUP_CHUNK_CHARS) chunks.push(raw.slice(i, i + BACKUP_CHUNK_CHARS))
  if (chunks.length > BACKUP_MAX_CHUNKS) return
  for (const [i, chunk] of chunks.entries()) {
    if (!(await cloudSetItem(backupChunkKey(i), chunk))) return
  }
  await cloudSetItem(BACKUP_COUNT_KEY, String(chunks.length))
}

/** Аварийная копия из облака Telegram; частичный или кривой набор — null. */
export async function cloudBackupLoad(): Promise<string | null> {
  const countRaw = await cloudGetItem(BACKUP_COUNT_KEY)
  const count = Number(countRaw)
  if (!Number.isInteger(count) || count < 1 || count > BACKUP_MAX_CHUNKS) return null
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const part = await cloudGetItem(backupChunkKey(i))
    if (part === null) return null
    parts.push(part)
  }
  return parts.join('')
}

/** Публичное API хранилища для usePet. */
export const petStore = {
  loadLocal: loadLocalRaw,
  saveLocal: saveLocalRaw,
  legacyCloudLoad: legacyCloudLoadRaw,
  cloudBackupSave,
  cloudBackupLoad,
  serverSync: serverSyncRaw,
  serverPull: serverPullRaw,
} as const

/** Состояние пушей: 'on' | 'off'; null — не в Telegram или сеть подвела. */
export async function fetchNotifyState(): Promise<'on' | 'off' | null> {
  const initData = tg()?.initData
  if (!initData) return null
  try {
    const response = await fetch(`${API_URL}/notify?initData=${encodeURIComponent(initData)}`)
    if (!response.ok) return null
    const data = JSON.parse(await response.text()) as { enabled?: unknown }
    return data.enabled === true ? 'on' : 'off'
  } catch {
    return null
  }
}

/** Топ-таблица мини-игры: имена из Telegram и место звонящего. */
export interface LeaderboardView {
  rows: { place: number; name: string; best: number }[]
  /** место игрока в этой игре; null — своего рекорда ещё нет */
  you: number | null
}

/** Лидерборд одной игры; null — не в Telegram, сеть подвела или пустая таблица. */
export async function fetchLeaderboard(game: string): Promise<LeaderboardView | null> {
  const initData = tg()?.initData
  if (!initData) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
  try {
    const response = await fetch(
      `${API_URL}/leaderboard?initData=${encodeURIComponent(initData)}&game=${encodeURIComponent(game)}`,
      { signal: controller.signal },
    )
    if (!response.ok) return null
    const data = JSON.parse(await response.text()) as { rows?: unknown; you?: unknown }
    if (!Array.isArray(data.rows)) return null
    const rows: LeaderboardView['rows'] = []
    for (const r of data.rows) {
      const row = r as { place?: unknown; name?: unknown; best?: unknown }
      if (typeof row.place === 'number' && typeof row.name === 'string' && typeof row.best === 'number') {
        rows.push({ place: row.place, name: row.name, best: row.best })
      }
    }
    if (rows.length === 0) return null
    return { rows, you: typeof data.you === 'number' ? data.you : null }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Включить/выключить пуши. 'blocked' — юзер не стартовал бота или заблокировал его. */
export async function setNotifyEnabled(enabled: boolean): Promise<'ok' | 'blocked' | 'error'> {
  const initData = tg()?.initData
  if (!initData) return 'error'
  try {
    const response = await fetch(`${API_URL}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, enabled }),
    })
    if (!response.ok) return 'error'
    const data = JSON.parse(await response.text()) as { ok?: unknown; error?: unknown }
    if (data.ok === true) return 'ok'
    return data.error === 'blocked' ? 'blocked' : 'error'
  } catch {
    return 'error'
  }
}
