import { useEffect, useRef } from 'react'
import type { PetAppearance } from '../../game/appearance'
import type { GameConfig } from '../../game/config'
import {
  createRunner,
  duckRunner,
  jumpRunner,
  RUNNER_GROUND_H,
  RUNNER_HIT,
  RUNNER_PET_X,
  runnerScore,
  stepRunner,
  type RunnerState,
} from '../../game/minigames/runner'
import { canvasWorldSize } from './canvasWorld'
import type { MinigameOutcome } from '../../game/minigames/types'
import { hapticTap } from '../../telegram'
import { playSound } from '../sound'
import { PET_PALETTES } from '../petArt'
import { applyWorld, drawMinigameSky, drawScoreChip, fitWorld, worldPoint, type WorldView } from './canvasWorld'
import { drawMiniPet } from './miniPet'
import { useGameLoop } from './useGameLoop'

interface RunnerGameProps {
  config: GameConfig
  appearance: PetAppearance
  running: boolean
  onOver: (outcome: MinigameOutcome) => void
}

const SETTLE_MS = 700
/** Свайп вниз на столько px — присед. */
const SWIPE_DOWN_PX = 26

/** «Побег»: тап — прыжок, свайп вниз или нижняя зона — присед. */
export default function RunnerGame({ config, appearance, running, onOver }: RunnerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const balance = config.minigames.runner
  // мир партии = реальный размер канваса, замеряем лениво на первом кадре
  const stateRef = useRef<RunnerState | null>(null)
  const viewRef = useRef<WorldView>({ dpr: 1, scale: 1, offsetX: 0, offsetY: 0 })
  const overRef = useRef(false)
  const onOverRef = useRef(onOver)
  onOverRef.current = onOver
  const pointerRef = useRef<{ y: number; ducking: boolean } | null>(null)

  const ensureState = (): RunnerState => {
    if (stateRef.current === null) stateRef.current = createRunner(balance, canvasWorldSize(canvasRef.current!))
    return stateRef.current
  }

  useGameLoop((dtMs) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const s = stepRunner(ensureState(), dtMs, balance, Math.random)
    stateRef.current = s
    draw(canvas, ctx, s)
    if (s.over && !overRef.current) {
      overRef.current = true
      const outcome: MinigameOutcome = { score: runnerScore(s), won: s.won }
      window.setTimeout(() => onOverRef.current(outcome), SETTLE_MS)
    }
  }, running)

  const draw = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, s: RunnerState) => {
    const view = fitWorld(canvas, s.world.w, s.world.h)
    viewRef.current = view
    applyWorld(ctx, canvas, view)
    const w = s.world.w
    const h = s.world.h
    const groundY = h - RUNNER_GROUND_H
    const petX = RUNNER_PET_X
    drawMinigameSky(ctx, w, h, groundY, performance.now())

    // препятствия: камни на земле, чайки в воздухе
    for (const o of s.obstacles) {
      if (o.kind === 'rock') {
        const y = groundY - o.h
        const grad = ctx.createLinearGradient(0, y, 0, groundY)
        grad.addColorStop(0, '#b9b2c9')
        grad.addColorStop(1, '#8d86a1')
        ctx.fillStyle = grad
        ctx.strokeStyle = '#5e5875'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(o.x + o.w * 0.1, groundY)
        ctx.lineTo(o.x + o.w * 0.28, y + 4)
        ctx.lineTo(o.x + o.w * 0.72, y)
        ctx.lineTo(o.x + o.w * 0.95, groundY)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      } else {
        const cy = groundY - RUNNER_HIT.gullBottom - o.h / 2
        ctx.strokeStyle = '#4a4661'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        const flap = Math.sin(performance.now() / 90) * 4
        ctx.beginPath()
        ctx.moveTo(o.x, cy)
        ctx.quadraticCurveTo(o.x + o.w * 0.4, cy - 8 - flap, o.x + o.w / 2, cy)
        ctx.quadraticCurveTo(o.x + o.w * 0.6, cy - 8 - flap, o.x + o.w, cy)
        ctx.stroke()
        ctx.fillStyle = '#4a4661'
        ctx.beginPath()
        ctx.arc(o.x + o.w / 2, cy, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // питомец
    const palette = PET_PALETTES[appearance.palette]
    const petR = 26
    drawMiniPet(ctx, palette, petX, groundY - s.py - petR * 0.92 * (s.ducking ? 0.58 : 1), petR, {
      squash: s.ducking ? 0.58 : 1,
      eyes: 'open',
      tilt: s.py > 0 ? -0.12 : Math.sin(performance.now() / 120) * 0.03,
    })

    drawScoreChip(ctx, `${runnerScore(s)} м`, 12, 12)
  }

  // клавиатура: пробел/вверх — прыжок, вниз (удержание) — присед
  useEffect(() => {
    if (!running) return
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        hapticTap()
        playSound('jump')
        stateRef.current = jumpRunner(ensureState(), balance)
      } else if (e.code === 'ArrowDown') {
        e.preventDefault()
        stateRef.current = duckRunner(ensureState(), true, balance)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown') stateRef.current = duckRunner(ensureState(), false, balance)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [running, balance])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!running) return
    const canvas = canvasRef.current
    if (!canvas) return
    const p = worldPoint(canvas, viewRef.current, e.clientX, e.clientY)
    pointerRef.current = { y: p.y, ducking: false }
    const world = stateRef.current?.world
    if (world && p.y > world.h * 0.74) {
      // тап по нижней зоне — сразу присед
      pointerRef.current.ducking = true
      stateRef.current = duckRunner(ensureState(), true, balance)
      return
    }
    hapticTap()
    playSound('jump')
    stateRef.current = jumpRunner(ensureState(), balance)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const held = pointerRef.current
    if (!held || held.ducking) return
    const canvas = canvasRef.current
    if (!canvas) return
    const p = worldPoint(canvas, viewRef.current, e.clientX, e.clientY)
    if (p.y - held.y > SWIPE_DOWN_PX) {
      held.ducking = true
      stateRef.current = duckRunner(ensureState(), true, balance)
    }
  }

  const onPointerUp = () => {
    if (pointerRef.current?.ducking) stateRef.current = duckRunner(ensureState(), false, balance)
    pointerRef.current = null
  }

  return (
    <canvas
      ref={canvasRef}
      className="mg-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label="Побег"
    />
  )
}
