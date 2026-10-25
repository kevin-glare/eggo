import type { Mood, Stage } from '../game/types'

/**
 * Отрисовка питомца: мягкие градиентные тела, светящийся характер.
 * Питомец — источник света сцены: его свечение зависит от настроения
 * (настроением управляет PetCanvas через gsap-твины PetVisualState).
 */

export const SCENE_W = 390
export const SCENE_H = 420
export const GROUND_Y = 348

export const PET_COLORS = {
  bodyLight: '#ffe9a8',
  bodyMid: '#ffd76a',
  bodyShade: '#e8a63d',
  outline: '#8a5a1f',
  blush: '#ff9d8a',
  iris: '#4a3728',
  pupil: '#2c2118',
  white: '#fffdf6',
  mouth: '#a34d33',
  tongue: '#ff8f7a',
  drop: '#8fd3ff',
  sprout: '#9ec97f',
  eggTop: '#fff3cf',
  eggBottom: '#eab54b',
  speckle: '#dda23e',
  crack: '#7a5222',
} as const

/** Анимируемые параметры существа — их твинит GSAP, читает рендер-цикл. */
export interface PetVisualState {
  squash: number
  bob: number
  jumpY: number
  blink: number
  glowMul: number
  glowAlpha: number
  glowRGB: { r: number; g: number; b: number }
  tilt: number
  hatchPop: number
}

export function createVisualState(): PetVisualState {
  return {
    squash: 1,
    bob: 0,
    jumpY: 0,
    blink: 0,
    glowMul: 1,
    glowAlpha: 0.36,
    glowRGB: { r: 255, g: 214, b: 120 },
    tilt: 0,
    hatchPop: 1,
  }
}

interface Dims {
  rx: number
  ry: number
  eyeR: number
  eyeDX: number
  eyeDY: number
  mouthY: number
  blushDX: number
  blushY: number
  earLen: number
  earW: number
  feetDX: number
}

const BABY: Dims = {
  rx: 50, ry: 46, eyeR: 10.5, eyeDX: 19, eyeDY: -14, mouthY: 16,
  blushDX: 29, blushY: 8, earLen: 12, earW: 7, feetDX: 17,
}

const ADULT: Dims = {
  rx: 61, ry: 55, eyeR: 11.5, eyeDX: 24, eyeDY: -16, mouthY: 20,
  blushDX: 35, blushY: 11, earLen: 26, earW: 10, feetDX: 22,
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// крапинки яйца: детерминированные, чтобы не мерцали между кадрами
const EGG_SPECKLES: { dx: number; dy: number; r: number }[] = (() => {
  const rand = mulberry32(42)
  return Array.from({ length: 14 }, () => {
    const ang = rand() * Math.PI * 2
    const rad = Math.sqrt(rand()) * 0.8
    return { dx: Math.cos(ang) * rad * 34, dy: Math.sin(ang) * rad * 44, r: 1.6 + rand() * 1.8 }
  })
})()

export function drawPet(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  mood: Mood,
  v: PetVisualState,
  tMs: number,
  eggProgress: number,
): void {
  const cx = SCENE_W / 2
  const bob = v.bob + v.jumpY

  // тень на земле: в прыжке уменьшается
  const shadowScale = Math.max(0.45, 1 + v.jumpY / 120)
  ctx.save()
  ctx.fillStyle = 'rgba(12, 6, 24, 0.45)'
  ctx.beginPath()
  ctx.ellipse(cx, GROUND_Y + 6, 48 * shadowScale * v.hatchPop, 9 * shadowScale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // свечение вокруг питомца — цвет и сила анимируются под настроение
  const { r: cr, g: cg, b: cb } = v.glowRGB
  const glowR = 140 * v.glowMul
  const gy = GROUND_Y + bob - (stage === 'egg' ? 52 : 62)
  ctx.save()
  const glow = ctx.createRadialGradient(cx, gy, 0, cx, gy, glowR)
  glow.addColorStop(0, `rgba(${cr | 0}, ${cg | 0}, ${cb | 0}, ${v.glowAlpha})`)
  glow.addColorStop(1, `rgba(${cr | 0}, ${cg | 0}, ${cb | 0}, 0)`)
  ctx.fillStyle = glow
  ctx.fillRect(cx - glowR, gy - glowR, glowR * 2, glowR * 2)
  ctx.restore()

  ctx.save()
  ctx.translate(cx, GROUND_Y + bob)
  ctx.rotate(v.tilt)
  ctx.scale(v.hatchPop, v.hatchPop * v.squash)
  if (stage === 'egg') {
    drawEgg(ctx, eggProgress)
  } else {
    drawCreature(ctx, stage === 'adult' ? ADULT : BABY, mood, v.blink, tMs)
  }
  ctx.restore()
}

function drawCreature(ctx: CanvasRenderingContext2D, d: Dims, mood: Mood, blink: number, tMs: number): void {
  const cy = -d.ry
  const isAdult = d === ADULT

  // уши — за телом
  ctx.lineJoin = 'round'
  if (isAdult) {
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.translate(side * d.rx * 0.45, cy - d.ry + 8)
      ctx.rotate(side * 0.35)
      roundedRectPath(ctx, -d.earW / 2, -d.earLen, d.earW, d.earLen, d.earW / 2)
      ctx.fillStyle = PET_COLORS.bodyMid
      ctx.strokeStyle = PET_COLORS.outline
      ctx.lineWidth = 2.5
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
    // росток на макушке
    ctx.save()
    ctx.translate(0, cy - d.ry - 2)
    ctx.strokeStyle = PET_COLORS.outline
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(0, 6)
    ctx.quadraticCurveTo(1, 0, 0, -6)
    ctx.stroke()
    ctx.fillStyle = PET_COLORS.sprout
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(side * 7, -8, 7, 4, side * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  } else {
    ctx.fillStyle = PET_COLORS.bodyMid
    ctx.strokeStyle = PET_COLORS.outline
    ctx.lineWidth = 2.5
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(side * d.rx * 0.5, cy - d.ry + 10, d.earW, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  // лапки
  ctx.fillStyle = PET_COLORS.bodyShade
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(side * d.feetDX, -6, 11, 7, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // тело с вертикальным градиентом объёма
  const body = ctx.createLinearGradient(0, cy - d.ry, 0, cy + d.ry)
  body.addColorStop(0, PET_COLORS.bodyLight)
  body.addColorStop(0.5, PET_COLORS.bodyMid)
  body.addColorStop(1, PET_COLORS.bodyShade)
  ctx.beginPath()
  ctx.ellipse(0, cy, d.rx, d.ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = PET_COLORS.outline
  ctx.lineWidth = 3
  ctx.stroke()

  // животик и блик
  ctx.fillStyle = 'rgba(255, 240, 200, 0.55)'
  ctx.beginPath()
  ctx.ellipse(0, cy + d.ry * 0.28, d.rx * 0.52, d.ry * 0.38, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.beginPath()
  ctx.ellipse(-d.rx * 0.34, cy - d.ry * 0.55, d.rx * 0.3, d.ry * 0.16, -0.4, 0, Math.PI * 2)
  ctx.fill()

  // лицо
  drawEye(ctx, -d.eyeDX, cy + d.eyeDY, d.eyeR, mood, blink)
  drawEye(ctx, d.eyeDX, cy + d.eyeDY, d.eyeR, mood, blink)
  ctx.fillStyle = 'rgba(255, 157, 138, 0.5)'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(side * d.blushDX, cy + d.blushY, 8, 5, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  if (mood === 'sad') {
    // грустные брови домиком
    ctx.strokeStyle = PET_COLORS.outline
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(side * (d.eyeDX - d.eyeR), cy + d.eyeDY - d.eyeR - 6)
      ctx.lineTo(side * (d.eyeDX + d.eyeR * 0.4), cy + d.eyeDY - d.eyeR - 2)
      ctx.stroke()
    }
  }
  drawMouth(ctx, cy + d.mouthY, mood)

  if (mood === 'sick') drawSweat(ctx, d.rx * 0.6, cy - d.ry * 0.85, tMs)
}

function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, mood: Mood, blink: number): void {
  ctx.save()
  ctx.strokeStyle = PET_COLORS.outline
  ctx.lineCap = 'round'

  if (mood === 'sleeping') {
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y - 2, r * 0.8, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
  } else if (mood === 'happy') {
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.arc(x, y + r * 0.7, r * 0.85, 1.15 * Math.PI, 1.85 * Math.PI)
    ctx.stroke()
  } else {
    const open = Math.max(0, 1 - blink)
    if (open < 0.12) {
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x - r * 0.8, y)
      ctx.lineTo(x + r * 0.8, y)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * open, 0, 0, Math.PI * 2)
      ctx.fillStyle = PET_COLORS.white
      ctx.fill()
      ctx.save()
      ctx.clip()
      ctx.fillStyle = PET_COLORS.iris
      ctx.beginPath()
      ctx.ellipse(x, y + r * 0.12, r * 0.72, r * 0.72 * open, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = PET_COLORS.pupil
      ctx.beginPath()
      ctx.ellipse(x, y + r * 0.15, r * 0.34, r * 0.34 * open, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = PET_COLORS.white
      ctx.beginPath()
      ctx.ellipse(x - r * 0.26, y - r * 0.28 * open, r * 0.2, r * 0.2 * open, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      if (mood === 'sick') {
        // полуприкрытое больное веко
        const lidBottom = y - r * 0.2
        ctx.fillStyle = PET_COLORS.bodyMid
        ctx.fillRect(x - r - 2, y - r - 2, (r + 2) * 2, lidBottom - (y - r - 2))
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(x - r, lidBottom)
        ctx.lineTo(x + r, lidBottom)
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

function drawMouth(ctx: CanvasRenderingContext2D, my: number, mood: Mood): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (mood === 'happy') {
    ctx.beginPath()
    ctx.arc(0, my - 6, 13, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.closePath()
    ctx.fillStyle = PET_COLORS.mouth
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, my - 2, 7, Math.PI, 0)
    ctx.closePath()
    ctx.fillStyle = PET_COLORS.tongue
    ctx.fill()
  } else if (mood === 'content') {
    ctx.strokeStyle = PET_COLORS.outline
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, my - 5, 11, 0.2 * Math.PI, 0.8 * Math.PI)
    ctx.stroke()
  } else if (mood === 'sad') {
    ctx.strokeStyle = PET_COLORS.outline
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, my + 8, 11, 1.2 * Math.PI, 1.8 * Math.PI)
    ctx.stroke()
  } else if (mood === 'sick') {
    ctx.strokeStyle = PET_COLORS.outline
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-11, my)
    ctx.quadraticCurveTo(-5, my - 6, 0, my - 1)
    ctx.quadraticCurveTo(5, my + 4, 11, my - 2)
    ctx.stroke()
  } else {
    // спит: маленькое «о»
    ctx.fillStyle = PET_COLORS.mouth
    ctx.beginPath()
    ctx.ellipse(0, my + 3, 4, 5, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawSweat(ctx: CanvasRenderingContext2D, x: number, y: number, tMs: number): void {
  const phase = (tMs / 1400) % 1
  const dy = phase * 26
  const alpha = 0.9 * (1 - phase)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = PET_COLORS.drop
  ctx.beginPath()
  ctx.moveTo(x, y + dy - 9)
  ctx.quadraticCurveTo(x + 6, y + dy + 1, x, y + dy + 6)
  ctx.quadraticCurveTo(x - 6, y + dy + 1, x, y + dy - 9)
  ctx.fill()
  ctx.restore()
}

function drawEgg(ctx: CanvasRenderingContext2D, progress: number): void {
  const rx = 40
  const ry = 52
  const cy = -ry
  const grad = ctx.createLinearGradient(0, cy - ry, 0, cy + ry)
  grad.addColorStop(0, PET_COLORS.eggTop)
  grad.addColorStop(1, PET_COLORS.eggBottom)
  ctx.beginPath()
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = PET_COLORS.outline
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.fillStyle = PET_COLORS.speckle
  ctx.globalAlpha = 0.55
  for (const s of EGG_SPECKLES) {
    ctx.beginPath()
    ctx.arc(s.dx, cy + s.dy, s.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // трещины проявляются по мере приближения вылупления
  const a1 = Math.min(1, Math.max(0, (progress - 0.35) / 0.4))
  const a2 = Math.min(1, Math.max(0, (progress - 0.7) / 0.3))
  ctx.strokeStyle = PET_COLORS.crack
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (a1 > 0) {
    ctx.globalAlpha = a1
    ctx.beginPath()
    ctx.moveTo(12, cy - 16)
    ctx.lineTo(4, cy - 6)
    ctx.lineTo(12, cy + 4)
    ctx.lineTo(6, cy + 12)
    ctx.stroke()
  }
  if (a2 > 0) {
    ctx.globalAlpha = a2
    ctx.beginPath()
    ctx.moveTo(-16, cy - 26)
    ctx.lineTo(-6, cy - 16)
    ctx.lineTo(-18, cy - 4)
    ctx.lineTo(-8, cy + 6)
    ctx.lineTo(-14, cy + 18)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
