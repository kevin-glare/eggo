/**
 * Мини-i18n без зависимостей. Язык фиксируется один раз при загрузке модуля:
 * сначала выбор в меню (localStorage), затем Telegram (language_code
 * пользователя из initData), иначе локаль браузера/устройства. Языки СНГ и
 * пост-советского пространства — русский, остальные и неизвестная локаль —
 * английский.
 */
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
export function storedLang(): Lang | null {
  try {
    const raw = window.localStorage.getItem(LANG_FLAG)
    return raw === 'ru' || raw === 'en' ? raw : null
  } catch {
    return null
  }
}

/** Запомнить выбор языка; вступает в силу при перезагрузке страницы. */
export function setStoredLang(value: Lang): void {
  try {
    window.localStorage.setItem(LANG_FLAG, value)
  } catch {
    // приватный режим: выбор не переживёт перезагрузку — не страшно
  }
}

/** Язык сессии — фиксирован на момент загрузки модуля: выбор в меню, потом локаль. */
export const lang: Lang = storedLang() ?? detectLang(deviceLocale())

if (typeof document !== 'undefined') document.documentElement.lang = lang

/** Строки текущего языка. */
export function getStrings(): Strings {
  return lang === 'ru' ? ru : en
}
