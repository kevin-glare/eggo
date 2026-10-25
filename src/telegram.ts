import type { GameConfig } from './game/config'
import { catchUp, deserialize } from './game/storage'
import type { PetState } from './game/types'

/**
 * Интеграция с Telegram WebApp: хаптика, хром под цвет ночи,
 * облачный сейв (общий на все устройства юзера).
 * Вне Telegram всё превращается в безопасный no-op.
 */

/** Минимальная типизация нужной части официального SDK. */
interface TgWebApp {
  ready: () => void
  expand: () => void
  /** вне Telegram SDK отдаёт platform 'unknown' — по этому и отличаем */
  platform: string
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  }
  CloudStorage?: {
    setItem: (key: string, value: string, cb?: (err: unknown, ok: boolean) => void) => void
    getItem: (key: string, cb: (err: unknown, value: string | null) => void) => void
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

export function tg(): TgWebApp | null {
  const app = window.Telegram?.WebApp
  if (!app || app.platform === 'unknown') return null
  return app
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

function cloudLoadRaw(): Promise<string | null> {
  return new Promise((resolve) => {
    const cs = tg()?.CloudStorage
    if (!cs) {
      resolve(null)
      return
    }
    cs.getItem(SAVE_KEY, (err, value) => resolve(err ? null : value))
  })
}

function cloudSaveRaw(raw: string): Promise<void> {
  return new Promise((resolve) => {
    const cs = tg()?.CloudStorage
    if (!cs) {
      resolve()
      return
    }
    cs.setItem(SAVE_KEY, raw, () => resolve())
  })
}

/** Публичное API хранилища для usePet. */
export const petStore = {
  loadLocal: loadLocalRaw,
  saveLocal: saveLocalRaw,
  cloudLoad: cloudLoadRaw,
  cloudSave: cloudSaveRaw,
} as const

/**
 * Слияние при старте: у кого lastTickAt новее (позже сохранялся), тот и главный.
 * Облачный сейв сразу досчитывает время, пока приложение было закрыто.
 */
export function mergeCloudSave(cloudRaw: string | null, local: PetState, config: GameConfig): PetState {
  if (!cloudRaw) return local
  // у облачного сейва без внешности (старая версия) оставляем локальную
  const cloud = deserialize(cloudRaw, local.appearance)
  if (!cloud || cloud.lastTickAt <= local.lastTickAt) return local
  return catchUp(cloud, Date.now(), config)
}
