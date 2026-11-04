/**
 * Заглушка вместо игры вне мини-аппа в прод-сборке. Без initData сейв
 * не синхронится с сервером: питомец живёт в localStorage одного браузера
 * и теряется при смене устройства.
 *
 * Два случая: страница открыта совсем вне Telegram или в браузере Telegram,
 * но по прямой ссылке (мини-апп не запускался, initData пустой). В обоих
 * выход один — запустить мини-апп через бота; различается только текст.
 * Строка диагностики внизу — только в dev: почему гейт сработал.
 */

import { getStrings } from './i18n'

const str = getStrings()

const webApp = window.Telegram?.WebApp

/** Ссылка на бота для кнопки; задаётся VITE_BOT_URL при сборке (Settings → Variables). */
const envBotUrl: unknown = import.meta.env.VITE_BOT_URL
const BOT_URL: string | null = typeof envBotUrl === 'string' && envBotUrl !== '' ? envBotUrl : null

/** В браузере Telegram, но мини-апп не запущен: платформа при этом известна. */
const IN_TELEGRAM_BROWSER = typeof webApp?.platform === 'string' && webApp.platform !== 'unknown'

export default function TelegramGate() {
  return (
    <main className="gate">
      <div className="gate-egg" aria-hidden>
        🥚
      </div>
      <h1 className="gate-title">{str.gate.title}</h1>
      {IN_TELEGRAM_BROWSER ? (
        <p className="gate-text">{str.gate.textInTg}</p>
      ) : (
        <p className="gate-text">{str.gate.textOutside}</p>
      )}
      {BOT_URL !== null && (
        <a className="gate-button" href={BOT_URL} target="_blank" rel="noreferrer">
          {str.gate.button}
        </a>
      )}
      {import.meta.env.DEV && (
        <p className="gate-debug">
          {webApp?.platform ?? str.gate.debugNoSdk} · initData: {webApp?.initData ? str.gate.debugYes : str.gate.debugNo}
        </p>
      )}
    </main>
  )
}
