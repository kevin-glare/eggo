import { useEffect, useRef } from 'react'
import type { GameConfig } from '../../game/config'
import { createSnake, snakeScore, stepSnake, turnSnake, type SnakeDir, type SnakeState } from '../../game/minigames/snake'
import type { MinigameOutcome } from '../../game/minigames/types'
import { hapticTap } from '../../telegram'
import { getStrings } from '../i18n'
import { playSound } from '../sound'
import { PET_PALETTES } from '../petArt'
import type { PetAppearance } from '../../game/appearance'
import { applyWorld, canvasWorldSize, drawPill, drawScoreChip, fitWorld, type WorldView } from './canvasWorld'
import { drawMiniPet } from './miniPet'
import { useGameLoop } from './useGameLoop'

interface SnakeGameProps {
  config: GameConfig
  appearance: PetAppearance
  running: boolean
  onOver: (outcome: MinigameOutcome) => void
}

const SETTLE_MS = 700

/** Клетка подбирается под экран: поле занимает канвас целиком без пустых полос. */
function boardLayout(world: { w: number; h: number }, cellsAcross: number) {
  const cell = Math.min(40, Math.max(18, Math.floor(Math.min(world.w, world.h) / cellsAcross)))
  return {
    cell,
    cols: Math.max(9, Math.floor(world.w / cell)),
    rows: Math.max(9, Math.floor(world.h / cell)),
  }
}

/** «Змейка»: свайпы или стрелки, еда ускоряет; поле выводится из экрана. */
export default function SnakeGame({ config, appearance, running, onOver }: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const balance = config.minigames.snake
  // мир партии = реальный размер канваса; поле занимает его целиком
  const stateRef = useRef<SnakeState | null>(null)
  const layoutRef = useRef<{ cell: number; offsetX: number; offsetY: number }>({ cell: 26, offsetX: 0, offsetY: 0 })
  const viewRef = useRef<WorldView>({ dpr: 1, scale: 1, offsetX: 0, offsetY: 0 })
  const overRef = useRef(false)
  const onOverRef = useRef(onOver)
  onOverRef.current = onOver
  const swipeRef = useRef<{ x: number; y: number } | null>(null)
  // подсказка тает после первого поворота или через 3.5 с
  const hintRef = useRef({ at: 0, alpha: 0, used: false })

  const ensureState = (): SnakeState => {
    if (stateRef.current === null) {
      const world = canvasWorldSize(canvasRef.current!)
      const grid = boardLayout(world, balance.cellPx)
      layoutRef.current = {
        cell: grid.cell,
        offsetX: (world.w - grid.cols * grid.cell) / 2,
        offsetY: (world.h - grid.rows * grid.cell) / 2,
      }
      stateRef.current = createSnake(balance, { cols: grid.cols, rows: grid.rows }, Math.random)
    }
    return stateRef.current
  }

  useGameLoop((dtMs) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const s = stepSnake(ensureState(), dtMs, balance, Math.random)
    stateRef.current = s
    const h = hintRef.current
    if (h.at === 0) h.at = performance.now()
    const k = Math.min(1, dtMs / 250)
    h.alpha += ((h.used || performance.now() - h.at > 3500 ? 0 : 1) - h.alpha) * k
    draw(canvas, ctx, s)
    if (s.over && !overRef.current) {
      overRef.current = true
      const outcome: MinigameOutcome = { score: snakeScore(s), won: s.won }
      window.setTimeout(() => onOverRef.current(outcome), SETTLE_MS)
    }
  }, running)

  const draw = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, s: SnakeState) => {
    const world = canvasWorldSize(canvas)
    const view = fitWorld(canvas, world.w, world.h)
    viewRef.current = view
    applyWorld(ctx, canvas, view)
    const palette = PET_PALETTES[appearance.palette]
    const { cell, offsetX: boardX, offsetY: boardY } = layoutRef.current
    const boardW = s.grid.cols * cell
    const boardH = s.grid.rows * cell

    // поле: затемнённая доска со слабой шахматкой — клетка читается, глаз не рябит
    ctx.fillStyle = 'rgba(16, 9, 32, 0.6)'
    ctx.fillRect(boardX, boardY, boardW, boardH)
    ctx.fillStyle = 'rgba(245, 237, 255, 0.025)'
    for (let row = 0; row < s.grid.rows; row++) {
      for (let col = (row % 2 === 0 ? 0 : 1); col < s.grid.cols; col += 2) {
        ctx.fillRect(boardX + col * cell, boardY + row * cell, cell, cell)
      }
    }
    ctx.strokeStyle = 'rgba(167, 149, 201, 0.3)'
    ctx.lineWidth = 2
    ctx.strokeRect(boardX - 1, boardY - 1, boardW + 2, boardH + 2)

    // еда: яблоко
    const fx = boardX + s.food.x * cell + cell / 2
    const fy = boardY + s.food.y * cell + cell / 2
    ctx.fillStyle = '#ff6b6b'
    ctx.beginPath()
    ctx.arc(fx, fy + 1, cell * 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#8a3038'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.strokeStyle = '#9ec97f'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(fx, fy - cell * 0.24)
    ctx.quadraticCurveTo(fx + 5, fy - cell * 0.4, fx + 9, fy - cell * 0.32)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.beginPath()
    ctx.arc(fx - cell * 0.09, fy - cell * 0.05, 2.4, 0, Math.PI * 2)
    ctx.fill()

    // тело: сплошная лента через центры клеток — контур, окрас, блик;
    // сквозь стену лента рвётся (телепорт), но выглядит как выход за край
    const center = (c: { x: number; y: number }) => ({ x: boardX + c.x * cell + cell / 2, y: boardY + c.y * cell + cell / 2 })
    const path = new Path2D()
    let prev: { x: number; y: number } | null = null
    for (const seg of s.snake) {
      const p = center(seg)
      if (prev === null || Math.abs(p.x - prev.x) > cell * 1.5 || Math.abs(p.y - prev.y) > cell * 1.5) {
        path.moveTo(p.x, p.y)
      } else {
        path.lineTo(p.x, p.y)
      }
      prev = p
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = palette.outline
    ctx.lineWidth = cell * 0.78
    ctx.stroke(path)
    const tape = ctx.createLinearGradient(boardX, boardY, boardX, boardY + boardH)
    tape.addColorStop(0, palette.bodyMid)
    tape.addColorStop(1, palette.bodyShade)
    ctx.strokeStyle = tape
    ctx.lineWidth = cell * 0.6
    ctx.stroke(path)
    ctx.strokeStyle = 'rgba(255, 248, 235, 0.35)'
    ctx.lineWidth = cell * 0.2
    ctx.stroke(path)

    // голова — тот же мини-питомец: уши, глаза, румянец; наклон по движению
    const head = center(s.snake[0]!)
    const tilt = s.dir === 'left' ? -0.12 : s.dir === 'right' ? 0.12 : s.dir === 'up' ? -0.1 : 0.1
    drawMiniPet(ctx, palette, head.x, head.y, cell * 0.46, { eyes: 'open', tilt })

    drawPill(ctx, getStrings().mgHint.snake, boardX + boardW / 2, boardY + cell * 1.4, hintRef.current.alpha)
    drawScoreChip(ctx, String(snakeScore(s)), 12, 12)
  }

  const doTurn = (dir: SnakeDir) => {
    if (!running) return
    hapticTap()
    playSound('tap')
    hintRef.current.used = true
    stateRef.current = turnSnake(ensureState(), dir)
  }

  // стрелки
  useEffect(() => {
    if (!running) return
    const map: Record<string, SnakeDir> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    }
    const down = (e: KeyboardEvent) => {
      const dir = map[e.code]
      if (!dir) return
      e.preventDefault()
      doTurn(dir)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    swipeRef.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start || !running) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.hypot(dx, dy) < 18) return
    doTurn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  return (
    <canvas
      ref={canvasRef}
      className="mg-canvas"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipeRef.current = null)}
      aria-label="Змейка"
    />
  )
}
