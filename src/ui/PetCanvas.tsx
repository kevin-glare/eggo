import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { PetAppearance } from '../game/appearance'
import type { Mood, Stage } from '../game/types'
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

interface PetCanvasProps {
  stage: Stage
  mood: Mood
  /** внешность («гены») питомца — что рисовать */
  appearance: PetAppearance
  /** 0..1 — насколько яйцо близко к вылуплению */
  eggProgress: number
  /** dev: подменный час неба; null = локальное время пользователя */
  skyHourOverride?: number | null
  onTap?: () => void
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
  shape: 'heart' | 'shard'
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

export default function PetCanvas({ stage, mood, appearance, eggProgress, skyHourOverride, onTap }: PetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ stage, mood, appearance, eggProgress, skyHourOverride })
  propsRef.current = { stage, mood, appearance, eggProgress, skyHourOverride }
  const visRef = useRef<PetVisualState>(createVisualState())
  const sceneRef = useRef({ energy: 0.7, warm: 0.9 })
  const particlesRef = useRef<Particle[]>([])
  const prevStageRef = useRef(stage)

  // канвас, рендер-цикл и вечные GSAP-циклы (дыхание, покачивание, моргание)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = SCENE_W * dpr
    canvas.height = SCENE_H * dpr

    const v = visRef.current
    const particles = particlesRef.current

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
      const { stage: st, mood: md, appearance: look, eggProgress: prog, skyHourOverride: skyHour } = propsRef.current

      // яйцо качается тем сильнее, чем ближе вылупление
      if (st === 'egg') {
        v.tilt = Math.sin((now / 1000) * (2 + 7 * prog)) * (0.02 + 0.09 * prog)
      } else {
        v.tilt = 0
      }

      // небо: подменный час (dev) или локальное время пользователя
      const d = new Date()
      const hour = skyHour ?? d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600
      const sky = sampleDayCycle(hour)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawScene(ctx, SCENE_W, SCENE_H, sceneRef.current, now, sky)
      updateParticles(particles, dt / 1000)
      drawParticles(ctx, particles)
      drawPet(ctx, st, md, look, v, now, prog)
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

  // вылупление: пружинка роста + конфетти из скорлупы
  useEffect(() => {
    if (prevStageRef.current === 'egg' && stage !== 'egg') {
      const v = visRef.current
      const particles = particlesRef.current
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

  const handleTap = () => {
    const v = visRef.current
    for (let i = 0; i < 5; i++) {
      particlesRef.current.push({
        x: SCENE_W / 2 + (Math.random() - 0.5) * 40,
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
    onTap?.()
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

function updateParticles(particles: Particle[], dt: number): void {
  for (const p of particles) {
    p.life += dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 160 * dt
    p.rot += p.vr * dt
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i]!.life >= particles[i]!.maxLife) particles.splice(i, 1)
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    const alpha = 1 - p.life / p.maxLife
    if (p.shape === 'heart') {
      drawHeart(ctx, p.x, p.y, p.size, p.color, alpha)
    } else {
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
