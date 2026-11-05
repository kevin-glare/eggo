import { useRef } from 'react'
import type { GameConfig } from '../../game/config'
import { bubblesScore, createBubbles, stepBubbles, tapBubble, type BubblesState } from '../../game/minigames/bubbles'
import type { MinigameOutcome } from '../../game/minigames/types'
import { hapticTap } from '../../telegram'
import { applyWorld, drawScoreChip, fitWorld, worldPoint, type WorldView } from './canvasWorld'
import { useGameLoop } from './useGameLoop'

interface BubblesGameProps {
  config: GameConfig
  running: boolean
  onOver: (outcome: MinigameOutcome) => void
}

const SETTLE_MS = 700
/** Цвета пузырей — палитра Eggo: апельсин, мята, небо, розовый. */
const BUBBLE_COLORS = ['#ffb35c', '#8fe0b0', '#8fd3ff', '#ffb0ce'] as const
const CELL = 40
const BOARD_PAD = 14

/** Кольцо-хлопок: анимация лопания живёт в рендере, не в ядре. */
interface PopRing {
  x: number
  y: number
  color: string
  life: number
}

/** «Пузыри»: тап по группе из трёх и больше одинаковых — хлоп! */
export default function BubblesGame({ config, running, onOver }: BubblesGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const balance = config.minigames.bubbles
  const stateRef = useRef<BubblesState>(createBubbles(balance, Math.random))
  const viewRef = useRef<WorldView>({ dpr: 1, scale: 1, offsetX: 0, offsetY: 0 })
  const ringsRef = useRef<PopRing[]>([])
  const overRef = useRef(false)
  const onOverRef = useRef(onOver)
  onOverRef.current = onOver

  useGameLoop((dtMs) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const s = stepBubbles(stateRef.current, dtMs, balance, Math.random)
    stateRef.current = s
    const dt = dtMs / 1000
    for (const r of ringsRef.current) r.life += dt
    ringsRef.current = ringsRef.current.filter((r) => r.life < 0.45)
    draw(canvas, ctx, s)
    if (s.over && !overRef.current) {
      overRef.current = true
      const outcome: MinigameOutcome = { score: bubblesScore(s), won: s.won }
      window.setTimeout(() => onOverRef.current(outcome), SETTLE_MS)
    }
  }, running)

  const draw = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, s: BubblesState) => {
    const view = fitWorld(canvas, 390, 420)
    viewRef.current = view
    applyWorld(ctx, canvas, view)
    const boardW = balance.cols * CELL
    const boardX = (390 - boardW) / 2
    const boardY = BOARD_PAD

    // опасная кромка: ряд, до которого нельзя дать полю подняться
    ctx.strokeStyle = 'rgba(255, 107, 122, 0.4)'
    ctx.setLineDash([6, 6])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(boardX, boardY)
    ctx.lineTo(boardX + boardW, boardY)
    ctx.stroke()
    ctx.setLineDash([])

    for (let row = 0; row < balance.rows; row++) {
      for (let col = 0; col < balance.cols; col++) {
        const color = s.grid[row * balance.cols + col]!
        if (color < 0) continue
        const x = boardX + col * CELL + CELL / 2
        const y = boardY + row * CELL + CELL / 2
        const base = BUBBLE_COLORS[color] ?? '#ffb35c'
        const grad = ctx.createRadialGradient(x - 6, y - 7, 3, x, y, CELL * 0.46)
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
        grad.addColorStop(0.35, base)
        grad.addColorStop(1, 'rgba(30, 18, 52, 0.35)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x, y, CELL * 0.42, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.lineWidth = 1.4
        ctx.stroke()
      }
    }

    // кольца-хлопки
    for (const r of ringsRef.current) {
      const t = r.life / 0.45
      ctx.strokeStyle = r.color
      ctx.globalAlpha = 1 - t
      ctx.lineWidth = 3 * (1 - t) + 1
      ctx.beginPath()
      ctx.arc(r.x, r.y, CELL * (0.4 + t * 0.55), 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // счёт — тот же чип, что у соседей
    drawScoreChip(ctx, String(bubblesScore(s)), 12, 12)
  }

  const onTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!running) return
    const canvas = canvasRef.current
    if (!canvas) return
    const p = worldPoint(canvas, viewRef.current, e.clientX, e.clientY)
    const boardW = balance.cols * CELL
    const boardX = (390 - boardW) / 2
    const col = Math.floor((p.x - boardX) / CELL)
    const row = Math.floor((p.y - BOARD_PAD) / CELL)
    const { state, popped } = tapBubble(stateRef.current, balance, col, row)
    stateRef.current = state
    if (popped === 0) return
    hapticTap()
    const color = BUBBLE_COLORS[state.grid[row * balance.cols + col] ?? 0] ?? '#ffb35c'
    ringsRef.current.push({
      x: boardX + col * CELL + CELL / 2,
      y: BOARD_PAD + row * CELL + CELL / 2,
      color,
      life: 0,
    })
  }

  return (
    <canvas
      ref={canvasRef}
      className="mg-canvas"
      onPointerDown={(e) => {
        e.preventDefault()
        onTap(e)
      }}
      aria-label="Пузыри"
    />
  )
}
