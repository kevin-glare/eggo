import { DEFAULT_CONFIG } from '../../src/game/config'
import { pendingNotifications, userLocalHour } from '../../src/game/notifications'
import { catchUp, deserialize } from '../../src/game/storage'
import { fetchPushTargets, fetchSentMap, markNotificationSent, setBotBlocked, type D1Database } from './repo'
import { FALLBACK_APPEARANCE } from './sync'
import { sendBotMessage } from './telegram-api'

/**
 * Крон: каждому подписчику досчитывает питомца тем же чистым движком,
 * что и игра, и отправляет самое важное ожидающее уведомление — остальные
 * дойдут в следующих заходах крона, без веера сообщений.
 * Ночью по местному времени игрока не будим: беда уходит без звука,
 * придержанные уведомления догонит утренний крон.
 * Досчитанное состояние не сохраняем: сейв останется как есть, его досчитает
 * клиент при следующем заходе.
 */
export async function runPushCron(db: D1Database, botToken: string): Promise<void> {
  const targets = await fetchPushTargets(db)
  for (const target of targets) {
    if (!target.save_json) continue
    const pet = deserialize(target.save_json, FALLBACK_APPEARANCE)
    if (!pet) continue

    const nowMs = Date.now()
    const sent = await fetchSentMap(db, target.telegram_id)
    const pending = pendingNotifications(
      catchUp(pet, nowMs, DEFAULT_CONFIG),
      nowMs,
      DEFAULT_CONFIG,
      target.last_seen_at,
      sent,
      userLocalHour(nowMs, target.utc_offset),
    )
    const top = pending.find((n) => n.delivery !== 'hold')
    if (!top) continue

    const result = await sendBotMessage(botToken, target.telegram_id, top.text, top.delivery === 'silent')
    if (result === 'blocked') {
      await setBotBlocked(db, target.telegram_id, nowMs)
      continue
    }
    // сетевую ошибку не отмечаем — следующий крон попробует снова
    if (result === 'ok') await markNotificationSent(db, target.telegram_id, top.kind, nowMs)
  }
}
