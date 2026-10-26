import type { GameConfig } from './config'
import type { PetState, Stage } from './types'

/**
 * Чистая логика пушей от бота: какие уведомления пора отправить и с каким
 * текстом. Отправкой и отметками занимается воркер, здесь только решение.
 * Результат отсортирован по важности: воркер шлёт первое, остальное — позже.
 */

/** Что уже отправляли: ключ уведомления → время отправки (мс, epoch). */
export type SentNotifications = Readonly<Record<string, number>>

export interface PendingNotification {
  kind: string
  text: string
}

const STAGE_TITLES: Record<Exclude<Stage, 'egg'>, string> = {
  baby: 'малыш',
  child: 'ребёнок',
  teen: 'подросток',
  adult: 'взрослый',
}

function petTitle(pet: PetState): string {
  return pet.name ?? 'Питомец'
}

function cooldownPassed(sent: SentNotifications, kind: string, nowMs: number, cooldownMs: number): boolean {
  const sentAt = sent[kind]
  return sentAt === undefined || nowMs - sentAt >= cooldownMs
}

export function pendingNotifications(
  pet: PetState,
  nowMs: number,
  config: GameConfig,
  lastSeenAt: number,
  sent: SentNotifications,
): PendingNotification[] {
  const result: PendingNotification[] = []

  // «в беде»: критическая шкала или болезнь — самая срочная новость
  const reasons: string[] = []
  if (pet.stats.fullness < config.criticalThreshold) reasons.push('голодает')
  if (pet.stats.happiness < config.criticalThreshold) reasons.push('грустит')
  if (pet.stats.energy < config.criticalThreshold) reasons.push('совсем вымотался')
  if (pet.stats.cleanliness < config.criticalThreshold) reasons.push('испачкался')
  if ((pet.sick || reasons.length > 0) && cooldownPassed(sent, 'critical', nowMs, config.notifications.criticalCooldownMs)) {
    result.push({
      kind: 'critical',
      text: pet.sick
        ? `🤒 ${petTitle(pet)} заболел — срочно нужен уход!`
        : `😢 ${petTitle(pet)} ${reasons.join(', ')} — загляни скорее!`,
    })
  }

  // «взросление»: одно поздравление на стадию, отметка стоит навсегда
  if (pet.stage !== 'egg' && sent[`grown:${pet.stage}`] === undefined) {
    result.push({
      kind: `grown:${pet.stage}`,
      text: `🎉 ${petTitle(pet)} вырос — теперь он ${STAGE_TITLES[pet.stage]}!`,
    })
  }

  // «скучаем»: игрока не видно дольше missYouAfterMs
  if (
    nowMs - lastSeenAt >= config.notifications.missYouAfterMs &&
    cooldownPassed(sent, 'missYou', nowMs, config.notifications.missYouCooldownMs)
  ) {
    result.push({ kind: 'missYou', text: `🥺 ${petTitle(pet)} очень скучает без тебя…` })
  }

  return result
}
