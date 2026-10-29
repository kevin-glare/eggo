/**
 * Заглушка вместо игры вне Telegram в прод-сборке. Без initData сейв
 * не синхронится с сервером: питомец живёт в localStorage одного браузера
 * и теряется при смене устройства — игроку нужно открыть мини-апп через бота.
 */

/** Ссылка на бота для кнопки; задаётся VITE_BOT_URL при сборке (Settings → Variables). */
const envBotUrl: unknown = import.meta.env.VITE_BOT_URL
const BOT_URL: string | null = typeof envBotUrl === 'string' && envBotUrl !== '' ? envBotUrl : null

export default function TelegramGate() {
  return (
    <main className="gate">
      <div className="gate-egg" aria-hidden>
        🥚
      </div>
      <h1 className="gate-title">Eggo живёт в Telegram</h1>
      <p className="gate-text">
        Питомец привязан к Telegram — так он сохраняется на сервере и ждёт тебя
        на любом устройстве. Открой мини-апп через бота.
      </p>
      {BOT_URL !== null && (
        <a className="gate-button" href={BOT_URL} target="_blank" rel="noreferrer">
          Открыть в Telegram
        </a>
      )}
    </main>
  )
}
