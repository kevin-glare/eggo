import { useCallback, useEffect, useRef, useState } from 'react'
import { rollAppearance } from '../game/appearance'
import { feed, namePet, play, startSleep, wake, wash, type ActionReason, type ActionResult } from '../game/actions'
import type { GameConfig } from '../game/config'
import { createPet, tick } from '../game/engine'
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

function initialPet(config: GameConfig): PetState {
  // случайность живёт здесь, в UI-слое: game остаётся чистой
  const fresh = rollAppearance(Math.random)
  const raw = petStore.loadLocal()
  const restored = raw !== null ? deserialize(raw, fresh) : null
  return restored ?? createPet(Date.now(), config, fresh)
}

/**
 * Жизненный цикл питомца в React: сейв (локально + сервер),
 * тик раз в секунду, действия с обратной связью и хаптикой.
 */
export function usePet(config: GameConfig) {
  const [pet, setPet] = useState<PetState>(() => initialPet(config))
  const [notice, setNotice] = useState<string | null>(null)
  const petRef = useRef(pet)
  petRef.current = pet
  const prevStageRef = useRef(pet.stage)
  const lastSyncRef = useRef(0)

  // старт: Telegram-инициализация, разовая миграция старого облака Telegram
  // и сервер-синк. Сравнение сейвов честное — по lastTickAt до досчёта времени
  useEffect(() => {
    initTelegram()
    let cancelled = false
    void (async () => {
      const local = petRef.current
      let best = local
      const legacyRaw = await petStore.legacyCloudLoad()
      if (legacyRaw !== null) best = mergeRemoteSave(legacyRaw, best)
      const response = await petStore.serverSync(serialize(best))
      if (response !== null) best = mergeRemoteSave(response.save, best)
      // победил чужой сейв — применяем его и досчитываем время отсутствия
      if (!cancelled && best !== local) setPet(catchUp(best, Date.now(), config))
    })()
    return () => {
      cancelled = true
    }
  }, [config])

  // при запуске досчитываем всё время, пока приложение было закрыто
  useEffect(() => {
    setPet((p) => catchUp(p, Date.now(), config))
  }, [config])

  useEffect(() => {
    const id = window.setInterval(() => setPet((p) => catchUp(p, Date.now(), config)), 1000)
    return () => window.clearInterval(id)
  }, [config])

  // сохранение: локально сразу, на сервер — не чаще раза в SERVER_SYNC_INTERVAL_MS
  useEffect(() => {
    const raw = serialize(pet)
    petStore.saveLocal(raw)
    const now = Date.now()
    if (now - lastSyncRef.current >= SERVER_SYNC_INTERVAL_MS) {
      lastSyncRef.current = now
      void petStore.serverSync(raw)
    }
  }, [pet])

  // при уходе со страницы — залить актуальный сейв на сервер
  useEffect(() => {
    const flush = () => {
      void petStore.serverSync(serialize(petRef.current), true)
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  // событие вылупления
  useEffect(() => {
    if (prevStageRef.current === 'egg' && pet.stage !== 'egg') {
      setNotice(`🎉 ${pet.name ?? 'Питомец'} вылупился!`)
    }
    prevStageRef.current = pet.stage
  }, [pet.stage, pet.name])

  // уведомления сами исчезают
  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(id)
  }, [notice])

  const apply = useCallback(
    (action: (p: PetState, c: GameConfig) => ActionResult, successText: string) => {
      const result = action(petRef.current, config)
      setPet(result.state)
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

  const feedPet = useCallback(() => apply(feed, '🍗 Ням-ням!'), [apply])
  const playPet = useCallback(() => apply(play, '😄 Было весело!'), [apply])
  const washPet = useCallback(() => apply(wash, '🛁 Чистота!'), [apply])

  /**
   * Дать имя питомцу: без имени игра не начинается.
   * Работает и для свежего яйца, и для старого безымянного сейва.
   */
  const startGame = useCallback(
    (rawName: string) => {
      const result = namePet(petRef.current, rawName, config)
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
    const sleeping = petRef.current.sleeping
    return sleeping ? apply(wake, '☀️ Проснулся!') : apply(startSleep, '😴 Спокойной ночи!')
  }, [apply])

  /** Dev-инструмент: прокрутить игровое время вперёд. */
  const advanceTime = useCallback(
    (gameMs: number) => {
      setPet((p) => tick(p, gameMs, config))
    },
    [config],
  )

  const reset = useCallback(() => {
    // новая игра — новая случайная внешность
    setPet(createPet(Date.now(), config, rollAppearance(Math.random)))
    lastSyncRef.current = 0
    setNotice('🥚 Новая игра — дай имя!')
  }, [config])

  return { pet, notice, feedPet, playPet, washPet, toggleSleep, startGame, advanceTime, reset }
}
