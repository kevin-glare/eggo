import { DAY, type GameConfig } from './config'
import type { PetState, Stage } from './types'

/**
 * Чистая логика пушей от бота: какие уведомления пора отправить и с каким
 * текстом. Отправкой и отметками занимается воркер, здесь только решение.
 * Результат отсортирован по важности: воркер шлёт первое, остальное — позже.
 * Ночью по местному времени игрока пуш не будит: беда уходит молча,
 * радостное и «скучаем» придерживаются до утра (delivery = 'hold').
 * Спящий питомец: уход во сне заблокирован, поэтому советы заботы начинаются
 * с будильника («Разбудить»), а «вымотался» во сне бедой не считается.
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

/** Пуш из двух строк: что случилось + что делать игроку. */
function withAction(headline: string, action: string): string {
  return `${headline}\n\nЧто делать: ${action}`
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
  // игрок недавно был в приложении и сам всё видит: несрочные пуши молчат,
  // беда (critical) кричит всегда
  const active = nowMs - lastSeenAt < config.notifications.activityWindowMs

  // питомец ушёл: обычных новостей больше нет — есть только прощание, и оно
  // одно на питомца (createdAt в ключе): отметки в D1 вечны, «начать заново»
  // создаёт питомца с другим createdAt — его прощание будет отдельным
  if (pet.ranAwayAt !== null) {
    const kind = `ranAway:${pet.createdAt}`
    if (sent[kind] === undefined) {
      result.push({
        kind,
        text: withAction(
          `💔 ${petTitle(pet)} ушёл искать нового хозяина…`,
          'загляни в Eggo — можно начать заново и взять новое яйцо',
        ),
        delivery: quiet ? 'hold' : 'now',
      })
    }
    return result
  }

  // «в беде»: критическая шкала или болезнь — самая срочная новость.
  // «вымотался» во сне бедой не считаем: энергия растёт сама, будить вредно.
  const reasons: string[] = []
  if (pet.stats.fullness < config.criticalThreshold) reasons.push('голодает')
  if (pet.stats.happiness < config.criticalThreshold) reasons.push('грустит')
  if (!pet.sleeping && pet.stats.energy < config.criticalThreshold) reasons.push('совсем вымотался')
  if (pet.stats.cleanliness < config.criticalThreshold) reasons.push('испачкался')
  if ((pet.sick || reasons.length > 0) && cooldownPassed(sent, 'critical', nowMs, config.notifications.criticalCooldownMs)) {
    // каждая беда — конкретное действие той же кнопкой в Eggo
    const actionByReason: Record<string, string> = {
      голодает: 'покорми',
      грустит: 'поиграй в мини-игру',
      'совсем вымотался': 'уложи спать',
      испачкался: 'помой',
    }
    const actions = reasons.map((r) => actionByReason[r] ?? 'загляни в Eggo')
    // во сне кормить/играть/мыть движок отказывает: любой уход начинается с будильника
    const action = pet.sleeping
      ? `открой Eggo, нажми «Разбудить», потом ${actions.join(', ')}`
      : `открой Eggo и ${actions.join(', ')}`
    result.push({
      kind: 'critical',
      text: pet.sick
        ? withAction(
            `🤒 ${petTitle(pet)} заболел — срочно нужен уход!`,
            pet.sleeping
              ? 'открой Eggo, нажми «Разбудить», потом покорми питомца, поиграй и помой его — при хорошем уходе он выздоровеет сам'
              : 'открой Eggo, покорми питомца, поиграй и помой его — при хорошем уходе он выздоровеет сам',
          )
        : withAction(
            pet.sleeping
              ? `😴 ${petTitle(pet)} спит, но ${reasons.join(', ')} — загляни скорее!`
              : `😢 ${petTitle(pet)} ${reasons.join(', ')} — загляни скорее!`,
            action,
          ),
      delivery: quiet ? 'silent' : 'now',
    })
  }

  // «взросление»: одно поздравление на стадию, отметка стоит навсегда
  if (pet.stage !== 'egg' && sent[`grown:${pet.stage}`] === undefined) {
    result.push({
      kind: `grown:${pet.stage}`,
      text: withAction(`🎉 ${petTitle(pet)} вырос — теперь он ${STAGE_TITLES[pet.stage]}!`, 'загляни в Eggo — посмотри, каким стал питомец'),
      delivery: quiet ? 'hold' : 'now',
    })
  }

  // «ухожу»: предупреждения за пару дней до ухода — от последнего визита
  // воркера (lastSeenAt). Ключ с lastSeenAt = одно предупреждение на разлуку:
  // визит перезаводит счётчик и даёт следующей разлуке новый ключ, а новому
  // питомцу достанутся свои отметки. Дни в текстах выводятся из config.runaway
  const warnDay = Math.round(config.runaway.warnAfterMs / DAY)
  const warnLeft = Math.round((config.runaway.afterMs - config.runaway.warnAfterMs) / DAY)
  const finalLeft = Math.round((config.runaway.afterMs - config.runaway.finalWarnAfterMs) / DAY)
  const dayWord = (n: number): string => (n === 1 ? 'день' : 'дн.')
  if (!active && nowMs - lastSeenAt >= config.runaway.warnAfterMs && sent[`leaveWarn:${lastSeenAt}`] === undefined) {
    result.push({
      kind: `leaveWarn:${lastSeenAt}`,
      text: withAction(
        `😢 ${petTitle(pet)} ждёт тебя уже ${warnDay}-й день: ещё ${warnLeft} ${dayWord(warnLeft)} без визита — и он уйдёт…`,
        'загляни в Eggo — один визит, и питомец останется с тобой',
      ),
      delivery: quiet ? 'hold' : 'now',
    })
  }

  // финальное предупреждение накануне ухода
  if (!active && nowMs - lastSeenAt >= config.runaway.finalWarnAfterMs && sent[`leaveWarnFinal:${lastSeenAt}`] === undefined) {
    result.push({
      kind: `leaveWarnFinal:${lastSeenAt}`,
      text: withAction(
        `⚠️ Ещё ${finalLeft} ${dayWord(finalLeft)} — и ${petTitle(pet)} уйдёт, если ты не заглянешь!`,
        'открой Eggo — один визит, и счёт дней начнётся заново',
      ),
      delivery: quiet ? 'hold' : 'now',
    })
  }

  // «выспался»: спит с полным запасом энергии — зовём будить
  if (!active && pet.sleeping && pet.stats.energy >= 100 && cooldownPassed(sent, 'slept', nowMs, config.notifications.sleptCooldownMs)) {
    result.push({
      kind: 'slept',
      text: withAction(`☀️ ${petTitle(pet)} выспался — разбуди его!`, 'открой Eggo и нажми «Разбудить» — он полон сил и готов играть'),
      delivery: quiet ? 'hold' : 'now',
    })
  }

  // «пора спать»: мягкий намёк уложить, когда беды ещё нет — при беде и болезни кричит critical
  if (
    !active &&
    !pet.sleeping &&
    !pet.sick &&
    reasons.length === 0 &&
    pet.stats.energy < config.notifications.sleepyThreshold &&
    cooldownPassed(sent, 'sleepy', nowMs, config.notifications.sleepyCooldownMs)
  ) {
    result.push({
      kind: 'sleepy',
      text: withAction(`🥱 ${petTitle(pet)} зевает — уложи его спать!`, 'открой Eggo и нажми «Спать» — за ночь энергия восстановится'),
      delivery: quiet ? 'silent' : 'now',
    })
  }

  // «скучаем»: игрока не видно дольше missYouAfterMs
  if (
    !active &&
    nowMs - lastSeenAt >= config.notifications.missYouAfterMs &&
    cooldownPassed(sent, 'missYou', nowMs, config.notifications.missYouCooldownMs)
  ) {
    result.push({
      kind: 'missYou',
      text: withAction(
        `🥺 ${petTitle(pet)} очень скучает без тебя…`,
        // спящего ухода не будет: будильник — первое действие и здесь
        pet.sleeping
          ? 'открой Eggo, нажми «Разбудить», потом покорми питомца с руки, поиграй и помой его'
          : 'загляни в Eggo — покорми питомца с руки, поиграй и помой его',
      ),
      delivery: quiet ? 'hold' : 'now',
    })
  }

  return result
}
