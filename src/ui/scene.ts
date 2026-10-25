import type { DayPalette, RGB } from './dayCycle'

/**
 * Сцена-«окно»: небо, светила, облака, холмы, светлячки.
 * Палитра времени суток приходит из dayCycle, настроение питомца
 * (energy/warm) мягко вмешивается: звёзды и светлячки живут ярче,
 * когда питомцу хорошо.
 */

export interface SceneMood {
  energy: number
  warm: number
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

const rand = mulberry32(20261025)

const STARS = Array.from({ length: 34 }, () => ({
  x: rand(),
  y: rand() * 0.55,
  r: 0.6 + rand() * 1.3,
  ph: rand() * Math.PI * 2,
  sp: 0.5 + rand(),
}))

const FIREFLIES = Array.from({ length: 9 }, () => ({
  x0: rand(),
  y0: 0.45 + rand() * 0.4,
  ax: 20 + rand() * 40,
  ay: 8 + rand() * 14,
  ph: rand() * Math.PI * 2,
  sp: 0.2 + rand() * 0.3,
}))

const CLOUD_SPRITE_COUNT = 4

/**
 * Кучевое облако собирается из «пуфов» — мягких радиальных пятен:
 * крупные вдоль основания, поменьше горкой сверху (каулифлауэр).
 * Потом вся форма притеняется вертикальным градиентом: яркая макушка,
 * сероватое плоское основание. Спрайт белый — цвет ему даёт тонировка
 * палитрой времени суток прямо при отрисовке.
 */
function buildCloudSprite(seed: number): HTMLCanvasElement {
  const W = 240
  const H = 120
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) return c
  const rnd = mulberry32(seed)

  const puffs: { x: number; y: number; r: number }[] = []
  const baseY = H * 0.74
  const count = 4 + Math.floor(rnd() * 3)
  for (let i = 0; i < count; i++) {
    const r = H * (0.2 + rnd() * 0.14)
    const x = W * 0.16 + (W * 0.68 * i) / (count - 1) + (rnd() - 0.5) * W * 0.08
    puffs.push({ x, y: baseY - r * 0.55 - rnd() * H * 0.05, r })
  }
  // бугры на макушке опираются на средние пуфы
  const bumps = 2 + Math.floor(rnd() * 3)
  for (let i = 0; i < bumps; i++) {
    const anchor = puffs[1 + Math.floor(rnd() * (count - 2))]!
    const r = anchor.r * (0.5 + rnd() * 0.35)
    puffs.push({ x: anchor.x + (rnd() - 0.5) * anchor.r * 1.7, y: anchor.y - anchor.r * 0.8 - r * 0.2, r })
  }

  for (const p of puffs) {
    const grad = g.createRadialGradient(p.x, p.y - p.r * 0.15, p.r * 0.1, p.x, p.y, p.r)
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.55)')
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    g.fillStyle = grad
    g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
  }

  // объём: макушка подсвечена, основание притенено (только по форме облака)
  g.globalCompositeOperation = 'source-atop'
  const shade = g.createLinearGradient(0, H * 0.25, 0, H)
  shade.addColorStop(0, 'rgba(210, 218, 232, 0)')
  shade.addColorStop(0.6, 'rgba(198, 207, 224, 0.4)')
  shade.addColorStop(1, 'rgba(164, 175, 197, 0.65)')
  g.fillStyle = shade
  g.fillRect(0, 0, W, H)
  const light = g.createLinearGradient(0, 0, 0, H * 0.55)
  light.addColorStop(0, 'rgba(255, 255, 255, 0.45)')
  light.addColorStop(1, 'rgba(255, 255, 255, 0)')
  g.fillStyle = light
  g.fillRect(0, 0, W, H * 0.55)
  g.globalCompositeOperation = 'source-over'
  return c
}

const cloudSprites: HTMLCanvasElement[] = Array.from({ length: CLOUD_SPRITE_COUNT }, (_, i) =>
  buildCloudSprite(9001 + i * 137),
)

/** Общий буфер тонировки: multiply-цвет, затем форма вырезается обратно по альфе. */
let cloudTintCanvas: HTMLCanvasElement | null = null

function drawTintedCloud(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha: number,
  color: RGB,
): void {
  if (!cloudTintCanvas) cloudTintCanvas = document.createElement('canvas')
  const tint = cloudTintCanvas
  if (tint.width !== sprite.width || tint.height !== sprite.height) {
    tint.width = sprite.width
    tint.height = sprite.height
  }
  const g = tint.getContext('2d')
  if (!g) return
  g.globalCompositeOperation = 'source-over'
  g.clearRect(0, 0, tint.width, tint.height)
  g.drawImage(sprite, 0, 0)
  g.globalCompositeOperation = 'multiply'
  g.fillStyle = `rgb(${color[0] | 0}, ${color[1] | 0}, ${color[2] | 0})`
  g.fillRect(0, 0, tint.width, tint.height)
  g.globalCompositeOperation = 'destination-in'
  g.drawImage(sprite, 0, 0)
  g.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = alpha
  ctx.drawImage(tint, x, y, w, h)
  ctx.globalAlpha = 1
}

const CLOUDS = Array.from({ length: 6 }, (_, i) => {
  // два плана: дальние — выше, меньше и медленнее, ближние — крупные
  const far = i % 2 === 0
  return {
    x0: rand(),
    y: far ? 0.08 + rand() * 0.1 : 0.18 + rand() * 0.18,
    scale: far ? 0.55 + rand() * 0.25 : 0.95 + rand() * 0.45,
    speed: far ? 0.003 + rand() * 0.003 : 0.006 + rand() * 0.005,
    sprite: i % CLOUD_SPRITE_COUNT,
    alpha: far ? 0.5 : 0.85,
  }
})

/** Луна живёт на своей орбите независимо от солнца. */
const MOON_POS: readonly [number, number] = [0.74, 0.16]

/**
 * Кэш серпа луны: диск с кратерами, «укус» вырезан прозрачностью
 * (destination-out), поэтому сквозь него видно настоящее небо
 * с гало и звёздами — без закрашенного круга.
 */
let moonSprite: HTMLCanvasElement | null = null
function getMoonSprite(): HTMLCanvasElement {
  if (moonSprite) return moonSprite
  const c = document.createElement('canvas')
  c.width = 120
  c.height = 120
  const m = c.getContext('2d')
  if (m) {
    m.fillStyle = 'rgb(247, 237, 216)'
    m.beginPath()
    m.arc(60, 60, 52, 0, Math.PI * 2)
    m.fill()
    m.fillStyle = 'rgba(200, 186, 168, 0.35)'
    m.beginPath()
    m.arc(44, 68, 8, 0, Math.PI * 2)
    m.arc(52, 84, 5, 0, Math.PI * 2)
    m.fill()
    m.globalCompositeOperation = 'destination-out'
    m.beginPath()
    m.arc(80, 50, 44, 0, Math.PI * 2)
    m.fill()
  }
  moonSprite = c
  return c
}

function rgba(c: RGB, alpha: number): string {
  return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${Math.max(0, Math.min(1, alpha))})`
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mood: SceneMood,
  tMs: number,
  sky: DayPalette,
): void {
  // небо
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h)
  skyGrad.addColorStop(0, rgba(sky.skyTop, 1))
  skyGrad.addColorStop(0.55, rgba(sky.skyMid, 1))
  skyGrad.addColorStop(1, rgba(sky.skyBot, 1))
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, w, h)

  // тёплая полоса у горизонта — время суток + настроение питомца
  const warmA = Math.max(sky.warm, mood.warm * 0.15)
  const warmGrad = ctx.createLinearGradient(0, h * 0.5, 0, h)
  warmGrad.addColorStop(0, 'rgba(255, 166, 87, 0)')
  warmGrad.addColorStop(1, `rgba(255, 166, 87, ${0.35 * warmA})`)
  ctx.fillStyle = warmGrad
  ctx.fillRect(0, h * 0.5, w, h * 0.5)

  // звёзды — за светилами, чтобы не рисовались поверх луны и солнца
  const starBase = sky.star * (0.4 + 0.6 * mood.energy)
  if (starBase > 0.02) {
    for (const s of STARS) {
      const a = starBase * (0.5 + 0.5 * Math.sin((tMs / 1000) * s.sp + s.ph))
      ctx.fillStyle = `rgba(245, 237, 255, ${a})`
      ctx.beginPath()
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // солнце и луна живут по собственным расписаниям из dayCycle
  const sunA = sky.sun
  const moonA = sky.moon
  if (sunA > 0.01) {
    const sx = sky.sunPos[0] * w
    const sy = sky.sunPos[1] * h
    const sr = sky.orbR
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3)
    halo.addColorStop(0, rgba(sky.sunColor, 0.3 * sunA))
    halo.addColorStop(1, rgba(sky.sunColor, 0))
    ctx.fillStyle = halo
    ctx.fillRect(sx - sr * 3, sy - sr * 3, sr * 6, sr * 6)
    ctx.fillStyle = rgba(sky.sunColor, sunA)
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fill()
  }
  if (moonA > 0.01) {
    const mx = MOON_POS[0] * w
    const my = MOON_POS[1] * h
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 95)
    halo.addColorStop(0, `rgba(247, 237, 216, ${(0.06 + 0.07 * mood.energy) * moonA})`)
    halo.addColorStop(1, 'rgba(247, 237, 216, 0)')
    ctx.fillStyle = halo
    ctx.fillRect(mx - 95, my - 95, 190, 190)
    // серп-спрайт с прозрачным «укусом»: сквозь него видно настоящее
    // небо с гало и звёздами, а не закрашенный круг
    const sprite = getMoonSprite()
    ctx.globalAlpha = 0.9 * moonA
    ctx.drawImage(sprite, mx - 30, my - 30, 60, 60)
    ctx.globalAlpha = 1
  }

  // облака дрейфуют по небу — спрайты кучевые, тонированные временем суток
  if (sky.cloud > 0.02) {
    for (const c of CLOUDS) {
      const sprite = cloudSprites[c.sprite]!
      const cw = sprite.width * c.scale
      const ch = sprite.height * c.scale
      const cx = (((c.x0 + (tMs / 1000) * c.speed) % 1.3) - 0.15) * w
      drawTintedCloud(ctx, sprite, cx - cw / 2, c.y * h - ch / 2, cw, ch, 0.9 * c.alpha * sky.cloud, sky.cloudColor)
    }
  }

  // дальние и ближние холмы
  ctx.fillStyle = rgba(sky.hillBack, 1)
  ctx.beginPath()
  ctx.moveTo(0, h * 0.62)
  ctx.bezierCurveTo(w * 0.3, h * 0.52, w * 0.7, h * 0.58, w, h * 0.55)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = rgba(sky.hillFront, 1)
  ctx.beginPath()
  ctx.moveTo(0, h * 0.78)
  ctx.bezierCurveTo(w * 0.25, h * 0.7, w * 0.6, h * 0.82, w, h * 0.74)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()

  // светящаяся кромка ближнего холма
  ctx.strokeStyle = rgba(sky.rim, sky.rimAlpha * (0.5 + 0.5 * mood.energy))
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, h * 0.78)
  ctx.bezierCurveTo(w * 0.25, h * 0.7, w * 0.6, h * 0.82, w, h * 0.74)
  ctx.stroke()

  // светлячки — ночная живность; днём спят
  const fireflyBase = sky.firefly * (0.3 + 0.7 * mood.energy)
  if (fireflyBase > 0.03) {
    for (const f of FIREFLIES) {
      const x = f.x0 * w + Math.sin((tMs / 1500) * f.sp + f.ph) * f.ax
      const y = f.y0 * h + Math.cos((tMs / 1200) * f.sp + f.ph * 1.7) * f.ay
      const a = fireflyBase * (0.5 + 0.5 * Math.sin(tMs / 700 + f.ph * 3))
      const dot = ctx.createRadialGradient(x, y, 0, x, y, 5)
      dot.addColorStop(0, `rgba(255, 215, 106, ${a})`)
      dot.addColorStop(1, 'rgba(255, 215, 106, 0)')
      ctx.fillStyle = dot
      ctx.fillRect(x - 5, y - 5, 10, 10)
    }
  }

  // виньетка собирает взгляд к центру
  const vg = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.25, w / 2, h * 0.55, w * 0.75)
  vg.addColorStop(0, 'rgba(8, 4, 18, 0)')
  vg.addColorStop(1, `rgba(8, 4, 18, ${sky.vignette})`)
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, w, h)
}
