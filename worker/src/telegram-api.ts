/**
 * Отправка сообщений через Bot API. Токен живёт в секретах воркера
 * и не покидает сервер.
 */

export type BotSendResult = 'ok' | 'blocked' | 'error'

/**
 * 403 — юзер заблокировал бота, 400 — чат не найден (юзер не нажал «Запустить»).
 * Оба случая означают «писать некому»: подписка гасится до повторного включения.
 * silent — доставка без звука: ночная беда информирует, но не будит.
 */
export async function sendBotMessage(
  botToken: string,
  chatId: number,
  text: string,
  silent = false,
): Promise<BotSendResult> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_notification: silent }),
    })
    const data = JSON.parse(await response.text()) as { ok?: unknown; error_code?: unknown }
    if (data.ok === true) return 'ok'
    if (data.error_code === 403 || data.error_code === 400) return 'blocked'
    return 'error'
  } catch {
    return 'error'
  }
}
