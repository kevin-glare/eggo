import { useRef } from 'react'
import type { GameConfig } from '../../game/config'
import { bubblesScore, createBubbles, stepBubbles, tapBubble, type BubblesState } from '../../game/minigames/bubbles'
import type { MinigameOutcome } from '../../game/minigames/types'
import { hapticTap } from '../../telegram'
import { playSound } from '../sound'
import { applyWorld, canvasWorldSize, drawScoreChip, fitWorld, worldPoint, type WorldView } from './canvasWorld'
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
const BOARD_PAD = 12

/** Кольцо-хлопок: анимация лопания живёт в рендере, не в ядре. */
interface PopRing {
  x: number
  y: number
  color: string
  life: number
}

/** «Пузыри»: тап по группе из трёх и больше одинаковых — хлоп! Поле на весь экран. */
export default function BubblesGame({ config, running, onOver }: BubblesGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const balance = config.minigames.bubbles
  // мир партии = реальный размер канваса; сетка выводится из клетки cellPx
  const stateRef = useRef<BubblesState | null>(null)
  const viewRef = useRef<WorldView>({ dpr: 1, scale: 1, offsetX: 0, offsetY: 0 })
  const ringsRef = useRef<PopRing[]>([])
  const overRef = useRef(false)
  const onOverRef = useRef(onOver)
  onOverRef.current = onOver

  const ensureState = (): BubblesState => {
    if (stateRef.current === null) {
      const world = canvasWorldSize(canvasRef.current!)
      const size = {
        cols: Math.min(30, Math.max(6, Math.floor(world.w / balance.cellPx))),
        rows: Math.min(40, Math.max(8, Math.floor(world.h / balance.cellPx))),
      }
      stateRef.current = createBubbles(balance, size, Math.random)
    }
    return stateRef.current
  }

  useGameLoop((dtMs) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const s = stepBubbles(ensureState(), dtMs, balance, Math.random)
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
    const boardW = s.size.cols * CELL
    const boardH = s.size.rows * CELL
    const view = fitWorld(canvas, boardW + 24, boardH + 24)
    viewRef.current = view
    applyWorld(ctx, canvas, view)
    const boardX = 12
    const boardY = 12

    // опасная кромка: ряд, до которого нельзя дать полю подняться
    ctx.strokeStyle = 'rgba(255, 107, 122, 0.4)'
    ctx.setLineDash([6, 6])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(boardX, boardY)
    ctx.lineTo(boardX + boardW, boardY)
    ctx.stroke()
    ctx.setLineDash([])

    for (let row = 0; row < s.size.rows; row++) {
      for (let col = 0; col < s.size.cols; col++) {
        const color = s.grid[row * s.size.cols + col]!
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
    const boardX = 12
    const col = Math.floor((p.x - boardX) / CELL)
    const row = Math.floor((p.y - BOARD_PAD) / CELL)
    const { state, popped } = tapBubble(ensureState(), balance, col, row)
    stateRef.current = state
    if (popped === 0) return
    hapticTap()
    playSound('pop')
    const color = BUBBLE_COLORS[state.grid[row * state.size.cols + col] ?? 0] ?? '#ffb35c'
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
