import { useEffect, useRef } from 'react'
import type { PetAppearance } from '../../game/appearance'
import type { GameConfig } from '../../game/config'
import { createFlappy, FLAPPY_PET_R, flap, flappyPetX, stepFlappy, type FlappyState } from '../../game/minigames/flappy'
import { canvasWorldSize } from './canvasWorld'
import type { MinigameOutcome } from '../../game/minigames/types'
import { hapticTap } from '../../telegram'
import { playSound } from '../sound'
import { PET_PALETTES } from '../petArt'
import { applyWorld, drawMinigameSky, drawScoreChip, fitWorld, type WorldView } from './canvasWorld'
import { drawMiniPet } from './miniPet'
import { useGameLoop } from './useGameLoop'

interface FlappyGameProps {
  config: GameConfig
  appearance: PetAppearance
  running: boolean
  onOver: (outcome: MinigameOutcome) => void
}

const SETTLE_MS = 700

/** «Полёт»: любой тап или пробел — взмах; пролетай зазоры между колоннами. */
export default function FlappyGame({ config, appearance, running, onOver }: FlappyGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const balance = config.minigames.flappy
  // мир партии = реальный размер канваса, замеряем лениво на первом кадре
  const stateRef = useRef<FlappyState | null>(null)
  const viewRef = useRef<WorldView>({ dpr: 1, scale: 1, offsetX: 0, offsetY: 0 })
  const overRef = useRef(false)
  const onOverRef = useRef(onOver)
  onOverRef.current = onOver

  const ensureState = (): FlappyState => {
    if (stateRef.current === null) stateRef.current = createFlappy(balance, canvasWorldSize(canvasRef.current!))
    return stateRef.current
  }

  useGameLoop((dtMs) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const s = stepFlappy(ensureState(), dtMs, balance, Math.random)
    stateRef.current = s
    draw(canvas, ctx, s)
    if (s.over && !overRef.current) {
      overRef.current = true
      const outcome: MinigameOutcome = { score: s.score, won: s.won }
      window.setTimeout(() => onOverRef.current(outcome), SETTLE_MS)
    }
  }, running)

  const draw = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, s: FlappyState) => {
    const view = fitWorld(canvas, s.world.w, s.world.h)
    viewRef.current = view
    applyWorld(ctx, canvas, view)
    const w = s.world.w
    const h = s.world.h
    drawMinigameSky(ctx, w, h, h - 34, performance.now())

    // колонны: конфетно-зелёные столбы со шляпками и светлым бликом
    const gapHalf = balance.pipeGap / 2
    for (const p of s.pipes) {
      const topH = p.gapY - gapHalf
      const bottomY = p.gapY + gapHalf
      const grad = ctx.createLinearGradient(p.x, 0, p.x + balance.pipeW, 0)
      grad.addColorStop(0, '#7cc35b')
      grad.addColorStop(0.35, '#a5dd80')
      grad.addColorStop(1, '#5ea84a')
      ctx.fillStyle = grad
      ctx.strokeStyle = '#3f7d34'
      ctx.lineWidth = 2.5
      // стволы
      ctx.fillRect(p.x, 0, balance.pipeW, Math.max(0, topH - 14))
      ctx.strokeRect(p.x, -2, balance.pipeW, Math.max(0, topH - 12))
      ctx.fillRect(p.x, bottomY + 14, balance.pipeW, h - bottomY - 14)
      ctx.strokeRect(p.x, bottomY + 12, balance.pipeW, h - bottomY - 10)
      // шляпки чуть шире ствола — игрушечные трубы
      ctx.fillRect(p.x - 5, topH - 16, balance.pipeW + 10, 16)
      ctx.strokeRect(p.x - 5, topH - 16, balance.pipeW + 10, 16)
      ctx.fillRect(p.x - 5, bottomY, balance.pipeW + 10, 16)
      ctx.strokeRect(p.x - 5, bottomY, balance.pipeW + 10, 16)
      // вертикальный блик
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
      ctx.fillRect(p.x + 7, 0, 6, Math.max(0, topH - 16))
      ctx.fillRect(p.x + 7, bottomY + 16, 6, h - bottomY - 16)
    }

    // питомец парит: наклон по вертикальной скорости
    const palette = PET_PALETTES[appearance.palette]
    const tilt = Math.max(-0.35, Math.min(0.6, s.vy / 500))
    drawMiniPet(ctx, palette, flappyPetX(s.world), s.y, FLAPPY_PET_R + 4, {
      eyes: 'open',
      tilt,
      mouthOpen: 0.4,
    })

    drawScoreChip(ctx, String(s.score), 12, 12)
  }

  const doFlap = () => {
    if (!running) return
    hapticTap()
    playSound('flap')
    stateRef.current = flap(ensureState(), balance)
  }

  useEffect(() => {
    if (!running) return
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        doFlap()
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, balance])

  return (
    <canvas
      ref={canvasRef}
      className="mg-canvas"
      onPointerDown={(e) => {
        e.preventDefault()
        doFlap()
      }}
      aria-label="Полёт"
    />
  )
}
