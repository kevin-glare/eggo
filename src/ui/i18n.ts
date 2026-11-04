/**
 * Мини-i18n без зависимостей. Язык определяется один раз при загрузке
 * модуля — по Telegram (language_code пользователя из initData), иначе по
 * локали браузера/устройства. Языки СНГ и пост-советского пространства —
 * русский, остальные и неизвестная локаль — английский. Переключателя в UI
 * нет: язык = локаль устройства.
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

/** Язык сессии — фиксирован на момент загрузки модуля. */
export const lang: Lang = detectLang(deviceLocale())

if (typeof document !== 'undefined') document.documentElement.lang = lang

/** Строки текущего языка. */
export function getStrings(): Strings {
  return lang === 'ru' ? ru : en
}
