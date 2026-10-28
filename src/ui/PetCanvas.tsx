import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { PetAppearance } from '../game/appearance'
import type { DesireKind } from '../game/engine'
import type { Mood, Stage } from '../game/types'
import { dirtIntensity, type DirtLevel } from './dirt'
import {
  createVisualState,
  drawPet,
  GROUND_Y,
  PET_PALETTES,
  SCENE_H,
  SCENE_W,
  type PetVisualState,
} from './petArt'
import { drawScene } from './scene'
import { hapticTap } from '../telegram'
import { sampleDayCycle } from './dayCycle'

export type PetActionKind = 'feed' | 'play' | 'wash'

interface PetCanvasProps {
  stage: Stage
  mood: Mood
  /** внешность («гены») питомца — что рисовать */
  appearance: PetAppearance
  /** 0..1 — насколько яйцо близко к вылуплению */
  eggProgress: number
  /** 0..3 — насколько питомец грязный (из чистоты); undefined = чист */
  dirtLevel?: DirtLevel
  /** чего питомец хочет прямо сейчас — пузырёк над головой; null = скрыт */
  desire?: DesireKind | null
  /** dev: подменный час неба; null = локальное время пользователя */
  skyHourOverride?: number | null
  onTap?: () => void
  /** тап пришёлся по самому питомцу (поглаживание); в яйце не вызывается */
  onPetTap?: () => void
  /** активная интерактивная сценка действия (кормление с руки) */
  scene?: PetActionKind | null
  /** сценка доиграла: применить действие (один раз, в конце) */
  onSceneComplete?: (kind: PetActionKind) => void
  /** счётчик праздников: рост n → конфетти и довольный прыжок */
  celebrate?: number
  /** праздник дружбы: торт на траве на весь юбилейный день */
  cake?: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  life: number
  maxLife: number
  size: number
  color: string
  shape: 'heart' | 'shard' | 'crumb' | 'bubble' | 'sparkle' | 'drop'
  /** своя гравитация: у пузырей отрицательная (всплывают) */
  grav?: number
  /** амплитуда покачивания по x (пузыри) */
  wob?: number
  wobPh?: number
}

/** Реквизит сцены с действием: ножка и мячик живут на канвасе, пока их твинит GSAP. */
interface StageProp {
  kind: 'drumstick' | 'ball'
  x: number
  y: number
  rot: number
  scale: number
  alpha: number
}

const FOOD_X = SCENE_W / 2 + 64
const FOOD_Y = GROUND_Y - 10
const BALL_REST_Y = GROUND_Y - 12
/** Торт праздника дружбы — на траве слева от питомца. */
const CAKE_X = SCENE_W / 2 - 120

/**
 * Сценка «кормление с руки»: еда падает рядом с питомцем и ждёт тапов.
 * Тап = укус (крошки, еда уменьшается); три укуса — сыт. Если по еде
 * не тапать FEED_IDLE_MS — питомец доедает сам. Движок вызывается один раз
 * в конце (onSceneComplete), отказы проверены до старта сценки.
 */
interface FeedScene {
  food: StageProp
  bites: number
  landed: boolean
  done: boolean
  autoTimer: number | null
}

const FEED_BITES = 3
const FEED_IDLE_MS = 6_000
/** Размер еды после каждого укуса. */
const FEED_SCALES = [0.7, 0.4, 0.05]
/** Хит-зона еды, px. */
const FOOD_HIT_R = 36

/**
 * Сценка «купание-тёрка»: игрок водит пальцем по питомцу, от проведений —
 * пузыри и плавное смывание грязи; WASH_STROKES проведений — чист.
 * Без движений WASH_IDLE_MS — домывает сам. Движок — один раз в конце.
 */
interface WashScene {
  strokes: number
  done: boolean
  autoTimer: number | null
}

const WASH_STROKES = 6
/** Сколько px пути пальцем засчитывается как одно проведение. */
const WASH_SEGMENT_PX = 56
const WASH_IDLE_MS = 8_000

/**
 * Сценка «поймай мяч»: мяч летает по дугам, тап по нему — отбивание
 * (питомец прыгает, искры); PLAY_HITS отбиваний — наигрались.
 * Промахи не штрафуют; без отбиваний PLAY_IDLE_MS — мяч улетает,
 * действие всё равно применяется. Движок — один раз в конце.
 */
interface PlayScene {
  ball: StageProp
  hits: number
  done: boolean
  idleTimer: number | null
}

const PLAY_HITS = 3
/** Щедрая хит-зона мяча, px. */
const PLAY_HIT_R = 36
const PLAY_IDLE_MS = 10_000

/* Блуждание по лугу — презентация, не баланс: на логику не влияет. */
/** Скорость прогулки и возврата к центру, px/с. */
const WANDER_SPEED = 26
const RETURN_SPEED = 110
/** Дальность прогулок от центра и зона принюхивания. */
const WANDER_RANGE = 95
const SNIFF_MS = 900
/** Сколько стоять на месте до следующей прогулки. */
const STAND_MIN_MS = 2_500
const STAND_MAX_MS = 7_000

/** Машина блуждания: стоим → идём к случайной точке → принюхиваемся → стоим. */
interface WanderState {
  x: number
  target: number
  mode: 'stand' | 'walk' | 'sniff'
  /** до какого времени стоять/нюхать (performance.now) */
  until: number
}

function updateWander(w: WanderState, v: PetVisualState, now: number, dtSec: number): void {
  if (w.mode === 'stand') {
    v.tilt = 0
    if (now < w.until) return
    w.target = (Math.random() * 2 - 1) * WANDER_RANGE
    if (Math.abs(w.target - w.x) < 24) w.target = Math.sign(w.target - w.x) * (24 + Math.random() * 40)
    w.mode = 'walk'
    return
  }
  if (w.mode === 'sniff') {
    // принюхивается: мелкое покачивание носом к земле
    v.tilt = Math.sin(now / 85) * 0.045
    if (now >= w.until) {
      w.mode = 'stand'
      w.until = now + STAND_MIN_MS + Math.random() * (STAND_MAX_MS - STAND_MIN_MS)
    }
    return
  }
  // walk
  const dir = Math.sign(w.target - w.x)
  if (dir === 0) {
    w.mode = 'sniff'
    w.until = now + SNIFF_MS
    return
  }
  w.x += dir * WANDER_SPEED * dtSec
  v.tilt = Math.sin(now / 130) * 0.035
  if ((dir > 0 && w.x >= w.target) || (dir < 0 && w.x <= w.target)) {
    w.x = w.target
    w.mode = 'sniff'
    w.until = now + SNIFF_MS
  }
}

/** Вернуться к центру: действие или сон заставляют питомца подбежать обратно. */
function returnToCenter(w: WanderState, v: PetVisualState, now: number, dtSec: number): void {
  if (Math.abs(w.x) < 1) {
    w.x = 0
    w.mode = 'stand'
    w.until = now + 2_000
    v.tilt = 0
    return
  }
  w.x -= Math.sign(w.x) * RETURN_SPEED * dtSec
  v.tilt = Math.sin(now / 110) * 0.045
}

/** Настроение задаёт цвет света питомца и жизнь фоновой сцены. */
const MOOD_LIGHT: Record<Mood, { mul: number; alpha: number; rgb: [number, number, number]; energy: number; warm: number }> = {
  happy: { mul: 1.18, alpha: 0.5, rgb: [255, 214, 120], energy: 0.95, warm: 1 },
  content: { mul: 1.0, alpha: 0.36, rgb: [255, 214, 120], energy: 0.7, warm: 0.9 },
  sad: { mul: 0.85, alpha: 0.24, rgb: [212, 190, 255], energy: 0.35, warm: 0.4 },
  sick: { mul: 0.7, alpha: 0.2, rgb: [186, 219, 158], energy: 0.25, warm: 0.2 },
  sleeping: { mul: 0.8, alpha: 0.28, rgb: [176, 203, 255], energy: 0.5, warm: 0.6 },
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function removeProp(props: StageProp[], prop: StageProp): void {
  const i = props.indexOf(prop)
  if (i !== -1) props.splice(i, 1)
}

export default function PetCanvas({
  stage,
  mood,
  appearance,
  eggProgress,
  dirtLevel = 0,
  desire,
  skyHourOverride,
  onTap,
  onPetTap,
  scene,
  onSceneComplete,
  celebrate = 0,
  cake = false,
}: PetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ stage, mood, appearance, eggProgress, skyHourOverride, dirtLevel, cake })
  propsRef.current = { stage, mood, appearance, eggProgress, skyHourOverride, dirtLevel, cake }
  const visRef = useRef<PetVisualState>(createVisualState())
  const sceneRef = useRef({ energy: 0.7, warm: 0.9 })
  const particlesRef = useRef<Particle[]>([])
  const stagePropsRef = useRef<StageProp[]>([])
  const prevStageRef = useRef(stage)
  // блуждание: пока питомец «занят» (действие, тап, вылупление) — бежит в центр
  const wanderRef = useRef<WanderState>({ x: 0, target: 0, mode: 'stand', until: 0 })
  const busyUntilRef = useRef(0)
  // сценка кормления: еда ждёт тапов-укусов; onSceneComplete через ref — без stale-замыканий
  const feedRef = useRef<FeedScene | null>(null)
  // сценка купания: путь пальца по питомцу копится в проведениях
  const washRef = useRef<WashScene | null>(null)
  // сценка с мячом: тапы по летящему мячу
  const playRef = useRef<PlayScene | null>(null)
  const dragRef = useRef<{ active: boolean; x: number; y: number; moved: number } | null>(null)
  const dragMovedRef = useRef(false)
  const completeRef = useRef(onSceneComplete)
  completeRef.current = onSceneComplete
  // пузырь желания: альфа твинится при смене, вид запоминается для плавного исчезновения
  const bubbleRef = useRef<{ alpha: number; kind: DesireKind }>({ alpha: 0, kind: 'feed' })

  useEffect(() => {
    if (desire) bubbleRef.current.kind = desire
    gsap.to(bubbleRef.current, { alpha: desire ? 1 : 0, duration: 0.3, ease: 'power1.out', overwrite: 'auto' })
  }, [desire])

  // канвас, рендер-цикл и вечные GSAP-циклы (дыхание, покачивание, моргание)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = SCENE_W * dpr
    canvas.height = SCENE_H * dpr
    const reducedMotion = prefersReducedMotion()

    const v = visRef.current
    const particles = particlesRef.current
    const stageProps = stagePropsRef.current

    const gctx = gsap.context(() => {
      if (prefersReducedMotion()) return
      gsap.to(v, { squash: 0.93, duration: 1.7, yoyo: true, repeat: -1, ease: 'sine.inOut' })
      gsap.to(v, { bob: -4, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
      const blinkOnce = () => {
        gsap
          .timeline()
          .to(v, { blink: 1, duration: 0.09, ease: 'power1.in' })
          .to(v, { blink: 0, duration: 0.12, ease: 'power1.out' })
        gsap.delayedCall(2.2 + Math.random() * 3.4, blinkOnce)
      }
      gsap.delayedCall(1.5, blinkOnce)
    })

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      const { stage: st, mood: md, appearance: look, eggProgress: prog, skyHourOverride: skyHour, dirtLevel: dirt, cake: showCake } =
        propsRef.current

      // яйцо качается тем сильнее, чем ближе вылупление
      if (st === 'egg') {
        v.tilt = Math.sin((now / 1000) * (2 + 7 * prog)) * (0.02 + 0.09 * prog)
        wanderRef.current.x = 0
      } else if (reducedMotion || md === 'sleeping' || now < busyUntilRef.current) {
        returnToCenter(wanderRef.current, v, now, dt / 1000)
      } else {
        updateWander(wanderRef.current, v, now, dt / 1000)
      }
      v.wanderX = wanderRef.current.x

      // небо: подменный час (dev) или локальное время пользователя
      const d = new Date()
      const hour = skyHour ?? d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600
      const sky = sampleDayCycle(hour)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawScene(ctx, SCENE_W, SCENE_H, sceneRef.current, now, sky)
      drawTrash(ctx, dirt, v.dirtAlpha)
      if (showCake) drawCake(ctx, CAKE_X, GROUND_Y + 3, now)
      if (bubbleRef.current.alpha > 0.01)
        drawDesireBubble(ctx, bubbleRef.current.kind, bubbleRef.current.alpha, now, SCENE_W / 2 + wanderRef.current.x)
      drawStageProps(ctx, stageProps)
      updateParticles(particles, dt / 1000)
      drawParticles(ctx, particles)
      drawPet(ctx, st, md, look, v, now, prog, dirt)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      gctx.revert()
    }
  }, [])

  // смена настроения перекрашивает свет сцены плавно
  useEffect(() => {
    const light = MOOD_LIGHT[mood]
    const v = visRef.current
    gsap.to(v, { glowMul: light.mul, glowAlpha: light.alpha, duration: 1.4, ease: 'sine.out' })
    gsap.to(v.glowRGB, { r: light.rgb[0], g: light.rgb[1], b: light.rgb[2], duration: 1.4, ease: 'sine.out' })
    gsap.to(sceneRef.current, { energy: light.energy, warm: light.warm, duration: 1.4, ease: 'sine.out' })
  }, [mood])

  // грязь плавно проступает при запущенности и смывается при купании
  useEffect(() => {
    gsap.to(visRef.current, { dirtAlpha: dirtIntensity(dirtLevel), duration: 1.2, ease: 'sine.out', overwrite: 'auto' })
  }, [dirtLevel])

  // праздник: конфетти в цветах питомца (награда за задания дня и т.п.)
  useEffect(() => {
    if (celebrate <= 0) return
    const palette = PET_PALETTES[propsRef.current.appearance.palette]
    const particles = particlesRef.current
    for (let i = 0; i < 26; i++) {
      const ang = (Math.PI * 2 * i) / 26 + Math.random() * 0.4
      particles.push({
        x: SCENE_W / 2,
        y: GROUND_Y - 70,
        vx: Math.cos(ang) * (70 + Math.random() * 110),
        vy: Math.sin(ang) * (70 + Math.random() * 110) - 110,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 9,
        life: 0,
        maxLife: 1 + Math.random() * 0.6,
        size: 3 + Math.random() * 3.5,
        color: i % 2 === 0 ? palette.bodyMid : palette.blush,
        shape: 'shard',
      })
    }
    if (!prefersReducedMotion()) {
      const v = visRef.current
      gsap
        .timeline()
        .to(v, { jumpY: -34, duration: 0.2, ease: 'power2.out', overwrite: 'auto' })
        .to(v, { jumpY: 0, duration: 0.6, ease: 'elastic.out(1.1, 0.4)' })
    }
  }, [celebrate])

  // вылупление: пружинка роста + конфетти из скорлупы
  useEffect(() => {
    if (prevStageRef.current === 'egg' && stage !== 'egg') {
      const v = visRef.current
      const particles = particlesRef.current
      busyUntilRef.current = performance.now() + 1_500
      // конфетти из скорлупы — в цветах палитры питомца
      const palette = PET_PALETTES[appearance.palette]
      for (let i = 0; i < 16; i++) {
        const ang = (Math.PI * 2 * i) / 16 + Math.random() * 0.4
        particles.push({
          x: SCENE_W / 2,
          y: GROUND_Y - 60,
          vx: Math.cos(ang) * (60 + Math.random() * 90),
          vy: Math.sin(ang) * (60 + Math.random() * 90) - 80,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 8,
          life: 0,
          maxLife: 0.9 + Math.random() * 0.5,
          size: 3 + Math.random() * 3,
          color: i % 2 === 0 ? palette.bodyMid : palette.blush,
          shape: 'shard',
        })
      }
      if (!prefersReducedMotion()) {
        gsap
          .timeline()
          .fromTo(v, { hatchPop: 0.4 }, { hatchPop: 1, duration: 0.9, ease: 'elastic.out(1, 0.45)' })
          .fromTo(v, { jumpY: -18 }, { jumpY: 0, duration: 0.5, ease: 'power2.out' }, 0.2)
      } else {
        v.hatchPop = 1
        v.jumpY = 0
      }
    }
    prevStageRef.current = stage
  }, [stage])

  // сценка «поймай мяч»: мяч летает по дугам, ждёт тапов-отбиваний
  useEffect(() => {
    if (!scene || scene !== 'play') return
    if (propsRef.current.stage === 'egg') return
    busyUntilRef.current = performance.now() + 20_000
    const stageProps = stagePropsRef.current
    const ball: StageProp = { kind: 'ball', x: -30, y: BALL_REST_Y, rot: 0, scale: 1, alpha: 1 }
    stageProps.push(ball)
    const sc: PlayScene = { ball, hits: 0, done: false, idleTimer: null }
    playRef.current = sc
    if (prefersReducedMotion()) {
      ball.x = SCENE_W / 2
      ball.y = GROUND_Y - 120
    } else {
      launchBall(sc)
    }
    sc.idleTimer = window.setTimeout(autoPlayFinish, PLAY_IDLE_MS)
    return () => {
      if (sc.idleTimer !== null) window.clearTimeout(sc.idleTimer)
      gsap.killTweensOf(ball)
      removeProp(stageProps, ball)
      playRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  /** Новая дуга в случайную точку неба; живёт, пока сцена активна. */
  function launchBall(sc: PlayScene): void {
    if (sc.done || playRef.current !== sc) return
    const from = { x: sc.ball.x, y: sc.ball.y }
    const to = { x: 55 + Math.random() * (SCENE_W - 110), y: 70 + Math.random() * (GROUND_Y - 170) }
    const dur = Math.max(0.6, Math.min(1.1, Math.hypot(to.x - from.x, to.y - from.y) / 380))
    const peak = Math.min(from.y, to.y) - 45
    gsap.killTweensOf(sc.ball)
    gsap.to(sc.ball, { x: to.x, duration: dur, ease: 'none' })
    gsap.to(sc.ball, { y: peak, duration: dur / 2, ease: 'power2.out' })
    gsap.to(sc.ball, {
      y: to.y,
      duration: dur / 2,
      ease: 'power2.in',
      delay: dur / 2,
      onComplete: () => gsap.delayedCall(0.15, () => launchBall(sc)),
    })
    gsap.to(sc.ball, { rot: '+=6', duration: dur, ease: 'none' })
  }

  /** Мяч улетает, сцена доиграна: действие применяется даже без отбиваний. */
  function autoPlayFinish(): void {
    const sc = playRef.current
    if (!sc || sc.done) return
    sc.done = true
    if (sc.idleTimer !== null) window.clearTimeout(sc.idleTimer)
    if (!prefersReducedMotion()) {
      gsap.killTweensOf(sc.ball)
      gsap.to(sc.ball, { x: SCENE_W + 60, duration: 0.7, ease: 'none' })
    }
    gsap.delayedCall(0.75, () => completeRef.current?.('play'))
  }

  /** Отбить мяч: прыжок питомца, искры, новая дуга; три отбивания — наигрались. */
  const hitBall = () => {
    const sc = playRef.current
    if (!sc || sc.done) return
    sc.hits += 1
    if (sc.idleTimer !== null) window.clearTimeout(sc.idleTimer)
    hapticTap()
    spawnSparkles(particlesRef.current)
    const v = visRef.current
    if (!prefersReducedMotion()) {
      gsap
        .timeline({ overwrite: 'auto' })
        .to(v, { jumpY: -30, duration: 0.16, ease: 'power2.out' })
        .to(v, { jumpY: 0, duration: 0.45, ease: 'elastic.out(1.1, 0.4)' })
    }
    if (sc.hits >= PLAY_HITS) {
      sc.done = true
      if (prefersReducedMotion()) {
        sc.ball.alpha = 0
        completeRef.current?.('play')
        return
      }
      gsap.killTweensOf(sc.ball)
      gsap.to(sc.ball, { x: SCENE_W + 60, duration: 0.7, ease: 'none' })
      gsap.to(sc.ball, { y: BALL_REST_Y - 50, duration: 0.35, ease: 'power2.out' })
      gsap.to(sc.ball, { y: BALL_REST_Y, duration: 0.35, ease: 'power2.in', delay: 0.35 })
      gsap.delayedCall(0.75, () => completeRef.current?.('play'))
    } else {
      sc.idleTimer = window.setTimeout(autoPlayFinish, PLAY_IDLE_MS)
      launchBall(sc)
    }
  }

  // сценка «кормление с руки»: еда падает, ждёт тапов-укусов, доиграла — complete
  useEffect(() => {
    if (!scene || scene !== 'feed') return
    if (propsRef.current.stage === 'egg') return
    // питомец занят всю сценку: бежит к центру и ждёт у своей миски
    busyUntilRef.current = performance.now() + 10_000
    const stageProps = stagePropsRef.current
    const food: StageProp = { kind: 'drumstick', x: FOOD_X, y: -30, rot: 0.5, scale: 1, alpha: 1 }
    stageProps.push(food)
    const sc: FeedScene = { food, bites: 0, landed: false, done: false, autoTimer: null }
    feedRef.current = sc
    const armIdleTimer = () => {
      if (sc.autoTimer !== null) window.clearTimeout(sc.autoTimer)
      sc.autoTimer = window.setTimeout(autoFinish, FEED_IDLE_MS)
    }
    if (prefersReducedMotion()) {
      food.y = FOOD_Y
      sc.landed = true
      armIdleTimer()
    } else {
      gsap.to(food, {
        y: FOOD_Y,
        duration: 0.55,
        ease: 'bounce.out',
        onComplete: () => {
          sc.landed = true
          armIdleTimer()
        },
      })
    }
    return () => {
      if (sc.autoTimer !== null) window.clearTimeout(sc.autoTimer)
      removeProp(stageProps, food)
      feedRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  // сценка «купание-тёрка»: жду проведения пальцем, таймер простоя домывает сам
  useEffect(() => {
    if (!scene || scene !== 'wash') return
    if (propsRef.current.stage === 'egg') return
    busyUntilRef.current = performance.now() + 14_000
    const sc: WashScene = { strokes: 0, done: false, autoTimer: null }
    washRef.current = sc
    armWashIdle()
    return () => {
      if (sc.autoTimer !== null) window.clearTimeout(sc.autoTimer)
      washRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  /** Перевзвод таймера простоя: любое движение пальцем откладывает «домывает сам». */
  function armWashIdle(): void {
    const sc = washRef.current
    if (!sc || sc.done) return
    if (sc.autoTimer !== null) window.clearTimeout(sc.autoTimer)
    sc.autoTimer = window.setTimeout(autoWashFinish, WASH_IDLE_MS)
  }

  /** Домывает сам: оставшиеся проведения проигрываются подряд, потом complete. */
  function autoWashFinish(): void {
    const sc = washRef.current
    if (!sc || sc.done) return
    sc.done = true
    if (sc.autoTimer !== null) window.clearTimeout(sc.autoTimer)
    const v = visRef.current
    const tl = gsap.timeline({ onComplete: () => completeRef.current?.('wash') })
    const remaining = WASH_STROKES - sc.strokes
    for (let i = 0; i < remaining; i++) {
      tl.add(() => {
        sc.strokes += 1
        spawnWashBubbles(particlesRef.current, SCENE_W / 2 + (Math.random() - 0.5) * 90, GROUND_Y - 50 - Math.random() * 60)
        washProgress(sc, v)
      })
      tl.to({}, { duration: 0.22 })
    }
  }

  /** Прогресс купания: грязь бледнеет, питомец вихляет. */
  function washProgress(sc: WashScene, v: PetVisualState): void {
    const progress = Math.min(1, sc.strokes / WASH_STROKES)
    const base = dirtIntensity(propsRef.current.dirtLevel)
    if (prefersReducedMotion()) {
      v.dirtAlpha = base * (1 - progress)
      return
    }
    gsap.to(v, { dirtAlpha: base * (1 - progress), duration: 0.3, ease: 'sine.out', overwrite: 'auto' })
    gsap.to(v, {
      wiggle: 0.08,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: 'sine.inOut',
      overwrite: 'auto',
      onComplete: () => {
        v.wiggle = 0
      },
    })
  }

  /** Вымыт: финальные пузыри, довольный прыжок, применяем wash(). */
  function finishWash(): void {
    const sc = washRef.current
    if (!sc || sc.done) return
    sc.done = true
    if (sc.autoTimer !== null) window.clearTimeout(sc.autoTimer)
    const v = visRef.current
    spawnWashBubbles(particlesRef.current, SCENE_W / 2, GROUND_Y - 70, 10)
    if (prefersReducedMotion()) {
      v.dirtAlpha = 0
      completeRef.current?.('wash')
      return
    }
    gsap
      .timeline({ delay: 0.25, onComplete: () => completeRef.current?.('wash') })
      .to(v, { dirtAlpha: 0, duration: 0.4, overwrite: 'auto' })
      .to(v, { jumpY: -20, duration: 0.16, ease: 'power2.out', overwrite: 'auto' }, 0.1)
      .to(v, { jumpY: 0, duration: 0.5, ease: 'elastic.out(1.1, 0.4)' })
  }

  const scenePoint = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * SCENE_W, y: ((e.clientY - rect.top) / rect.height) * SCENE_H }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = scenePoint(e)
    dragRef.current = { active: true, x: p.x, y: p.y, moved: 0 }
    dragMovedRef.current = false
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag?.active) return
    const sc = washRef.current
    if (!sc || sc.done) return
    const p = scenePoint(e)
    const seg = Math.hypot(p.x - drag.x, p.y - drag.y)
    if (seg < 6) return
    dragMovedRef.current = true
    drag.x = p.x
    drag.y = p.y
    // трём только по питомцу; мимо — просто едем дальше без счёта
    if (!hitPet(p.x, p.y)) return
    drag.moved += seg
    if (drag.moved < WASH_SEGMENT_PX) return
    drag.moved = 0
    sc.strokes += 1
    spawnWashBubbles(particlesRef.current, p.x, p.y)
    hapticTap()
    washProgress(sc, visRef.current)
    if (sc.strokes >= WASH_STROKES) finishWash()
    else armWashIdle()
  }

  const handlePointerUp = () => {
    dragRef.current = null
  }

  /** Укус: еда уменьшается, летят крошки, питомец наклоняется. */
  const biteFood = () => {
    const sc = feedRef.current
    if (!sc || sc.done || !sc.landed) return
    sc.bites += 1
    sc.food.scale = FEED_SCALES[Math.min(sc.bites, FEED_BITES) - 1]!
    spawnCrumbs(particlesRef.current, sc.food.x, FOOD_Y)
    hapticTap()
    const v = visRef.current
    gsap
      .timeline({ overwrite: 'auto' })
      .to(v, { lean: 0.14, duration: 0.1, ease: 'power2.out' })
      .to(v, { lean: 0, duration: 0.18, ease: 'sine.inOut' })
    if (sc.bites >= FEED_BITES) {
      sc.done = true
      if (sc.autoTimer !== null) window.clearTimeout(sc.autoTimer)
      gsap.to(sc.food, { alpha: 0, duration: 0.25, delay: 0.3 })
      gsap
        .timeline({ delay: 0.35, onComplete: () => completeRef.current?.('feed') })
        .to(v, { jumpY: -24, duration: 0.18, ease: 'power2.out', overwrite: 'auto' })
        .to(v, { jumpY: 0, duration: 0.55, ease: 'elastic.out(1.1, 0.4)' })
    } else {
      if (sc.autoTimer !== null) window.clearTimeout(sc.autoTimer)
      sc.autoTimer = window.setTimeout(autoFinish, FEED_IDLE_MS)
    }
  }

  /** Доедает сам: недостающие укусы проигрываются подряд, потом complete. */
  const autoFinish = () => {
    const sc = feedRef.current
    if (!sc || sc.done) return
    sc.done = true
    if (sc.autoTimer !== null) window.clearTimeout(sc.autoTimer)
    const v = visRef.current
    const tl = gsap.timeline({ onComplete: () => completeRef.current?.('feed') })
    const remaining = FEED_BITES - sc.bites
    for (let i = 0; i < remaining; i++) {
      tl.to(v, { lean: 0.14, duration: 0.1, ease: 'power2.out', overwrite: 'auto' })
      tl.add(() => {
        sc.food.scale = FEED_SCALES[Math.min(sc.bites + 1, FEED_BITES) - 1]!
        spawnCrumbs(particlesRef.current, sc.food.x, FOOD_Y)
        sc.bites += 1
      })
      tl.to(v, { lean: 0, duration: 0.18, ease: 'sine.inOut' })
    }
    tl.to(v, { jumpY: -24, duration: 0.18, ease: 'power2.out', overwrite: 'auto' })
    tl.to(v, { jumpY: 0, duration: 0.55, ease: 'elastic.out(1.1, 0.4)' })
    gsap.to(sc.food, { alpha: 0, duration: 0.25, delay: remaining * 0.28 + 0.3 })
  }

  /** Щедрая зона поглаживания: тело и уши питомца, где бы он ни гулял. */
  const hitPet = (x: number, y: number): boolean => {
    const petX = SCENE_W / 2 + wanderRef.current.x
    return Math.abs(x - petX) < 78 && y > GROUND_Y - 145 && y < GROUND_Y + 12
  }

  const handleTap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // после проведения пальцем click не должен срабатывать как тап
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * SCENE_W
    const y = ((e.clientY - rect.top) / rect.height) * SCENE_H
    // сценка кормления: тап по еде — укус (остальная реакция кадра не нужна)
    const sc = feedRef.current
    if (sc && sc.landed && !sc.done && Math.hypot(x - FOOD_X, y - FOOD_Y) <= FOOD_HIT_R) {
      biteFood()
      return
    }
    // сценка с мячом: тап по мячу — отбивание
    const ps = playRef.current
    if (ps && !ps.done && Math.hypot(x - ps.ball.x, y - ps.ball.y) <= PLAY_HIT_R) {
      hitBall()
      return
    }
    const stroked = propsRef.current.stage !== 'egg' && hitPet(x, y)
    const v = visRef.current
    busyUntilRef.current = Math.max(busyUntilRef.current, performance.now() + 1_200)
    const petX = SCENE_W / 2 + wanderRef.current.x
    for (let i = 0; i < 5; i++) {
      particlesRef.current.push({
        x: petX + (Math.random() - 0.5) * 40,
        y: GROUND_Y - 110,
        vx: (Math.random() - 0.5) * 70,
        vy: -60 - Math.random() * 70,
        rot: 0,
        vr: 0,
        life: 0,
        maxLife: 1,
        size: 5 + Math.random() * 3,
        color: '#ff8fae',
        shape: 'heart',
      })
    }
    if (!prefersReducedMotion()) {
      gsap
        .timeline()
        .to(v, { jumpY: -42, duration: 0.2, ease: 'power2.out' })
        .to(v, { jumpY: 0, duration: 0.65, ease: 'elastic.out(1.1, 0.4)' })
    }
    hapticTap()
    if (stroked) onPetTap?.()
    else onTap?.()
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleTap}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="img"
      aria-label="Питомец"
      style={{ width: '100%', display: 'block', touchAction: 'none', cursor: 'pointer' }}
    />
  )
}

/* ---------- анимации действий ---------- */

const DESIRE_ICON: Record<DesireKind, string> = {
  feed: '🍔',
  play: '🎮',
  wash: '🛁',
  sleep: '😴',
}

/** Пузырёк желания: болтается над головой питомца и показывает, чего он хочет. */
function drawDesireBubble(ctx: CanvasRenderingContext2D, kind: DesireKind, alpha: number, now: number, petX: number): void {
  const bob = Math.sin(now / 500) * 3
  const x = petX
  const y = GROUND_Y - 165 + bob
  ctx.save()
  ctx.globalAlpha = alpha
  // пузырь
  ctx.beginPath()
  roundRect(ctx, x - 23, y - 20, 46, 40, 12)
  ctx.fillStyle = '#fffdf6'
  ctx.strokeStyle = 'rgba(90, 70, 50, 0.25)'
  ctx.lineWidth = 1.5
  ctx.fill()
  ctx.stroke()
  // хвостик вниз к питомцу
  ctx.beginPath()
  ctx.moveTo(x - 7, y + 18.6)
  ctx.lineTo(x, y + 30)
  ctx.lineTo(x + 7, y + 18.6)
  ctx.closePath()
  ctx.fillStyle = '#fffdf6'
  ctx.fill()
  ctx.strokeStyle = 'rgba(90, 70, 50, 0.25)'
  ctx.beginPath()
  ctx.moveTo(x - 7, y + 19)
  ctx.lineTo(x, y + 30)
  ctx.lineTo(x + 7, y + 19)
  ctx.stroke()
  // иконка желания
  ctx.font = '24px "Apple Color Emoji", "Noto Color Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(DESIRE_ICON[kind], x, y + 1)
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Пузыри и капли там, где трёт палец. */
function spawnWashBubbles(particles: Particle[], x: number, y: number, count = 5): void {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 34,
      y: y + (Math.random() - 0.5) * 26,
      vx: (Math.random() - 0.5) * 20,
      vy: -(15 + Math.random() * 25),
      rot: 0,
      vr: 0,
      life: 0,
      maxLife: 1 + Math.random() * 0.8,
      size: 3 + Math.random() * 5,
      color: '#cdeaff',
      shape: 'bubble',
      grav: -25,
      wob: 16,
      wobPh: Math.random() * Math.PI * 2,
    })
  }
  for (let i = 0; i < 2; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 26,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 30,
      vy: 10,
      rot: 0,
      vr: 0,
      life: 0,
      maxLife: 0.7 + Math.random() * 0.3,
      size: 3.5 + Math.random() * 1.5,
      color: '#8fd3ff',
      shape: 'drop',
    })
  }
}

function spawnCrumbs(particles: Particle[], x: number, y: number): void {
  for (let i = 0; i < 4; i++) {
    particles.push({
      x: x - 6 + Math.random() * 10,
      y,
      vx: (Math.random() - 0.5) * 90,
      vy: -30 - Math.random() * 50,
      rot: 0,
      vr: 0,
      life: 0,
      maxLife: 0.55 + Math.random() * 0.3,
      size: 1.8 + Math.random() * 2,
      color: '#a5713d',
      shape: 'crumb',
      grav: 320,
    })
  }
}

function spawnSparkles(particles: Particle[]): void {
  for (let i = 0; i < 5; i++) {
    particles.push({
      x: SCENE_W / 2 + (Math.random() - 0.5) * 80,
      y: GROUND_Y - 95 - Math.random() * 35,
      vx: (Math.random() - 0.5) * 30,
      vy: -10 - Math.random() * 20,
      rot: Math.random() * Math.PI,
      vr: 1.5,
      life: 0,
      maxLife: 0.8 + Math.random() * 0.4,
      size: 3 + Math.random() * 2.5,
      color: '#ffd76a',
      shape: 'sparkle',
      grav: 0,
    })
  }
}

/* ---------- отрисовка реквизита, мусора и частиц ---------- */

function drawStageProps(ctx: CanvasRenderingContext2D, props: StageProp[]): void {
  for (const p of props) {
    if (p.kind === 'drumstick') drawDrumstick(ctx, p)
    else drawBall(ctx, p)
  }
}

/** Торт праздника дружбы: коржи с кремом, свеча с мерцающим огоньком. */
function drawCake(ctx: CanvasRenderingContext2D, x: number, y: number, tMs: number): void {
  ctx.save()
  ctx.translate(x, y)
  // тарелочка
  ctx.fillStyle = '#f3ecdf'
  ctx.strokeStyle = '#b7a98d'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(0, 2, 26, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // два коржа с кремовой прослойкой
  ctx.strokeStyle = '#7a4a22'
  ctx.lineWidth = 1.8
  ctx.fillStyle = '#c9803f'
  ctx.beginPath()
  roundRect(ctx, -20, -10, 40, 9, 4)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#ffe3ee'
  ctx.fillRect(-20, -13, 40, 4)
  ctx.fillStyle = '#f79cd0'
  ctx.beginPath()
  roundRect(ctx, -20, -21, 40, 9, 4)
  ctx.fill()
  ctx.stroke()
  // кремовые пики сверху
  ctx.fillStyle = '#ffe3ee'
  for (const dx of [-14, -5, 4, 13]) {
    ctx.beginPath()
    ctx.arc(dx, -21, 4.5, Math.PI, 0)
    ctx.fill()
  }
  // свеча и огонёк — мерцает
  ctx.fillStyle = '#8fd3ff'
  ctx.fillRect(-2, -33, 4, 12)
  const flicker = 1 + Math.sin(tMs / 120) * 0.18
  ctx.fillStyle = '#ffd76a'
  ctx.beginPath()
  ctx.ellipse(0, -37, 2.6 * flicker, 4 * flicker, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Ножка: мясо с косточкой, повёрнута к питомцу. */
function drawDrumstick(ctx: CanvasRenderingContext2D, f: StageProp): void {
  ctx.save()
  ctx.translate(f.x, f.y)
  ctx.rotate(f.rot)
  ctx.scale(f.scale, f.scale)
  ctx.globalAlpha = f.alpha
  // косточка
  ctx.strokeStyle = '#fff6e8'
  ctx.lineWidth = 4.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(9, 7)
  ctx.lineTo(17, 15)
  ctx.stroke()
  ctx.fillStyle = '#fff6e8'
  ctx.beginPath()
  ctx.arc(19, 17, 3.2, 0, Math.PI * 2)
  ctx.arc(15.5, 19.5, 3.2, 0, Math.PI * 2)
  ctx.fill()
  // мясо
  ctx.beginPath()
  ctx.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#c9803f'
  ctx.fill()
  ctx.strokeStyle = '#7a4a22'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(-3.5, -3, 5, 3, -0.5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 224, 170, 0.7)'
  ctx.fill()
  ctx.restore()
}

/** Мячик: красный с белой полосой, катится с наклоном. */
function drawBall(ctx: CanvasRenderingContext2D, b: StageProp): void {
  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.rotate(b.rot)
  ctx.scale(b.scale, b.scale)
  ctx.globalAlpha = b.alpha
  ctx.beginPath()
  ctx.arc(0, 0, 13, 0, Math.PI * 2)
  ctx.fillStyle = '#ff6b6b'
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = '#fff7ee'
  ctx.beginPath()
  ctx.ellipse(0, 0, 14, 4.6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = '#8a3038'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, 13, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(-4.5, -5.5, 2.6, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.fill()
  ctx.restore()
}

/**
 * Мусор на полянке у грязнули: рыбья кость справа, у самого запущенного —
 * ещё и смятый комок слева. Проявляется и смывается вместе с dirtAlpha.
 */
function drawTrash(ctx: CanvasRenderingContext2D, level: DirtLevel, alpha: number): void {
  if (level < 2 || alpha <= 0.01) return
  ctx.save()
  ctx.globalAlpha = alpha * 0.9
  drawFishbone(ctx, SCENE_W / 2 + 94, GROUND_Y + 5)
  if (level >= 3) drawScrap(ctx, SCENE_W / 2 - 98, GROUND_Y + 4)
  ctx.restore()
}

function drawFishbone(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.12)
  ctx.strokeStyle = '#9aa7b0'
  ctx.fillStyle = '#9aa7b0'
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-10, 0)
  ctx.lineTo(-15, -4)
  ctx.moveTo(-10, 0)
  ctx.lineTo(-15, 4)
  ctx.moveTo(-12, 0)
  ctx.lineTo(8, 0)
  ctx.stroke()
  for (const rx of [-6, 0, 6]) {
    ctx.beginPath()
    ctx.moveTo(rx, -5)
    ctx.quadraticCurveTo(rx + 2.5, 0, rx, 5)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(8, -4.5)
  ctx.lineTo(14.5, 0)
  ctx.lineTo(8, 4.5)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawScrap(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = '#d8d2c4'
  ctx.strokeStyle = '#a89f8c'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, 0, 6.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-4, -2)
  ctx.lineTo(1, 1)
  ctx.lineTo(-1, 4)
  ctx.moveTo(3, -3)
  ctx.lineTo(0, 2)
  ctx.stroke()
  ctx.restore()
}

function updateParticles(particles: Particle[], dt: number): void {
  for (const p of particles) {
    p.life += dt
    p.x += p.vx * dt + Math.sin(p.life * 5 + (p.wobPh ?? 0)) * (p.wob ?? 0) * dt
    p.y += p.vy * dt
    p.vy += (p.grav ?? 160) * dt
    p.rot += p.vr * dt
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i]!.life >= particles[i]!.maxLife) particles.splice(i, 1)
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    const alpha = 1 - p.life / p.maxLife
    switch (p.shape) {
      case 'heart':
        drawHeart(ctx, p.x, p.y, p.size, p.color, alpha)
        break
      case 'crumb':
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        break
      case 'bubble': {
        ctx.save()
        ctx.globalAlpha = alpha * 0.85
        ctx.strokeStyle = p.color
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
        ctx.beginPath()
        ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.22, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        break
      }
      case 'sparkle': {
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.strokeStyle = p.color
        ctx.lineWidth = 1.6
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(-p.size, 0)
        ctx.lineTo(p.size, 0)
        ctx.moveTo(0, -p.size)
        ctx.lineTo(0, p.size)
        ctx.stroke()
        ctx.restore()
        break
      }
      case 'drop': {
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.moveTo(p.x, p.y - p.size * 1.6)
        ctx.quadraticCurveTo(p.x + p.size, p.y, p.x, p.y + p.size * 1.1)
        ctx.quadraticCurveTo(p.x - p.size, p.y, p.x, p.y - p.size * 1.6)
        ctx.fill()
        ctx.restore()
        break
      }
      default: {
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6)
        ctx.restore()
      }
    }
  }
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, size * 0.35)
  ctx.bezierCurveTo(-size, -size * 0.45, -size * 0.5, -size, 0, -size * 0.35)
  ctx.bezierCurveTo(size * 0.5, -size, size, -size * 0.45, 0, size * 0.35)
  ctx.fill()
  ctx.restore()
}
