import { useCallback, useEffect, useRef, useState } from 'react'
import { rollAppearance } from '../game/appearance'
import {
  feed,
  namePet,
  pet as petAction,
  play,
  startSleep,
  wake,
  wash,
  type ActionReason,
  type ActionResult,
} from '../game/actions'
import type { GameConfig } from '../game/config'
import { createPet, tick } from '../game/engine'
import { recordQuest, type QuestId } from '../game/quests'
import { catchUp, deserialize, mergeRemoteSave, serialize } from '../game/storage'
import type { PetState } from '../game/types'
import { hapticSuccess, hapticWarning, initTelegram, petStore } from '../telegram'

const REASON_TEXT: Record<ActionReason, string> = {
  'not-hatched': '🥚 Питомец ещё не вылупился',
  sleeping: '🤫 Питомец спит',
  'too-tired': '😵 Слишком устал — пусть поспит',
  'already-full': '😋 Уже сыт — не лопнет',
  'already-happy': '😄 Уже счастлив по полной',
  'already-clean': '✨ Уже сияет чистотой',
  'already-named': '🏷️ Имя уже есть — другое не дать',
  'invalid-name': '✏️ От 1 до 16 символов',
}

/** Как часто синхроним сейв с сервером (локально — при каждом изменении). */
const SERVER_SYNC_INTERVAL_MS = 10_000

function initialPet(): PetState | null {
  // локальный сейв; если его нет — null: новое яйцо не создаём, пока
  // стартовый синк не выяснит, есть ли питомец у пользователя на сервере
  const raw = petStore.loadLocal()
  if (raw === null) return null
  return deserialize(raw, rollAppearance(Math.random))
}

/**
 * Жизненный цикл питомца в React: сейв (локально + сервер),
 * тик раз в секунду, действия с обратной связью и хаптикой.
 */
export function usePet(config: GameConfig) {
  const [pet, setPet] = useState<PetState | null>(() => initialPet())
  const [notice, setNotice] = useState<string | null>(null)
  const petRef = useRef(pet)
  petRef.current = pet
  const prevStageRef = useRef<PetState['stage'] | null>(pet?.stage ?? null)
  const lastSyncRef = useRef(0)

  // старт: Telegram-инициализация, разовая миграция старого облака Telegram
  // и сервер-синк. Сравнение сейвов честное — по lastTickAt до досчёта времени.
  // Своего питомца нет или он ещё без имени — серверу ничего не предлагаем:
  // новый девайс сначала узнаёт, есть ли питомец в базе, а не плодит яйцо
  useEffect(() => {
    initTelegram()
    let cancelled = false
    void (async () => {
      const local = petRef.current
      const fallbackAppearance = local?.appearance ?? rollAppearance(Math.random)
      let best = local
      // подстраховка: непредвиденный бросок не должен оставлять экран загрузки навсегда
      try {
        const legacyRaw = await petStore.legacyCloudLoad()
        if (legacyRaw !== null) best = mergeRemoteSave(legacyRaw, best, fallbackAppearance) ?? best
        const payload = best?.name != null ? serialize(best) : null
        const response = await petStore.serverSync(payload)
        if (response !== null) best = mergeRemoteSave(response.save, best, fallbackAppearance) ?? best
      } catch {
        // живём на локальном сейве (или новом яйце ниже)
      }
      // питомца нет нигде — новая игра; чужой сейв досчитываем по времени отсутствия
      const resolved = best ?? createPet(Date.now(), config, rollAppearance(Math.random))
      if (!cancelled && resolved !== local) setPet(catchUp(resolved, Date.now(), config))
    })()
    return () => {
      cancelled = true
    }
  }, [config])

  // при запуске досчитываем всё время, пока приложение было закрыто
  useEffect(() => {
    setPet((p) => (p === null ? p : catchUp(p, Date.now(), config)))
  }, [config])

  useEffect(() => {
    const id = window.setInterval(() => setPet((p) => (p === null ? p : catchUp(p, Date.now(), config))), 1000)
    return () => window.clearInterval(id)
  }, [config])

  // сохранение: локально сразу, на сервер — не чаще раза в SERVER_SYNC_INTERVAL_MS.
  // Безымянное яйцо — ещё не питомец: на сервер не льём, иначе второй девайс
  // с новым яйцом перезапишет настоящего питомца из базы
  useEffect(() => {
    if (pet === null) return
    const raw = serialize(pet)
    petStore.saveLocal(raw)
    if (pet.name === null) return
    const now = Date.now()
    if (now - lastSyncRef.current >= SERVER_SYNC_INTERVAL_MS) {
      lastSyncRef.current = now
      void petStore.serverSync(raw)
    }
  }, [pet])

  // при уходе со страницы — залить актуальный сейв на сервер
  useEffect(() => {
    const flush = () => {
      const current = petRef.current
      if (current?.name != null) void petStore.serverSync(serialize(current), true)
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  // событие вылупления
  useEffect(() => {
    if (pet !== null) {
      if (prevStageRef.current === 'egg' && pet.stage !== 'egg') {
        setNotice(`🎉 ${pet.name ?? 'Питомец'} вылупился!`)
      }
      prevStageRef.current = pet.stage
    }
  }, [pet?.stage, pet?.name])

  // уведомления сами исчезают
  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(id)
  }, [notice])

  const apply = useCallback(
    (action: (p: PetState, c: GameConfig) => ActionResult, successText: string, questId?: QuestId) => {
      const current = petRef.current
      if (current === null) return null
      const result = action(current, config)
      // успешное действие отмечается в заданиях дня (создаёт daily при первом за день)
      setPet(questId && result.ok ? recordQuest(result.state, questId, config, Date.now()) : result.state)
      if (result.ok) {
        setNotice(successText)
        hapticSuccess()
      } else {
        setNotice(REASON_TEXT[result.reason ?? 'not-hatched'] ?? '')
        hapticWarning()
      }
      return result
    },
    [config],
  )

  const feedPet = useCallback(() => apply(feed, '🍗 Ням-ням!', 'feed'), [apply])
  const playPet = useCallback(() => apply(play, '😄 Было весело!', 'play'), [apply])
  const washPet = useCallback(() => apply(wash, '🛁 Чистота!', 'wash'), [apply])

  // кулдаун поглаживания живёт в сессии: сердечки при любом тапе остаются,
  // но счастье капает не чаще config.actions.pet.cooldownMs
  const lastPetAtRef = useRef(0)
  const petPet = useCallback(() => {
    const now = Date.now()
    if (now - lastPetAtRef.current < config.actions.pet.cooldownMs) return null
    const result = apply(petAction, '💗 Мур-мур!', 'pet')
    if (result?.ok) lastPetAtRef.current = now
    return result
  }, [apply, config])

  /**
   * Дать имя питомцу: без имени игра не начинается.
   * Работает и для свежего яйца, и для старого безымянного сейва.
   */
  const startGame = useCallback(
    (rawName: string) => {
      const current = petRef.current
      if (current === null) return false
      const result = namePet(current, rawName, config)
      if (!result.ok) {
        setNotice(REASON_TEXT[result.reason ?? 'invalid-name'] ?? '')
        hapticWarning()
        return false
      }
      setPet(result.state)
      hapticSuccess()
      setNotice(result.state.stage === 'egg' ? '🥚 Появилось яйцо!' : `🎉 ${result.state.name} — отличное имя!`)
      return true
    },
    [config],
  )
  const toggleSleep = useCallback(() => {
    const current = petRef.current
    if (current === null) return null
    const sleeping = current.sleeping
    return sleeping ? apply(wake, '☀️ Проснулся!') : apply(startSleep, '😴 Спокойной ночи!')
  }, [apply])

  /** Dev-инструмент: прокрутить игровое время вперёд. */
  const advanceTime = useCallback(
    (gameMs: number) => {
      setPet((p) => (p === null ? p : tick(p, gameMs, config)))
    },
    [config],
  )

  const reset = useCallback(() => {
    // новая игра — новая случайная внешность
    setPet(createPet(Date.now(), config, rollAppearance(Math.random)))
    lastSyncRef.current = 0
    setNotice('🥚 Новая игра — дай имя!')
  }, [config])

  return { pet, notice, feedPet, playPet, washPet, petPet, toggleSleep, startGame, advanceTime, reset }
}
