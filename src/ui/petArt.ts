import type {
  ArmKind,
  BodyShape,
  EarKind,
  EyeKind,
  LegKind,
  NoseKind,
  PaletteKind,
  PetAppearance,
} from '../game/appearance'
import type { Mood, Stage } from '../game/types'
import type { DirtLevel } from './dirt'

/**
 * Отрисовка питомца: мягкие градиентные тела, светящийся характер.
 * Питомец — источник света сцены: его свечение зависит от настроения
 * (настроением управляет PetCanvas через gsap-твины PetVisualState).
 * Внешность («гены») приходит из game/appearance — здесь только рисование.
 */

export const SCENE_W = 390
export const SCENE_H = 420
export const GROUND_Y = 348

export interface PetPalette {
  bodyLight: string
  bodyMid: string
  bodyShade: string
  outline: string
  blush: string
}

/** Палитры тел: каждая — семья светлый/средний/тёмный + контур и румянец. */
export const PET_PALETTES: Record<PaletteKind, PetPalette> = {
  sunny: { bodyLight: '#ffe9a8', bodyMid: '#ffd76a', bodyShade: '#e8a63d', outline: '#8a5a1f', blush: '#ff9d8a' },
  mint: { bodyLight: '#d9f7e3', bodyMid: '#8fe0b0', bodyShade: '#4ba97a', outline: '#2f6b4c', blush: '#ff9d8a' },
  pink: { bodyLight: '#ffe3ee', bodyMid: '#ffb0ce', bodyShade: '#e87fa6', outline: '#a04d6e', blush: '#ff7d9c' },
  sky: { bodyLight: '#dff1ff', bodyMid: '#a3d7fa', bodyShade: '#5fa8e0', outline: '#35688f', blush: '#ff9d8a' },
  lavender: { bodyLight: '#eee6ff', bodyMid: '#c9b3f2', bodyShade: '#9a7fd4', outline: '#62509a', blush: '#ff9d8a' },
  peach: { bodyLight: '#ffead6', bodyMid: '#ffcda3', bodyShade: '#f0a46a', outline: '#9c5f2e', blush: '#ff8fae' },
  choco: { bodyLight: '#f5dcc3', bodyMid: '#d8a26e', bodyShade: '#a5703f', outline: '#6b4226', blush: '#ff8f7a' },
  night: { bodyLight: '#c7cede', bodyMid: '#97a1c4', bodyShade: '#646e96', outline: '#3a4166', blush: '#ff9d8a' },
  berry: { bodyLight: '#ffd9ec', bodyMid: '#f79cd0', bodyShade: '#c962a4', outline: '#8a3d6e', blush: '#ff6f9c' },
  kiwi: { bodyLight: '#eef9d0', bodyMid: '#cdee83', bodyShade: '#93c246', outline: '#5c7f2a', blush: '#ff9d8a' },
}

/**
 * Скорлупа одна на всех: яйцо не выдаёт палитру будущего питомца,
 * иначе цвет можно перебрасывать, удаляя сейв до вылупления.
 */
const EGG_PALETTE: PetPalette = {
  bodyLight: '#fffef7',
  bodyMid: '#f6efdc',
  bodyShade: '#e3d5b4',
  outline: '#96835f',
  blush: '#f3b8a0',
}

/** Цвета, общие для всех палитр: лицо, слюни, капли, росток. */
const INK = {
  iris: '#4a3728',
  pupil: '#2c2118',
  white: '#fffdf6',
  mouth: '#a34d33',
  tongue: '#ff8f7a',
  drop: '#8fd3ff',
  sprout: '#9ec97f',
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
  /** наклон к еде во время укуса (действие «покормить») */
  lean: number
  /** вихляние во время купания */
  wiggle: number
  /** 0..1 — насколько заметно рисовать грязь; твинится при изменении чистоты */
  dirtAlpha: number
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
    lean: 0,
    wiggle: 0,
    dirtAlpha: 0,
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

/** Форма тела — множители пропорций: шире/ниже, уже/выше, размер животика. */
const BODY_SHAPE_SCALE: Record<BodyShape, { rx: number; ry: number; belly: number }> = {
  round: { rx: 1, ry: 1, belly: 1 },
  pear: { rx: 1.12, ry: 0.94, belly: 1.3 },
  tall: { rx: 0.88, ry: 1.12, belly: 0.85 },
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

/** Зерно из «генов»: у одинаковых питомцев одинаковые пятнышки, кадр в кадр — без мерцания. */
function appearanceSeed(look: PetAppearance): number {
  const genes = look.body + look.ears + look.eyes + look.nose + look.arms + look.legs + look.palette
  let h = 2166136261
  for (let i = 0; i < genes.length; i++) {
    h ^= genes.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
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
  look: PetAppearance,
  v: PetVisualState,
  tMs: number,
  eggProgress: number,
  dirtLevel: DirtLevel = 0,
): void {
  const cx = SCENE_W / 2
  const bob = v.bob + v.jumpY
  const palette = PET_PALETTES[look.palette]

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
  ctx.rotate(v.tilt + v.lean + v.wiggle)
  ctx.scale(v.hatchPop, v.hatchPop * v.squash)
  if (stage === 'egg') {
    drawEgg(ctx, eggProgress, EGG_PALETTE)
  } else {
    drawCreature(ctx, stage === 'adult' ? ADULT : BABY, look, palette, mood, v.blink, tMs, dirtLevel, v.dirtAlpha)
  }
  ctx.restore()
}

function drawCreature(
  ctx: CanvasRenderingContext2D,
  d: Dims,
  look: PetAppearance,
  p: PetPalette,
  mood: Mood,
  blink: number,
  tMs: number,
  dirtLevel: DirtLevel,
  dirtAlpha: number,
): void {
  const shape = BODY_SHAPE_SCALE[look.body]
  const rx = d.rx * shape.rx
  const ry = d.ry * shape.ry
  const cy = -ry
  // черты лица и лапы расползаются вместе с шириной тела
  const faceScale = rx / d.rx

  drawEars(ctx, d, rx, ry, cy, look.ears, p)
  drawArms(ctx, d, rx, ry, cy, look.arms, p)
  // «носочки» — тёмные стопы — красятся при отрисовке ног
  drawLegs(ctx, d, faceScale, look.legs, p, look.spots === 'socks')

  // тело с вертикальным градиентом объёма
  const body = ctx.createLinearGradient(0, cy - ry, 0, cy + ry)
  body.addColorStop(0, p.bodyLight)
  body.addColorStop(0.5, p.bodyMid)
  body.addColorStop(1, p.bodyShade)
  ctx.beginPath()
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = p.outline
  ctx.lineWidth = 3
  ctx.stroke()

  // животик и блик
  ctx.fillStyle = 'rgba(255, 248, 235, 0.55)'
  ctx.beginPath()
  ctx.ellipse(0, cy + ry * 0.28, rx * 0.52 * shape.belly, ry * 0.38 * shape.belly, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.beginPath()
  ctx.ellipse(-rx * 0.34, cy - ry * 0.55, rx * 0.3, ry * 0.16, -0.4, 0, Math.PI * 2)
  ctx.fill()

  drawSpots(ctx, look, rx, ry, cy, p)
  drawDirt(ctx, look, rx, ry, cy, dirtLevel, dirtAlpha)

  // лицо
  const eyeDX = d.eyeDX * faceScale
  drawEye(ctx, -eyeDX, cy + d.eyeDY, d.eyeR, mood, blink, look.eyes, p)
  drawEye(ctx, eyeDX, cy + d.eyeDY, d.eyeR, mood, blink, look.eyes, p)
  ctx.fillStyle = p.blush
  ctx.globalAlpha = 0.5
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(side * d.blushDX * faceScale, cy + d.blushY, 8, 5, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  if (mood === 'sad') {
    // грустные брови домиком
    ctx.strokeStyle = p.outline
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(side * (eyeDX - d.eyeR), cy + d.eyeDY - d.eyeR - 6)
      ctx.lineTo(side * (eyeDX + d.eyeR * 0.4), cy + d.eyeDY - d.eyeR - 2)
      ctx.stroke()
    }
  }
  drawNose(ctx, cy + d.eyeDY + d.eyeR * 0.9, look.nose)
  drawMouth(ctx, cy + d.mouthY, mood, p)

  if (mood === 'sick') drawSweat(ctx, rx * 0.6, cy - ry * 0.85, tMs)
  drawFlies(ctx, cy, ry, dirtLevel, dirtAlpha, tMs)
}

/** Цвета грязи: бурые и зеленоватые пятна + тёмные мухи. */
const DIRT_INK = {
  smudge: '138, 107, 74',
  slime: '122, 138, 74',
  fly: '40, 34, 30',
} as const

/**
 * Пятна грязи на шкурке — чем ниже чистота, тем их больше (уровни 1..3).
 * Раскладка детерминирована «генами», пятна сидят на боках и низе тела,
 * не залезая на мордочку; плавно проявляются и смываются через dirtAlpha.
 */
function drawDirt(
  ctx: CanvasRenderingContext2D,
  look: PetAppearance,
  rx: number,
  ry: number,
  cy: number,
  level: DirtLevel,
  alpha: number,
): void {
  if (level === 0 || alpha <= 0.01) return
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.clip()
  const rand = mulberry32(appearanceSeed(look) ^ 0xd177)
  const count = level * 2
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const dx = side * (0.2 + rand() * 0.65) * rx
    const dy = cy + ry * (0.08 + rand() * 0.62)
    const r = (0.09 + rand() * 0.09) * rx
    ctx.fillStyle = `rgba(${i % 3 === 0 ? DIRT_INK.slime : DIRT_INK.smudge}, ${0.4 * alpha})`
    ctx.beginPath()
    ctx.ellipse(dx, dy, r, r * (0.65 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Мухи вьются над головой у грязнули (уровень 2 — одна, 3 — две). */
function drawFlies(
  ctx: CanvasRenderingContext2D,
  cy: number,
  ry: number,
  level: DirtLevel,
  alpha: number,
  tMs: number,
): void {
  if (level < 2 || alpha <= 0.01) return
  const count = level - 1
  for (let i = 0; i < count; i++) {
    const ph = i * 2.4
    const x = Math.sin(tMs / 900 + ph) * 22
    const y = cy - ry - 12 + Math.cos(tMs / 700 + ph * 1.6) * 8
    ctx.save()
    ctx.globalAlpha = alpha * 0.85
    ctx.fillStyle = DIRT_INK.fly
    ctx.beginPath()
    ctx.ellipse(x, y, 2.2, 1.6, 0.3, 0, Math.PI * 2)
    ctx.fill()
    // трепет крылышек — две светлые чёрточки
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.lineWidth = 1
    const flap = Math.sin(tMs / 40 + ph) * 2
    ctx.beginPath()
    ctx.moveTo(x - 1, y - 1)
    ctx.lineTo(x - 4, y - 3 - flap)
    ctx.moveTo(x + 1, y - 1)
    ctx.lineTo(x + 4, y - 3 + flap)
    ctx.stroke()
    ctx.restore()
  }
}

function drawEars(
  ctx: CanvasRenderingContext2D,
  d: Dims,
  rx: number,
  ry: number,
  cy: number,
  kind: EarKind,
  p: PetPalette,
): void {
  ctx.lineJoin = 'round'
  if (kind === 'tuft') {
    drawSprout(ctx, cy, ry, p)
    return
  }
  ctx.fillStyle = p.bodyMid
  ctx.strokeStyle = p.outline
  ctx.lineWidth = 2.5
  for (const side of [-1, 1]) {
    if (kind === 'round') {
      ctx.beginPath()
      ctx.arc(side * rx * 0.5, cy - ry + 10, d.earW * 1.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    } else if (kind === 'long') {
      ctx.save()
      ctx.translate(side * rx * 0.45, cy - ry + 8)
      ctx.rotate(side * 0.35)
      roundedRectPath(ctx, -d.earW / 2, -d.earLen * 1.4, d.earW, d.earLen * 1.4, d.earW / 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    } else {
      // droopy: висячие уши по бокам макушки
      ctx.save()
      ctx.translate(side * rx * 0.72, cy - ry * 0.55)
      ctx.rotate(side * 0.55)
      ctx.beginPath()
      ctx.ellipse(0, d.earLen * 0.45, d.earW * 0.8, d.earLen * 0.75, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
  }
}

/** Росток на макушке — «уши» варианта tuft. */
function drawSprout(ctx: CanvasRenderingContext2D, cy: number, ry: number, p: PetPalette): void {
  ctx.save()
  ctx.translate(0, cy - ry - 2)
  ctx.strokeStyle = p.outline
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(0, 6)
  ctx.quadraticCurveTo(1, 0, 0, -6)
  ctx.stroke()
  ctx.fillStyle = INK.sprout
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(side * 7, -8, 7, 4, side * 0.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Руки — за телом: видны кончики, выдающиеся по бокам. */
function drawArms(
  ctx: CanvasRenderingContext2D,
  d: Dims,
  rx: number,
  ry: number,
  cy: number,
  kind: ArmKind,
  p: PetPalette,
): void {
  if (kind === 'none') return
  if (kind === 'stub') {
    ctx.fillStyle = p.bodyShade
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(side * rx * 0.98, cy + ry * 0.15, 9, 6, side * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    ctx.fillStyle = p.bodyMid
    ctx.strokeStyle = p.outline
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.translate(side * rx * 0.88, cy + ry * 0.05)
      ctx.rotate(side * 0.5)
      const w = d.earW * 0.8
      const h = d.earLen * 1.1
      roundedRectPath(ctx, -w / 2, -h / 2, w, h, w / 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
  }
}

function drawLegs(
  ctx: CanvasRenderingContext2D,
  d: Dims,
  faceScale: number,
  kind: LegKind,
  p: PetPalette,
  dark: boolean,
): void {
  ctx.fillStyle = dark ? p.outline : p.bodyShade
  for (const side of [-1, 1]) {
    if (kind === 'round') {
      ctx.beginPath()
      ctx.ellipse(side * d.feetDX * faceScale, -6, 11, 7, 0, 0, Math.PI * 2)
      ctx.fill()
    } else if (kind === 'wide') {
      ctx.beginPath()
      ctx.ellipse(side * d.feetDX * 1.15 * faceScale, -5, 15, 6, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // tiny: маленькие круглые стопы
      ctx.beginPath()
      ctx.arc(side * d.feetDX * 0.95 * faceScale, -7, 7, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/**
 * Пятнышки на шкурке. Обрезаются по телу; раскладка крапинок
 * детерминирована «генами» питомца — не мерцает между кадрами.
 */
function drawSpots(
  ctx: CanvasRenderingContext2D,
  look: PetAppearance,
  rx: number,
  ry: number,
  cy: number,
  p: PetPalette,
): void {
  if (look.spots === 'none' || look.spots === 'socks') return
  ctx.save()
  // не вылезаем за контур тела
  ctx.beginPath()
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = p.bodyShade
  if (look.spots === 'patch') {
    // крупное пятно на спине + поменьше на боку
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.ellipse(rx * 0.3, cy - ry * 0.5, rx * 0.55, ry * 0.42, 0.35, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-rx * 0.5, cy + ry * 0.1, rx * 0.3, ry * 0.25, -0.3, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // dots: крапинки по бокам и макушке, не задевая лицо
    ctx.globalAlpha = 0.65
    const rand = mulberry32(appearanceSeed(look))
    const count = 4 + Math.floor(rand() * 3)
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const dx = side * (0.5 + rand() * 0.35) * rx
      const dy = cy - ry * (0.5 + rand() * 0.35)
      const r = 3 + rand() * 3.5
      ctx.beginPath()
      ctx.arc(dx, dy, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawNose(ctx: CanvasRenderingContext2D, y: number, kind: NoseKind): void {
  if (kind === 'none') return
  ctx.fillStyle = INK.pupil
  if (kind === 'oval') {
    ctx.beginPath()
    ctx.ellipse(0, y, 4.5, 6, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'triangle') {
    ctx.beginPath()
    ctx.moveTo(0, y + 5)
    ctx.lineTo(-5.5, y - 3)
    ctx.lineTo(5.5, y - 3)
    ctx.closePath()
    ctx.fill()
  } else {
    // dot
    ctx.beginPath()
    ctx.arc(0, y, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  mood: Mood,
  blink: number,
  kind: EyeKind,
  p: PetPalette,
): void {
  ctx.save()
  ctx.strokeStyle = p.outline
  ctx.lineCap = 'round'

  if (mood === 'sleeping') {
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y - 2, r * 0.8, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
    ctx.restore()
    return
  }
  if (mood === 'happy') {
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.arc(x, y + r * 0.7, r * 0.85, 1.15 * Math.PI, 1.85 * Math.PI)
    ctx.stroke()
    ctx.restore()
    return
  }

  const open = Math.max(0, 1 - blink)
  if (kind === 'beady') {
    // бусинки: без белка, просто тёмные точки
    if (open < 0.12) {
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x - r * 0.5, y)
      ctx.lineTo(x + r * 0.5, y)
      ctx.stroke()
    } else {
      ctx.fillStyle = INK.pupil
      ctx.beginPath()
      ctx.ellipse(x, y, r * 0.48, r * 0.48 * open, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = INK.white
      ctx.beginPath()
      ctx.arc(x - r * 0.15, y - r * 0.15 * open, r * 0.12, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    return
  }

  // big / wide: белок с радужкой; wide — больше белка и меньше зрачок
  const wide = kind === 'wide'
  const er = wide ? r * 1.22 : r
  const irisR = wide ? er * 0.55 : er * 0.72
  const pupilR = wide ? er * 0.26 : er * 0.34
  if (open < 0.12) {
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x - er * 0.8, y)
    ctx.lineTo(x + er * 0.8, y)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.ellipse(x, y, er, er * open, 0, 0, Math.PI * 2)
    ctx.fillStyle = INK.white
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.fillStyle = INK.iris
    ctx.beginPath()
    ctx.ellipse(x, y + er * 0.12, irisR, irisR * open, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = INK.pupil
    ctx.beginPath()
    ctx.ellipse(x, y + er * 0.15, pupilR, pupilR * open, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = INK.white
    ctx.beginPath()
    ctx.ellipse(x - er * 0.26, y - er * 0.28 * open, er * 0.2, er * 0.2 * open, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    if (mood === 'sick') {
      // полуприкрытое больное веко
      const lidBottom = y - er * 0.2
      ctx.fillStyle = p.bodyMid
      ctx.fillRect(x - er - 2, y - er - 2, (er + 2) * 2, lidBottom - (y - er - 2))
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(x - er, lidBottom)
      ctx.lineTo(x + er, lidBottom)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawMouth(ctx: CanvasRenderingContext2D, my: number, mood: Mood, p: PetPalette): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (mood === 'happy') {
    ctx.beginPath()
    ctx.arc(0, my - 6, 13, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.closePath()
    ctx.fillStyle = INK.mouth
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, my - 2, 7, Math.PI, 0)
    ctx.closePath()
    ctx.fillStyle = INK.tongue
    ctx.fill()
  } else if (mood === 'content') {
    ctx.strokeStyle = p.outline
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, my - 5, 11, 0.2 * Math.PI, 0.8 * Math.PI)
    ctx.stroke()
  } else if (mood === 'sad') {
    ctx.strokeStyle = p.outline
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, my + 8, 11, 1.2 * Math.PI, 1.8 * Math.PI)
    ctx.stroke()
  } else if (mood === 'sick') {
    ctx.strokeStyle = p.outline
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-11, my)
    ctx.quadraticCurveTo(-5, my - 6, 0, my - 1)
    ctx.quadraticCurveTo(5, my + 4, 11, my - 2)
    ctx.stroke()
  } else {
    // спит: маленькое «о»
    ctx.fillStyle = INK.mouth
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
  ctx.fillStyle = INK.drop
  ctx.beginPath()
  ctx.moveTo(x, y + dy - 9)
  ctx.quadraticCurveTo(x + 6, y + dy + 1, x, y + dy + 6)
  ctx.quadraticCurveTo(x - 6, y + dy + 1, x, y + dy - 9)
  ctx.fill()
  ctx.restore()
}

/** Яйцо окрашено палитрой будущего питомца — цвет виден ещё до вылупления. */
function drawEgg(ctx: CanvasRenderingContext2D, progress: number, p: PetPalette): void {
  const rx = 40
  const ry = 52
  const cy = -ry
  const grad = ctx.createLinearGradient(0, cy - ry, 0, cy + ry)
  grad.addColorStop(0, p.bodyLight)
  grad.addColorStop(1, p.bodyShade)
  ctx.beginPath()
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = p.outline
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.fillStyle = p.bodyShade
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
  ctx.strokeStyle = p.outline
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
