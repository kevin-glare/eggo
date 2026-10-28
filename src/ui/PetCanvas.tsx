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

/** Импульс успешного действия: n растёт — канвас проигрывает анимацию заново. */
export interface ActionPulse {
  kind: PetActionKind
  n: number
}

interface PetCanvasProps {
  stage: Stage
  mood: Mood
  /** внешность («гены») питомца — что рисовать */
  appearance: PetAppearance
  /** 0..1 — насколько яйцо близко к вылуплению */
  eggProgress: number
  /** 0..3 — насколько питомец грязный (из чистоты); undefined = чист */
  dirtLevel?: DirtLevel
  /** последнее успешное действие — для анимации отклика */
  actionPulse?: ActionPulse | null
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
  actionPulse,
  desire,
  skyHourOverride,
  onTap,
  onPetTap,
  scene,
  onSceneComplete,
}: PetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ stage, mood, appearance, eggProgress, skyHourOverride, dirtLevel })
  propsRef.current = { stage, mood, appearance, eggProgress, skyHourOverride, dirtLevel }
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
      const { stage: st, mood: md, appearance: look, eggProgress: prog, skyHourOverride: skyHour, dirtLevel: dirt } =
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

  // анимация отклика на действие: купание, игра с мячиком (кормление — отдельная сценка)
  useEffect(() => {
    if (!actionPulse || actionPulse.n === 0) return
    if (propsRef.current.stage === 'egg') return
    // на время сценки питомец занят: стоит в центре, где лежит реквизит
    busyUntilRef.current = performance.now() + 2_600
    const v = visRef.current
    const particles = particlesRef.current
    const stageProps = stagePropsRef.current
    if (actionPulse.kind === 'wash') runWash(v, particles)
    else runPlay(v, stageProps, particles)
  }, [actionPulse])

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
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * SCENE_W
    const y = ((e.clientY - rect.top) / rect.height) * SCENE_H
    // сценка кормления: тап по еде — укус (остальная реакция кадра не нужна)
    const sc = feedRef.current
    if (sc && sc.landed && !sc.done && Math.hypot(x - FOOD_X, y - FOOD_Y) <= FOOD_HIT_R) {
      biteFood()
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
      role="img"
      aria-label="Питомец"
      style={{ width: '100%', display: 'block', touchAction: 'manipulation', cursor: 'pointer' }}
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

function runWash(v: PetVisualState, particles: Particle[]): void {
  if (prefersReducedMotion()) return
  // облако пузырей вокруг питомца
  for (let i = 0; i < 9; i++) {
    particles.push({
      x: SCENE_W / 2 + (Math.random() - 0.5) * 120,
      y: GROUND_Y - 10 - Math.random() * 80,
      vx: 0,
      vy: -(15 + Math.random() * 25),
      rot: 0,
      vr: 0,
      life: 0,
      maxLife: 1.1 + Math.random() * 0.9,
      size: 3 + Math.random() * 5,
      color: '#cdeaff',
      shape: 'bubble',
      grav: -25,
      wob: 16,
      wobPh: Math.random() * Math.PI * 2,
    })
  }
  // брызги стекают с питомца
  for (let i = 0; i < 5; i++) {
    particles.push({
      x: SCENE_W / 2 + (Math.random() - 0.5) * 80,
      y: GROUND_Y - 100 - Math.random() * 25,
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
  gsap.to(v, {
    wiggle: 0.09,
    duration: 0.14,
    yoyo: true,
    repeat: 7,
    ease: 'sine.inOut',
    overwrite: 'auto',
    onComplete: () => {
      v.wiggle = 0
    },
  })
}

function runPlay(v: PetVisualState, stageProps: StageProp[], particles: Particle[]): void {
  const ball: StageProp = { kind: 'ball', x: -30, y: BALL_REST_Y, rot: 0, scale: 1, alpha: 1 }
  stageProps.push(ball)
  if (prefersReducedMotion()) {
    ball.x = SCENE_W / 2 - 70
    gsap.to(ball, { alpha: 0, delay: 1, duration: 0.4, onComplete: () => removeProp(stageProps, ball) })
    return
  }
  const tl = gsap.timeline({ onComplete: () => removeProp(stageProps, ball) })
  // мячик закатывается слева двумя дугами
  tl.to(ball, { x: SCENE_W / 2 - 70, duration: 0.8, ease: 'none' }, 0)
  tl.to(ball, { y: BALL_REST_Y - 62, duration: 0.4, ease: 'power2.out' }, 0)
  tl.to(ball, { y: BALL_REST_Y, duration: 0.4, ease: 'power2.in' }, 0.4)
  // питомец прыгает навстречу и отбивает
  tl.to(v, { jumpY: -30, duration: 0.16, ease: 'power2.out', overwrite: 'auto' }, 0.8)
  tl.to(v, { jumpY: 0, duration: 0.12, ease: 'power2.in' }, 0.96)
  tl.to(ball, { x: SCENE_W + 40, duration: 0.75, ease: 'none' }, 1.08)
  tl.to(ball, { y: BALL_REST_Y - 55, duration: 0.3, ease: 'power2.out' }, 1.08)
  tl.to(ball, { y: BALL_REST_Y, duration: 0.45, ease: 'power2.in' }, 1.38)
  tl.to(ball, { rot: 9, duration: 1.8, ease: 'none' }, 0)
  tl.add(() => spawnSparkles(particles), 1.1)
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
