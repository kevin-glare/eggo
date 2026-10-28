import type { GameConfig } from './config'
import type { PetState, Stage } from './types'

/**
 * Чистая логика пушей от бота: какие уведомления пора отправить и с каким
 * текстом. Отправкой и отметками занимается воркер, здесь только решение.
 * Результат отсортирован по важности: воркер шлёт первое, остальное — позже.
 * Ночью по местному времени игрока пуш не будит: беда уходит молча,
 * радостное и «скучаем» придерживаются до утра (delivery = 'hold').
 */

/** Что уже отправляли: ключ уведомления → время отправки (мс, epoch). */
export type SentNotifications = Readonly<Record<string, number>>

export interface PendingNotification {
  kind: string
  text: string
  /** как доставлять: сейчас, молча (без звука) или придержать до утра */
  delivery: 'now' | 'silent' | 'hold'
}

/** Местный час игрока (0–23): nowMs в epoch, смещение — минуты к востоку от UTC. */
export function userLocalHour(nowMs: number, utcOffsetMin: number): number {
  return new Date(nowMs + utcOffsetMin * 60_000).getUTCHours()
}

/** Тихие часы: окно может переходить через полночь (22 → 9); from === to — окна нет. */
export function isQuietHour(localHour: number, config: GameConfig): boolean {
  const { from, to } = config.notifications.quietHours
  if (from === to) return false
  return from < to
    ? localHour >= from && localHour < to
    : localHour >= from || localHour < to
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
  localHour: number,
): PendingNotification[] {
  const result: PendingNotification[] = []
  // ночью не будим: беда уходит без звука, остальное ждёт утра
  const quiet = isQuietHour(localHour, config)

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
      delivery: quiet ? 'silent' : 'now',
    })
  }

  // «взросление»: одно поздравление на стадию, отметка стоит навсегда
  if (pet.stage !== 'egg' && sent[`grown:${pet.stage}`] === undefined) {
    result.push({
      kind: `grown:${pet.stage}`,
      text: `🎉 ${petTitle(pet)} вырос — теперь он ${STAGE_TITLES[pet.stage]}!`,
      delivery: quiet ? 'hold' : 'now',
    })
  }

  // «выспался»: спит с полным запасом энергии — зовём будить
  if (pet.sleeping && pet.stats.energy >= 100 && cooldownPassed(sent, 'slept', nowMs, config.notifications.sleptCooldownMs)) {
    result.push({
      kind: 'slept',
      text: `☀️ ${petTitle(pet)} выспался — разбуди его!`,
      delivery: quiet ? 'hold' : 'now',
    })
  }

  // «пора спать»: мягкий намёк уложить, когда беды ещё нет — при беде и болезни кричит critical
  if (
    !pet.sleeping &&
    !pet.sick &&
    reasons.length === 0 &&
    pet.stats.energy < config.notifications.sleepyThreshold &&
    cooldownPassed(sent, 'sleepy', nowMs, config.notifications.sleepyCooldownMs)
  ) {
    result.push({
      kind: 'sleepy',
      text: `🥱 ${petTitle(pet)} зевает — уложи его спать!`,
      delivery: quiet ? 'silent' : 'now',
    })
  }

  // «скучаем»: игрока не видно дольше missYouAfterMs
  if (
    nowMs - lastSeenAt >= config.notifications.missYouAfterMs &&
    cooldownPassed(sent, 'missYou', nowMs, config.notifications.missYouCooldownMs)
  ) {
    result.push({ kind: 'missYou', text: `🥺 ${petTitle(pet)} очень скучает без тебя…`, delivery: quiet ? 'hold' : 'now' })
  }

  return result
}
