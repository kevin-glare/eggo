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
  type ActionResult,
} from '../game/actions'
import type { GameConfig } from '../game/config'
import { createPet, tick } from '../game/engine'
import { claimReward, ensureDaily, recordQuest, type QuestId } from '../game/quests'
import { friendshipDay, missYou, touchStreak } from '../game/streak'
import { catchUp, deserialize, mergeRemoteSave, serialize } from '../game/storage'
import type { PetState } from '../game/types'
import type { MinigameId, MinigameOutcome } from '../game/minigames/types'
import { applyMinigameBonus, minigameBonus, recordMinigameScore } from '../game/minigames/reward'
import { feedCatch } from '../game/actions'
import { updateRequest } from '../game/requests'
import { applyReferralReward } from '../game/referrals'
import { useStrings } from './i18n'
import { markRequestHintDone } from './hints'
import { hapticSuccess, hapticWarning, initTelegram, petStore } from '../telegram'

/** Как часто синхроним сейв с сервером (локально — при каждом изменении). */
const SERVER_SYNC_INTERVAL_MS = 10_000

/**
 * Страховка от вечной загрузки: у некоторых вебвью фетч может зависнуть
 * навсегда и не отозваться на abort. Худший честный путь стартового синка —
 * 5с облако + 10с фетч, поэтому сторож срабатывает позже — на 20-й секунде.
 */
const SYNC_WATCHDOG_MS = 20_000

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
  const str = useStrings()
  const [pet, setPet] = useState<PetState | null>(() => initialPet())
  const [notice, setNotice] = useState<string | null>(null)
  /** счётчик праздников (конфетти в канвасе): награда дня, порог серии, «скучал» */
  const [celebrate, setCelebrate] = useState(0)
  /** сколько друзей пришло по ссылке — с сервера при каждом синке (звёзды дружбы) */
  const [invited, setInvited] = useState<number | null>(null)
  const petRef = useRef(pet)
  petRef.current = pet
  const prevStageRef = useRef<PetState['stage'] | null>(pet?.stage ?? null)
  const lastSyncRef = useRef(0)
  /** действие игрока сменило состояние — следующий сейв едет на сервер без троттлинга */
  const forceSyncRef = useRef(false)
  /** стартовый синк закончился (любым исходом) — сторожу больше нечего делать */
  const startSyncSettledRef = useRef(false)

  // старт: Telegram-инициализация, разовая миграция старого облака Telegram
  // и сервер-синк. Слияние честное — по полям, через mergeRemoteSave.
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
        if (legacyRaw !== null) best = mergeRemoteSave(legacyRaw, best, fallbackAppearance, config) ?? best
        const payload = best?.name != null ? serialize(best) : null
        const posted = await petStore.serverSync(payload)
        // POST потерялся по пути — тянем состояние GET-ом: часть мобильных
        // сетей режет POST с телом, а pull без тела доезжает
        const response = posted ?? (await petStore.serverPull())
        if (response !== null) {
          setInvited('invited' in response && typeof response.invited === 'number' ? response.invited : null)
          best = mergeRemoteSave(response.save, best, fallbackAppearance, config) ?? best
        }
    } catch {
      // живём на локальном сейве (или новом яйце ниже)
    }
    startSyncSettledRef.current = true
    // питомца нет нигде — новая игра; чужой сейв досчитываем по времени отсутствия
    const resolved = best ?? createPet(Date.now(), config, rollAppearance(Math.random))
    if (!cancelled) {
      // «скучал»: absence считается до досчёта — lastTickAt ещё старый
      if (best !== null && missYou(best, config, Date.now())) {
        setNotice(str.missYou(best.name ?? str.petFallbackName))
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
  // разыгрываем задания сегодняшнего дня и просрочиваем просьбу — всё видно сразу после входа
  useEffect(() => {
    setPet((p) =>
      p === null ? p : updateRequest(ensureDaily(catchUp(p, Date.now(), config), config, Date.now()), config, Date.now()),
    )
  }, [config])

  useEffect(() => {
    const id = window.setInterval(
      () =>
        setPet((p) =>
          p === null
            ? p
            : updateRequest(ensureDaily(catchUp(p, Date.now(), config), config, Date.now()), config, Date.now()),
        ),
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
    void petStore.serverSync(raw).then(async (response) => {
      // с каждым синком забираем чужие изменения: сервер вернул слитый сейв.
      // Свой свежее (событие случилось, пока запрос летел) — слияние оставит его.
      // POST не доехал (сеть его режет) — тянем состояние из базы GET-ом:
      // так чужие сон и действия доезжают даже при неработающих POST-ах
      const pulled = response ?? (await petStore.serverPull())
      if (pulled === null) return
      setInvited('invited' in pulled && typeof pulled.invited === 'number' ? pulled.invited : null)
      setPet((current) => {
        if (current === null) return current
        const merged = mergeRemoteSave(pulled.save, current, current.appearance, config)
        if (merged === current || merged === null) return current
        return catchUp(merged, Date.now(), config)
      })
    })
  }, [pet, config])

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
        setNotice(str.hatched(pet.name ?? str.petFallbackName))
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

  // звёзды дружбы: счётчик приглашённых дорос до порога — питомцу +звезда.
  // Награда выводится из счётчика, поэтому идемпотентна и не теряется при слиянии
  useEffect(() => {
    if (pet === null || invited === null) return
    const reward = applyReferralReward(pet, invited, config)
    if (reward.tier <= pet.appearance.refMark) return
    setPet({ ...reward.state, lastEventAt: Date.now() })
    forceSyncRef.current = true
    setNotice(str.inviteReward(reward.tier))
    setCelebrate((n) => n + 1)
    hapticSuccess()
  }, [invited, pet, config])

  // праздник дружбы: тост и конфетти один раз на юбилейный день
  const anniversaryRef = useRef<number | null>(null)
  useEffect(() => {
    if (pet === null) return
    const weeks = friendshipDay(pet, Date.now())
    if (weeks === null || anniversaryRef.current === weeks) return
    anniversaryRef.current = weeks
    setNotice(str.weeksOfFriendship(weeks))
    setCelebrate((n) => n + 1)
  }, [pet])

  const apply = useCallback(
    (action: (p: PetState, c: GameConfig) => ActionResult, successText: string, questId?: QuestId) => {
      const current = petRef.current
      if (current === null) return null
      const result = action(current, config)
      if (!result.ok) {
        setNotice(str.reason[result.reason ?? 'not-hatched'])
        hapticWarning()
        return result
      }
      // событие игрока: штамп для мультидевайс-слияния — по нему сервер поймёт,
      // что это событие свежее распада с другого девайса
      let next: PetState = { ...result.state, lastEventAt: Date.now() }
      // просьба закрыта этим действием: пауза до следующей — от текущего момента
      if (result.requestBonus === true) {
        next = { ...next, nextRequestAt: Date.now() + config.requests.cooldownMs }
        markRequestHintDone()
      }
      // успешное действие отмечается в заданиях дня и в серии дней
      if (questId) {
        next = recordQuest(next, questId, config, Date.now())
        const streak = touchStreak(next, config, Date.now())
        next = streak.state
        if (streak.milestone !== null) {
          setNotice(str.daysInRow(streak.milestone))
          setCelebrate((n) => n + 1)
        }
      }
      setPet(next)
      forceSyncRef.current = true
      setNotice(result.requestBonus === true ? str.requestBonus(current.name ?? str.petFallbackName) : successText)
      hapticSuccess()
      return { ...result, state: next }
    },
    [config, str],
  )

  const feedPet = useCallback(() => apply(feed, str.actionSuccess.feed, 'feed'), [apply])
  const playPet = useCallback(() => apply(play, str.actionSuccess.play, 'play'), [apply])
  const washPet = useCallback(() => apply(wash, str.actionSuccess.wash, 'wash'), [apply])

  /**
   * Партия мини-игры доиграна: база — обычный play() (радость, усталость,
   * просьба ×2, квест и серия — всё как у прежней кнопки «Играть»), сверху
   * бонус за победу и запись рекорда. Весь итог — одно событие игрока.
   */
  const finishMinigame = useCallback(
    (id: MinigameId, outcome: MinigameOutcome): { isRecord: boolean; bonus: number } => {
      // базовое «поиграли»: отказ (уже счастлив и т.п.) не мешает рекорду
      const base = playPet()
      const current = base?.state ?? petRef.current
      if (current === null) return { isRecord: false, bonus: 0 }
      const rec = recordMinigameScore(current, id, outcome.score)
      const bonus = minigameBonus(outcome.won, rec.isRecord, config)
      let next = rec.state
      if (bonus > 0) next = applyMinigameBonus(next, bonus)
      if (next !== current) {
        setPet({ ...next, lastEventAt: Date.now() })
        forceSyncRef.current = true
      }
      if (!outcome.won) setNotice(str.mgLost)
      else if (rec.isRecord) {
        setNotice(str.mgRecordToast(outcome.score))
        setCelebrate((n) => n + 1)
      }
      return { isRecord: rec.isRecord, bonus }
    },
    [config, playPet, str],
  )

  // кулдаун поглаживания живёт в сессии: сердечки при любом тапе остаются,
  // но счастье капает не чаще config.actions.pet.cooldownMs
  const lastPetAtRef = useRef(0)
  const petPet = useCallback(() => {
    const now = Date.now()
    if (now - lastPetAtRef.current < config.actions.pet.cooldownMs) return null
    const result = apply(petAction, str.actionSuccess.pet, 'pet')
    if (result?.ok) lastPetAtRef.current = now
    return result
  }, [apply, config])

  /** Забрать награду за задания дня; отказ — с тостом-подсказкой. */
  const claimDaily = useCallback(() => {
    const current = petRef.current
    if (current === null) return false
    const result = claimReward(current, config)
    if (result.ok) {
      // награда — событие игрока: штамп для мультидевайс-слияния
      setPet({ ...result.state, lastEventAt: Date.now() })
      forceSyncRef.current = true
      setNotice(str.claimReward(config.quests.reward))
      setCelebrate((n) => n + 1)
      hapticSuccess()
    } else {
      setPet(result.state)
      setNotice(result.reason === 'already-claimed' ? str.claimAlready : str.claimNotReady)
      hapticWarning()
    }
    return result.ok
  }, [config, str])

  /** Показать разовое сообщение (подсказки интерфейса). */
  const showNotice = useCallback((text: string) => setNotice(text), [])

  /**
   * Сессия кормления-ловли доиграла: сытость капает за пойманное (просьба ×2,
   * квест, серия — как у обычного кормления). Добил сытость до сотни —
   * питомец объелся: перерыв в сейве и мягкий тост.
   */
  const finishFeeding = useCallback(
    (caught: number) => {
      const result = apply((p, c) => feedCatch(p, caught, c, Date.now()), str.actionSuccess.feed, 'feed')
      if (result?.ok && result.state.overfedUntil > Date.now()) setNotice(str.overfed)
    },
    [apply, str],
  )

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
        setNotice(str.reason[result.reason ?? 'invalid-name'])
        hapticWarning()
        return false
      }
      forceSyncRef.current = true
      // имя — первое событие питомца: штамп для мультидевайс-слияния
      setPet({ ...result.state, lastEventAt: Date.now() })
      hapticSuccess()
      setNotice(result.state.stage === 'egg' ? str.eggAppeared : str.named(result.state.name ?? str.petFallbackName))
      return true
    },
    [config, str],
  )
  const toggleSleep = useCallback(() => {
    const current = petRef.current
    if (current === null) return null
    const sleeping = current.sleeping
    return sleeping ? apply(wake, str.sleepWake) : apply(startSleep, str.sleepStart)
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
    setNotice(str.newGame)
  }, [config])

  return {
    pet,
    notice,
    celebrate,
    invited,
    feedPet,
    playPet,
    washPet,
    finishMinigame,
    finishFeeding,
    petPet,
    claimDaily,
    showNotice,
    toggleSleep,
    startGame,
    advanceTime,
    reset,
  }
}
