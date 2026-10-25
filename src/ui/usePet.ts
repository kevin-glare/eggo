import { useCallback, useEffect, useRef, useState } from 'react'
import { feed, play, startSleep, wake, wash, type ActionReason, type ActionResult } from '../game/actions'
import type { GameConfig } from '../game/config'
import { createPet, tick } from '../game/engine'
import { catchUp, deserialize, serialize } from '../game/storage'
import type { PetState } from '../game/types'

const STORAGE_KEY = 'tamagotchi.save.v1'

const REASON_TEXT: Record<ActionReason, string> = {
  'not-hatched': '🥚 Питомец ещё не вылупился',
  sleeping: '🤫 Питомец спит',
  'too-tired': '😵 Слишком устал — пусть поспит',
}

function initialPet(config: GameConfig): PetState {
  const raw = localStorage.getItem(STORAGE_KEY)
  const restored = raw !== null ? deserialize(raw) : null
  return restored ?? createPet(Date.now(), config)
}

/**
 * Жизненный цикл питомца в React: загрузка сейва, тик раз в секунду,
 * действия с обратной связью, сохранение при каждом изменении.
 */
export function usePet(config: GameConfig) {
  const [pet, setPet] = useState<PetState>(() => initialPet(config))
  const [notice, setNotice] = useState<string | null>(null)
  const petRef = useRef(pet)
  petRef.current = pet
  const prevStageRef = useRef(pet.stage)

  // при запуске досчитываем всё время, пока приложение было закрыто
  useEffect(() => {
    setPet((p) => catchUp(p, Date.now(), config))
  }, [config])

  useEffect(() => {
    const id = window.setInterval(() => setPet((p) => catchUp(p, Date.now(), config)), 1000)
    return () => window.clearInterval(id)
  }, [config])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, serialize(pet))
  }, [pet])

  // событие вылупления
  useEffect(() => {
    if (prevStageRef.current === 'egg' && pet.stage !== 'egg') {
      setNotice('🎉 Питомец вылупился!')
    }
    prevStageRef.current = pet.stage
  }, [pet.stage])

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
      setNotice(result.ok ? successText : (REASON_TEXT[result.reason ?? 'not-hatched'] ?? ''))
      return result
    },
    [config],
  )

  const feedPet = useCallback(() => apply(feed, '🍗 Ням-ням!'), [apply])
  const playPet = useCallback(() => apply(play, '😄 Было весело!'), [apply])
  const washPet = useCallback(() => apply(wash, '🛁 Чистота!'), [apply])
  const toggleSleep = useCallback(() => {
    const sleeping = petRef.current.sleeping
    return sleeping ? apply(wake, '☀️ Проснулся!') : apply(startSleep, '😴 Спокойной ночи!')
  }, [apply])

  /** Dev-инструмент: прокрутить игровое время вперёд. */
  const advanceTime = useCallback((gameMs: number) => {
    setPet((p) => tick(p, gameMs, config))
  }, [config])

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    prevStageRef.current = 'egg'
    setPet(createPet(Date.now(), config))
    setNotice('🥚 Новое яйцо!')
  }, [config])

  return { pet, notice, feedPet, playPet, washPet, toggleSleep, advanceTime, reset }
}
