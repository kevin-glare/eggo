/**
 * Мини-i18n без зависимостей. Язык фиксируется при загрузке модуля: сначала
 * выбор в меню (localStorage), затем Telegram (language_code пользователя из
 * initData), иначе локаль браузера/устройства. Языки СНГ и пост-советского
 * пространства — русский, остальные и неизвестная локаль — английский.
 *
 * setLang меняет язык на живую: компоненты с useStrings/useLang
 * перерисовываются сами, канвасный слой читает getStrings() каждый кадр.
 * Перезагрузка страницы не нужна.
 */
import { useSyncExternalStore } from 'react'
import { ru, type Strings } from './strings/ru'
import { en } from './strings/en'

export type Lang = 'ru' | 'en'

/** Языки, для которых показываем русский интерфейс. */
const CIS_LANGS = new Set(['ru', 'uk', 'be', 'kk', 'uz', 'ky', 'tg', 'tk', 'az', 'hy', 'ka', 'mo'])

/** Чистая функция: 'ru-RU' → ru, 'de-DE' → en, пусто → en. */
export function detectLang(locale: string | null | undefined): Lang {
  if (!locale) return 'en'
  const base = locale.toLowerCase().split(/[-_]/)[0]!
  return CIS_LANGS.has(base) ? 'ru' : 'en'
}

/** Локаль устройства: сначала Telegram, потом браузер. */
function deviceLocale(): string | null {
  const tgCode =
    typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code : undefined
  if (typeof tgCode === 'string' && tgCode !== '') return tgCode
  const nav = typeof navigator !== 'undefined' ? navigator.language : null
  return nav !== null && nav !== '' ? nav : null
}

/** Хранилище выбора языка: перекрывает локаль устройства. */
const LANG_FLAG = 'eggo.lang'

/** Язык, выбранный в меню; null — выбор не сделан (или хранилище недоступно). */
function storedLang(): Lang | null {
  try {
    const raw = window.localStorage.getItem(LANG_FLAG)
    return raw === 'ru' || raw === 'en' ? raw : null
  } catch {
    return null
  }
}

let active: Lang = storedLang() ?? detectLang(deviceLocale())

if (typeof document !== 'undefined') document.documentElement.lang = active

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Текущий язык сессии. */
export function getLang(): Lang {
  return active
}

/**
 * Сменить язык на живую: строки перерисуются через useStrings/useLang,
 * выбор запоминается в localStorage. Перезагрузка страницы не нужна.
 */
export function setLang(value: Lang): void {
  if (value === active) return
  active = value
  if (typeof document !== 'undefined') document.documentElement.lang = value
  try {
    window.localStorage.setItem(LANG_FLAG, value)
  } catch {
    // приватный режим: выбор не переживёт перезагрузку — не страшно
  }
  listeners.forEach((listener) => listener())
}

/** Строки текущего языка. Для канваса: читает актуальные строки каждый кадр. */
export function getStrings(): Strings {
  return active === 'ru' ? ru : en
}

/** Строки как реактивное значение: компонент перерисовывается при смене языка. */
export function useStrings(): Strings {
  return useSyncExternalStore(subscribe, getStrings, getStrings)
}

/** Язык как реактивное значение — для подписей вроде «Язык: Русский». */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang)
}
