import { useRef } from 'react'
import type { GameConfig } from '../../game/config'
import { bubblesScore, createBubbles, stepBubbles, tapBubble, type BubblesState } from '../../game/minigames/bubbles'
import type { MinigameOutcome } from '../../game/minigames/types'
import { hapticTap } from '../../telegram'
import { getStrings } from '../i18n'
import { playSound } from '../sound'
import { applyWorld, canvasWorldSize, drawPill, drawScoreChip, fitWorld, worldPoint, type WorldView } from './canvasWorld'
import { drawMiniPet } from './miniPet'
import { PET_PALETTES } from '../petArt'
import { useGameLoop } from './useGameLoop'

interface BubblesGameProps {
  config: GameConfig
  running: boolean
  onOver: (outcome: MinigameOutcome) => void
}

const SETTLE_MS = 700
/** Окрасы шариков-персонажей — четыре палитры питомцев Eggo. */
const BUBBLE_PALETTES = [PET_PALETTES.sunny, PET_PALETTES.mint, PET_PALETTES.sky, PET_PALETTES.pink]
/** Цвет колец-хлопков под каждый окрас. */
const BUBBLE_COLORS = ['#ffb35c', '#8fe0b0', '#8fd3ff', '#ffb0ce'] as const

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
  const layoutRef = useRef<{ cell: number; offsetX: number; offsetY: number }>({ cell: 40, offsetX: 0, offsetY: 0 })
  const viewRef = useRef<WorldView>({ dpr: 1, scale: 1, offsetX: 0, offsetY: 0 })
  const ringsRef = useRef<PopRing[]>([])
  const overRef = useRef(false)
  const onOverRef = useRef(onOver)
  onOverRef.current = onOver
  // подсказка тает после первого хлопка или через 3.5 с
  const hintRef = useRef({ at: 0, alpha: 0, used: false })

  const ensureState = (): BubblesState => {
    if (stateRef.current === null) {
      // клетка подбирается под экран: поле занимает канвас целиком
      const world = canvasWorldSize(canvasRef.current!)
      const cell = Math.min(54, Math.max(30, Math.floor(Math.min(world.w, world.h) / 11)))
      const size = {
        cols: Math.max(6, Math.floor(world.w / cell)),
        rows: Math.max(8, Math.floor(world.h / cell)),
      }
      layoutRef.current = { cell, offsetX: (world.w - size.cols * cell) / 2, offsetY: (world.h - size.rows * cell) / 2 }
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
    const h = hintRef.current
    if (h.at === 0) h.at = performance.now()
    h.alpha += ((h.used || performance.now() - h.at > 3500 ? 0 : 1) - h.alpha) * Math.min(1, dtMs / 250)
    draw(canvas, ctx, s)
    if (s.over && !overRef.current) {
      overRef.current = true
      const outcome: MinigameOutcome = { score: bubblesScore(s), won: s.won }
      window.setTimeout(() => onOverRef.current(outcome), SETTLE_MS)
    }
  }, running)

  const draw = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, s: BubblesState) => {
    const world = canvasWorldSize(canvas)
    const view = fitWorld(canvas, world.w, world.h)
    viewRef.current = view
    applyWorld(ctx, canvas, view)
    const CELL = layoutRef.current.cell
    const boardW = s.size.cols * CELL
    const boardX = layoutRef.current.offsetX
    const boardY = layoutRef.current.offsetY

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
        // каждый шар — мини-питомец своего окраса (палитры Eggo)
        const pal = BUBBLE_PALETTES[color] ?? PET_PALETTES.sunny
        // лёгкое покачивание — живые шарики
        const wob = Math.sin(performance.now() / 700 + col * 1.7 + row * 0.9) * 1.5
        drawMiniPet(ctx, pal, x, y + wob, CELL * 0.36, { eyes: 'open' })
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

    drawPill(ctx, getStrings().mgHint.bubbles, boardX + boardW / 2, boardY + 42, hintRef.current.alpha)
    // счёт — тот же чип, что у соседей
    drawScoreChip(ctx, String(bubblesScore(s)), 12, 12)
  }

  const onTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!running) return
    const canvas = canvasRef.current
    if (!canvas) return
    const p = worldPoint(canvas, viewRef.current, e.clientX, e.clientY)
    const boardX = layoutRef.current.offsetX
    const boardY = layoutRef.current.offsetY
    const col = Math.floor((p.x - boardX) / layoutRef.current.cell)
    const row = Math.floor((p.y - boardY) / layoutRef.current.cell)
    const { state, popped } = tapBubble(ensureState(), balance, col, row)
    stateRef.current = state
    if (popped === 0) return
    hapticTap()
    playSound('pop')
    hintRef.current.used = true
    const color = BUBBLE_COLORS[state.grid[row * state.size.cols + col] ?? 0] ?? '#ffb35c'
    ringsRef.current.push({
      x: boardX + col * layoutRef.current.cell + layoutRef.current.cell / 2,
      y: boardY + row * layoutRef.current.cell + layoutRef.current.cell / 2,
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
