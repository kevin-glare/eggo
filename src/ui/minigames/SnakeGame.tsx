import { useEffect, useRef } from 'react'
import type { GameConfig } from '../../game/config'
import { createSnake, snakeScore, stepSnake, turnSnake, type SnakeDir, type SnakeState } from '../../game/minigames/snake'
import type { MinigameOutcome } from '../../game/minigames/types'
import { hapticTap } from '../../telegram'
import { playSound } from '../sound'
import { PET_PALETTES } from '../petArt'
import type { PetAppearance } from '../../game/appearance'
import { applyWorld, drawScoreChip, fitWorld, type WorldView } from './canvasWorld'
import { useGameLoop } from './useGameLoop'

interface SnakeGameProps {
  config: GameConfig
  appearance: PetAppearance
  running: boolean
  onOver: (outcome: MinigameOutcome) => void
}

const SETTLE_MS = 700
const CELL = 26
const BOARD_PAD = 24

/** «Змейка»: свайпы или стрелки, еда ускоряет. */
export default function SnakeGame({ config, appearance, running, onOver }: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const balance = config.minigames.snake
  const stateRef = useRef<SnakeState>(createSnake(balance, Math.random))
  const viewRef = useRef<WorldView>({ dpr: 1, scale: 1, offsetX: 0, offsetY: 0 })
  const overRef = useRef(false)
  const onOverRef = useRef(onOver)
  onOverRef.current = onOver
  const swipeRef = useRef<{ x: number; y: number } | null>(null)

  useGameLoop((dtMs) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const s = stepSnake(stateRef.current, dtMs, balance, Math.random)
    stateRef.current = s
    draw(canvas, ctx, s)
    if (s.over && !overRef.current) {
      overRef.current = true
      const outcome: MinigameOutcome = { score: snakeScore(s), won: s.won }
      window.setTimeout(() => onOverRef.current(outcome), SETTLE_MS)
    }
  }, running)

  const draw = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, s: SnakeState) => {
    const view = fitWorld(canvas, 390, 420)
    viewRef.current = view
    applyWorld(ctx, canvas, view)
    const palette = PET_PALETTES[appearance.palette]
    const boardW = balance.cells * CELL
    const boardX = (390 - boardW) / 2
    const boardY = BOARD_PAD

    // поле: стеклянная доска в языке карточек
    ctx.fillStyle = 'rgba(20, 12, 38, 0.55)'
    ctx.strokeStyle = 'rgba(167, 149, 201, 0.35)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.rect(boardX - 6, boardY - 6, boardW + 12, boardW + 12)
    ctx.fill()
    ctx.stroke()

    // еда: яблоко
    const fx = boardX + s.food.x * CELL + CELL / 2
    const fy = boardY + s.food.y * CELL + CELL / 2
    ctx.fillStyle = '#ff6b6b'
    ctx.beginPath()
    ctx.arc(fx, fy + 1, CELL * 0.32, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#8a3038'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.strokeStyle = '#9ec97f'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(fx, fy - CELL * 0.26)
    ctx.quadraticCurveTo(fx + 5, fy - CELL * 0.42, fx + 9, fy - CELL * 0.34)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.beginPath()
    ctx.arc(fx - CELL * 0.1, fy - CELL * 0.06, 2.4, 0, Math.PI * 2)
    ctx.fill()

    // змейка: тело — питомец, голова с глазами
    for (let i = s.snake.length - 1; i >= 0; i--) {
      const c = s.snake[i]!
      const x = boardX + c.x * CELL + CELL / 2
      const y = boardY + c.y * CELL + CELL / 2
      const r = i === 0 ? CELL * 0.44 : CELL * 0.38
      const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r * 1.4)
      grad.addColorStop(0, i === 0 ? palette.bodyLight : palette.bodyMid)
      grad.addColorStop(1, palette.bodyShade)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = palette.outline
      ctx.lineWidth = 2
      ctx.stroke()
      if (i === 0) {
        // глазки по направлению
        const dx = s.dir === 'left' ? -1 : s.dir === 'right' ? 1 : 0
        const dy = s.dir === 'up' ? -1 : s.dir === 'down' ? 1 : 0
        ctx.fillStyle = '#2c2118'
        for (const side of [-1, 1]) {
          ctx.beginPath()
          ctx.arc(x + dx * r * 0.35 + (dy === 0 ? 0 : side * r * 0.3), y + dy * r * 0.35 - (dx === 0 ? 0 : side * r * 0.3), 2.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    drawScoreChip(ctx, String(snakeScore(s)), 12, 12)
  }

  const doTurn = (dir: SnakeDir) => {
    if (!running) return
    hapticTap()
    playSound('tap')
    stateRef.current = turnSnake(stateRef.current, dir)
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
