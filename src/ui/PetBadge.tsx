import { useEffect, useRef } from 'react'
import type { PetAppearance } from '../game/appearance'
import type { Mood, Stage } from '../game/types'
import { createVisualState, drawPet, GROUND_Y, petBodyHeight, SCENE_W } from './petArt'

interface PetBadgeProps {
  stage: Stage
  mood: Mood
  appearance: PetAppearance
  /** надетые аксессуары (id из config.shop.items, по одному на слот) */
  accessories?: string[]
  className?: string
}

/**
 * Мини-арт питомца: один статичный кадр движка petArt. Профиль в меню,
 * итоговые экраны мини-игр — везде один и тот же рисунок.
 */
export default function PetBadge({ stage, mood, appearance, accessories = [], className }: PetBadgeProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const s = 0.42
    ctx.setTransform(2, 0, 0, 2, 0, 0)
    ctx.clearRect(0, 0, 120, 110)
    // питомец — по центру бейджа по высоте; +6 — запас на уши и шапки сверху
    const baseY = (110 + petBodyHeight(stage, appearance.body) * s + 6) / 2 - 1
    ctx.translate(60 - (SCENE_W / 2) * s, baseY - (GROUND_Y + 6) * s)
    ctx.scale(s, s)
    drawPet(ctx, stage, mood, appearance, createVisualState(), 0, 0, 0, accessories)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }, [appearance, stage, mood, accessories])
  return <canvas ref={ref} className={className} width={240} height={220} aria-hidden="true" />
}
