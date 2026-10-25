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

const CLOUDS = Array.from({ length: 4 }, (_, i) => ({
  x0: rand(),
  y: 0.1 + rand() * 0.24,
  scale: 0.7 + rand() * 0.6,
  speed: 0.004 + rand() * 0.006,
  seed: i,
}))

/** Луна живёт на своей орбите независимо от солнца. */
const MOON_POS: readonly [number, number] = [0.74, 0.16]

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

  // солнце и луна кроссфейдом: луна видна настолько, насколько нет солнца
  const sunA = sky.sun
  const moonA = 1 - sunA
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
    // серп: полный диск…
    ctx.fillStyle = `rgba(247, 237, 216, ${0.9 * moonA})`
    ctx.beginPath()
    ctx.arc(mx, my, 26, 0, Math.PI * 2)
    ctx.fill()
    // …кратеры на светлой части…
    ctx.fillStyle = `rgba(200, 186, 168, ${0.3 * moonA})`
    ctx.beginPath()
    ctx.arc(mx - 8, my + 4, 4, 0, Math.PI * 2)
    ctx.arc(mx - 4, my + 12, 2.5, 0, Math.PI * 2)
    ctx.fill()
    // …и «укус» тенью цветом текущего неба — чтобы не путалась с солнцем
    const skyMatch = ctx.createLinearGradient(0, 0, 0, h)
    skyMatch.addColorStop(0, rgba(sky.skyTop, 1))
    skyMatch.addColorStop(0.55, rgba(sky.skyMid, 1))
    skyMatch.addColorStop(1, rgba(sky.skyBot, 1))
    ctx.fillStyle = skyMatch
    ctx.beginPath()
    ctx.arc(mx + 10, my - 5, 22, 0, Math.PI * 2)
    ctx.fill()
  }

  // звёзды: видимость по времени суток, живость — по настроению
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

  // облака дрейфуют по небу
  if (sky.cloud > 0.02) {
    for (const c of CLOUDS) {
      const cx = (((c.x0 + (tMs / 1000) * c.speed) % 1.3) - 0.15) * w
      const cy = c.y * h
      const r = 26 * c.scale
      ctx.fillStyle = rgba(sky.cloudColor, 0.75 * sky.cloud)
      ctx.beginPath()
      ctx.ellipse(cx, cy, r * 1.25, r * 0.5, 0, 0, Math.PI * 2)
      ctx.ellipse(cx - r * 0.85, cy + r * 0.16, r * 0.75, r * 0.4, 0, 0, Math.PI * 2)
      ctx.ellipse(cx + r * 0.9, cy + r * 0.18, r * 0.8, r * 0.42, 0, 0, Math.PI * 2)
      ctx.fill()
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
