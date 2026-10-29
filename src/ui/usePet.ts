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
import { claimReward, ensureDaily, recordQuest, type QuestId } from '../game/quests'
import { friendshipDay, missYou, touchStreak } from '../game/streak'
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

/**
 * Страховка от вечной загрузки: у некоторых вебвью фетч может зависнуть
 * навсегда и не отозваться на abort. Худший честный путь стартового синка —
 * 5с облако + 10с фетч, поэтому сторож срабатывает позже — на 20-й секунде.
 */
const SYNC_WATCHDOG_MS = 20_000

/** Русская плюрализация: 1 день, 3 дня, 14 дней. */
function pluralDays(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня'
  return 'дней'
}

/** Русская плюрализация: 1 неделю, 2 недели, 5 недель. */
function pluralWeeks(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'неделю'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'недели'
  return 'недель'
}

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
  /** счётчик праздников (конфетти в канвасе): награда дня, порог серии, «скучал» */
  const [celebrate, setCelebrate] = useState(0)
  const petRef = useRef(pet)
  petRef.current = pet
  const prevStageRef = useRef<PetState['stage'] | null>(pet?.stage ?? null)
  const lastSyncRef = useRef(0)
  /** действие игрока сменило состояние — следующий сейв едет на сервер без троттлинга */
  const forceSyncRef = useRef(false)
  /** стартовый синк закончился (любым исходом) — сторожу больше нечего делать */
  const startSyncSettledRef = useRef(false)

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
    startSyncSettledRef.current = true
    // питомца нет нигде — новая игра; чужой сейв досчитываем по времени отсутствия
    const resolved = best ?? createPet(Date.now(), config, rollAppearance(Math.random))
    if (!cancelled) {
      // «скучал»: absence считается до досчёта — lastTickAt ещё старый
      if (best !== null && missYou(best, config, Date.now())) {
        setNotice(`💗 ${best.name ?? 'Питомец'} скучал по тебе!`)
        setCelebrate((n) => n + 1)
      }
      // пока синк висел, сторож мог дать яйцо — не отбираем его запоздалым
      // ответом: при следующем запуске слияние само разберётся, чей сейв главный
      if (local === null && petRef.current !== null) return
      if (resolved !== local) setPet(catchUp(resolved, Date.now(), config))
    }
  })()
  return () => {
    cancelled = true
  }
}, [config])

// сторож вечной загрузки: локаль пуста, синк завис — начинаем с нового яйца.
// Безымянное яйцо сервер не перебьёт, а настоящий питомец с сервера выиграет
// у него при следующем запуске по правилам слияния
useEffect(() => {
  const timer = window.setTimeout(() => {
    if (startSyncSettledRef.current || petRef.current !== null) return
    const fresh = catchUp(createPet(Date.now(), config, rollAppearance(Math.random)), Date.now(), config)
    setPet(fresh)
  }, SYNC_WATCHDOG_MS)
  return () => window.clearTimeout(timer)
}, [config])

  // при запуске досчитываем всё время, пока приложение было закрыто,
  // и разыгрываем задания сегодняшнего дня — они видны сразу после входа
  useEffect(() => {
    setPet((p) => (p === null ? p : ensureDaily(catchUp(p, Date.now(), config), config, Date.now())))
  }, [config])

  useEffect(() => {
    const id = window.setInterval(
      () => setPet((p) => (p === null ? p : ensureDaily(catchUp(p, Date.now(), config), config, Date.now()))),
      1000,
    )
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
    // крон решает пуши по сейву из базы: сон, не доехавший до неё за троттлинг,
    // превращается в «уложи спать» для уже спящего питомца
    const forced = forceSyncRef.current
    forceSyncRef.current = false
    if (!forced && now - lastSyncRef.current < SERVER_SYNC_INTERVAL_MS) return
    lastSyncRef.current = now
    void petStore.serverSync(raw)
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

  // праздник дружбы: тост и конфетти один раз на юбилейный день
  const anniversaryRef = useRef<number | null>(null)
  useEffect(() => {
    if (pet === null) return
    const weeks = friendshipDay(pet, Date.now())
    if (weeks === null || anniversaryRef.current === weeks) return
    anniversaryRef.current = weeks
    setNotice(`🎂 ${weeks} ${pluralWeeks(weeks)} дружбы!`)
    setCelebrate((n) => n + 1)
  }, [pet])

  const apply = useCallback(
    (action: (p: PetState, c: GameConfig) => ActionResult, successText: string, questId?: QuestId) => {
      const current = petRef.current
      if (current === null) return null
      const result = action(current, config)
      // успешное действие отмечается в заданиях дня и в серии дней
      if (result.ok && questId) {
        let next = recordQuest(result.state, questId, config, Date.now())
        const streak = touchStreak(next, config, Date.now())
        next = streak.state
        setPet(next)
        if (streak.milestone !== null) {
          setNotice(`🔥 ${streak.milestone} ${pluralDays(streak.milestone)} подряд!`)
          setCelebrate((n) => n + 1)
        }
      } else {
        setPet(result.state)
      }
      if (result.ok) {
        forceSyncRef.current = true
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

  /** Забрать награду за задания дня; отказ — с тостом-подсказкой. */
  const claimDaily = useCallback(() => {
    const current = petRef.current
    if (current === null) return false
    const result = claimReward(current, config)
    setPet(result.state)
    if (result.ok) {
      forceSyncRef.current = true
      setNotice(`🎁 Задания дня выполнены: +${config.quests.rewardHappiness} к счастью!`)
      setCelebrate((n) => n + 1)
      hapticSuccess()
    } else {
      setNotice(result.reason === 'already-claimed' ? '🎁 Награда уже получена' : '🎯 Сначала выполни задания дня')
      hapticWarning()
    }
    return result.ok
  }, [config])

  /** Показать разовое сообщение (подсказки интерфейса). */
  const showNotice = useCallback((text: string) => setNotice(text), [])

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
      forceSyncRef.current = true
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

  return {
    pet,
    notice,
    celebrate,
    feedPet,
    playPet,
    washPet,
    petPet,
    claimDaily,
    showNotice,
    toggleSleep,
    startGame,
    advanceTime,
    reset,
  }
}
