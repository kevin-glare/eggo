/**
 * Интеграция с Telegram WebApp: хаптика, хром под цвет ночи,
 * синхронизация сейва с нашим API (Cloudflare Worker).
 * Вне Telegram всё превращается в безопасный no-op.
 */

/** Минимальная типизация нужной части официального SDK. */
interface TgWebApp {
  ready: () => void
  expand: () => void
  /** вне Telegram SDK отдаёт platform 'unknown' — по этому и отличаем */
  platform: string
  /** подписанные данные пользователя — на них построен вход в API */
  initData: string
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  }
  /** старое облако Telegram: читаем один раз для миграции сейва на сервер */
  CloudStorage?: {
    getItem: (key: string, cb?: (err: unknown, value: string | null) => void) => void
  }
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

/** Сколько ждём ответа API, прежде чем жить дальше по локальному сейву. */
const SYNC_TIMEOUT_MS = 10_000

/** Сколько ждём старое облако Telegram: замолчавший колбэк не должен вешать загрузку. */
const CLOUD_STORAGE_TIMEOUT_MS = 5_000

export function tg(): TgWebApp | null {
  const app = window.Telegram?.WebApp
  if (!app || app.platform === 'unknown') return null
  return app
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
 * Синк с сервером: шлём свой сейв, получаем главный (у кого lastTickAt новее).
 * null — сети нет или мы не в Telegram: живём на localStorage, повторим позже.
 * keepalive — для финального сохранения при уходе со страницы.
 */
async function serverSyncRaw(clientRaw: string | null, keepalive = false): Promise<{ save: string | null } | null> {
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
    const data = JSON.parse(await response.text()) as { save?: unknown }
    const saveRaw = typeof data.save === 'string' ? data.save : null
    return { save: saveRaw }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Публичное API хранилища для usePet. */
export const petStore = {
  loadLocal: loadLocalRaw,
  saveLocal: saveLocalRaw,
  legacyCloudLoad: legacyCloudLoadRaw,
  serverSync: serverSyncRaw,
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
