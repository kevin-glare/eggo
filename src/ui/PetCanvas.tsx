import { useEffect, useRef } from 'react'
import { BLINK_FACE, BODIES, CRACKS, FACES, PALETTE, type Sprite } from '../game/sprites'
import type { Mood, Stage } from '../game/types'

const CELL = 16 // сетка спрайта 16×16
const PX = 16 // размер «пикселя» питомца на канвасе
const PET_W = CELL * PX
const W = PET_W
const H = 320
const GROUND_Y = 290

interface PetCanvasProps {
  stage: Stage
  mood: Mood
  /** 0..1 — насколько яйцо близко к вылуплению (усиливает тряску и трещины) */
  eggProgress: number
  onTap?: () => void
}

function drawGrid(ctx: CanvasRenderingContext2D, sprite: Sprite, x0: number, y0: number, px: number) {
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x] ?? '.'] ?? ''
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x0 + x * px, y0 + y * px, px, px)
    }
  })
}

/** Питомец: яйца качаются, малыши дышат и моргают, по тапу — прыжок. */
export default function PetCanvas({ stage, mood, eggProgress, onTap }: PetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ stage, mood, eggProgress })
  propsRef.current = { stage, mood, eggProgress }
  const jumpRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr

    let raf = 0
    let nextBlink = performance.now() + 2000 + Math.random() * 3000
    let blinkUntil = 0

    const frame = (t: number) => {
      const current = propsRef.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // тень на земле
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
      ctx.beginPath()
      ctx.ellipse(W / 2, GROUND_Y + 6, PET_W / 3.2, 7, 0, 0, Math.PI * 2)
      ctx.fill()

      // прыжок по тапу — парабола за 380 мс
      let jump = 0
      if (jumpRef.current !== null) {
        const p = (t - jumpRef.current) / 380
        if (p >= 1) jumpRef.current = null
        else jump = -Math.sin(Math.PI * p) * 28
      }

      // моргание — только с открытыми глазами
      const eyesOpen = mood === 'happy' || mood === 'content' || mood === 'sad' || mood === 'sick'
      if (eyesOpen && t > nextBlink) {
        blinkUntil = t + 140
        nextBlink = t + 2600 + Math.random() * 3800
      }
      const blink = eyesOpen && t < blinkUntil

      ctx.save()
      ctx.translate(W / 2, GROUND_Y + jump)
      const isEgg = current.stage === 'egg'
      if (isEgg) {
        // чем ближе вылупление, тем сильнее трясётся
        const shake = 0.03 + current.eggProgress * 0.08
        const speed = 2 + current.eggProgress * 7
        ctx.rotate(Math.sin((t / 1000) * speed) * shake)
      } else {
        const squash = 1 - 0.03 * (0.5 - 0.5 * Math.cos((t / 1000) * ((Math.PI * 2) / 1.7)))
        ctx.scale(1, squash)
      }

      const x0 = -PET_W / 2
      const y0 = -PET_W
      drawGrid(ctx, BODIES[current.stage], x0, y0, PX)
      if (isEgg) {
        if (current.eggProgress > 0.75) drawGrid(ctx, CRACKS.second, x0, y0, PX)
        else if (current.eggProgress > 0.35) drawGrid(ctx, CRACKS.first, x0, y0, PX)
      } else {
        drawGrid(ctx, blink ? BLINK_FACE : FACES[current.mood], x0, y0, PX)
      }
      ctx.restore()

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      onClick={() => {
        jumpRef.current = performance.now()
        onTap?.()
      }}
      style={{ width: '100%', maxWidth: W, touchAction: 'manipulation', cursor: 'pointer' }}
    />
  )
}
