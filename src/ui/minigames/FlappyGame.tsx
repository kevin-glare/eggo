import { useEffect, useRef } from 'react'
import type { PetAppearance } from '../../game/appearance'
import type { GameConfig } from '../../game/config'
import { createFlappy, FLAPPY_PET_R, flap, flappyPetX, stepFlappy, type FlappyState } from '../../game/minigames/flappy'
import { canvasWorldSize } from './canvasWorld'
import type { MinigameOutcome } from '../../game/minigames/types'
import { hapticTap } from '../../telegram'
import { getStrings } from '../i18n'
import { playSound } from '../sound'
import { PET_PALETTES } from '../petArt'
import { applyWorld, drawMinigameSky, drawPill, drawScoreChip, fitWorld, type WorldView } from './canvasWorld'
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
  // подсказка тает после первого взмаха или через 3.5 с
  const hintRef = useRef({ at: 0, alpha: 0, used: false })

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
    const h = hintRef.current
    if (h.at === 0) h.at = performance.now()
    const k = Math.min(1, dtMs / 250)
    h.alpha += ((h.used || performance.now() - h.at > 3500 ? 0 : 1) - h.alpha) * k
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

    // колонны: конфетно-зелёные столбы со шляпками и светлым бликом (в масштабе мира)
    const pw = balance.pipeW * s.scale
    const cap = 6 * s.scale
    const gapHalf = (balance.pipeGap * s.scale) / 2
    for (const p of s.pipes) {
      const topH = p.gapY - gapHalf
      const bottomY = p.gapY + gapHalf
      const grad = ctx.createLinearGradient(p.x, 0, p.x + pw, 0)
      grad.addColorStop(0, '#7cc35b')
      grad.addColorStop(0.35, '#a5dd80')
      grad.addColorStop(1, '#5ea84a')
      ctx.fillStyle = grad
      ctx.strokeStyle = '#3f7d34'
      ctx.lineWidth = 2.5
      // стволы
      ctx.fillRect(p.x, 0, pw, Math.max(0, topH - 14 * s.scale))
      ctx.strokeRect(p.x, -2, pw, Math.max(0, topH - 12 * s.scale))
      ctx.fillRect(p.x, bottomY + 14 * s.scale, pw, h - bottomY - 14 * s.scale)
      ctx.strokeRect(p.x, bottomY + 12 * s.scale, pw, h - bottomY - 10 * s.scale)
      // шляпки чуть шире ствола — игрушечные трубы
      ctx.fillRect(p.x - cap, topH - 16 * s.scale, pw + cap * 2, 16 * s.scale)
      ctx.strokeRect(p.x - cap, topH - 16 * s.scale, pw + cap * 2, 16 * s.scale)
      ctx.fillRect(p.x - cap, bottomY, pw + cap * 2, 16 * s.scale)
      ctx.strokeRect(p.x - cap, bottomY, pw + cap * 2, 16 * s.scale)
      // вертикальный блик
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
      ctx.fillRect(p.x + 7 * s.scale, 0, 6 * s.scale, Math.max(0, topH - 16 * s.scale))
      ctx.fillRect(p.x + 7 * s.scale, bottomY + 16 * s.scale, 6 * s.scale, h - bottomY - 16 * s.scale)
    }

    // питомец парит: наклон по вертикальной скорости
    const palette = PET_PALETTES[appearance.palette]
    const tilt = Math.max(-0.35, Math.min(0.6, s.vy / (500 * s.scale)))
    drawMiniPet(ctx, palette, flappyPetX(s.world), s.y, FLAPPY_PET_R * s.scale + 4, {
      eyes: 'open',
      tilt,
      mouthOpen: 0.4,
    })

    drawPill(ctx, getStrings().mgHint.flappy, w / 2, 70, hintRef.current.alpha)
    drawScoreChip(ctx, String(s.score), 12, 12)
  }

  const doFlap = () => {
    if (!running) return
    hapticTap()
    playSound('flap')
    hintRef.current.used = true
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
