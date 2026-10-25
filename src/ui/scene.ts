/**
 * Фон сцены «тёплая ночь»: небо, луна, звёзды, холмы, светлячки.
 * energy/warm — настроение сцены: чем лучше питомцу, тем живее ночь.
 */

export interface SceneParams {
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

export function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: SceneParams,
  tMs: number,
): void {
  // небо
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#1a1230')
  sky.addColorStop(0.55, '#31235a')
  sky.addColorStop(1, '#4a3670')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // луна с мягким гало
  const mx = w * 0.74
  const my = h * 0.16
  const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 95)
  halo.addColorStop(0, `rgba(247, 237, 216, ${0.06 + 0.07 * p.energy})`)
  halo.addColorStop(1, 'rgba(247, 237, 216, 0)')
  ctx.fillStyle = halo
  ctx.fillRect(mx - 95, my - 95, 190, 190)
  ctx.beginPath()
  ctx.arc(mx, my, 30, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(247, 237, 216, 0.85)'
  ctx.fill()
  ctx.fillStyle = 'rgba(200, 186, 168, 0.25)'
  ctx.beginPath()
  ctx.arc(mx - 9, my - 6, 6, 0, Math.PI * 2)
  ctx.arc(mx + 8, my + 9, 4, 0, Math.PI * 2)
  ctx.fill()

  // звёзды мерцают
  for (const s of STARS) {
    const a = (0.2 + 0.5 * p.energy) * (0.5 + 0.5 * Math.sin((tMs / 1000) * s.sp + s.ph))
    ctx.fillStyle = `rgba(245, 237, 255, ${a})`
    ctx.beginPath()
    ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
    ctx.fill()
  }

  // тёплая полоса у горизонта — зависит от «тёплости» настроения
  const warm = ctx.createLinearGradient(0, h * 0.5, 0, h)
  warm.addColorStop(0, 'rgba(255, 166, 87, 0)')
  warm.addColorStop(1, `rgba(255, 166, 87, ${0.14 * p.warm})`)
  ctx.fillStyle = warm
  ctx.fillRect(0, h * 0.5, w, h * 0.5)

  // дальние и ближние холмы
  ctx.fillStyle = '#231a42'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.62)
  ctx.bezierCurveTo(w * 0.3, h * 0.52, w * 0.7, h * 0.58, w, h * 0.55)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#2b2050'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.78)
  ctx.bezierCurveTo(w * 0.25, h * 0.7, w * 0.6, h * 0.82, w, h * 0.74)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()
  // светящаяся кромка ближнего холма
  ctx.strokeStyle = `rgba(255, 214, 120, ${0.05 + 0.06 * p.energy})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, h * 0.78)
  ctx.bezierCurveTo(w * 0.25, h * 0.7, w * 0.6, h * 0.82, w, h * 0.74)
  ctx.stroke()

  // светлячки дрейфуют по синусоидам
  for (const f of FIREFLIES) {
    const x = f.x0 * w + Math.sin((tMs / 1500) * f.sp + f.ph) * f.ax
    const y = f.y0 * h + Math.cos((tMs / 1200) * f.sp + f.ph * 1.7) * f.ay
    const a = (0.25 + 0.45 * p.energy) * (0.5 + 0.5 * Math.sin(tMs / 700 + f.ph * 3))
    const dot = ctx.createRadialGradient(x, y, 0, x, y, 5)
    dot.addColorStop(0, `rgba(255, 215, 106, ${a})`)
    dot.addColorStop(1, 'rgba(255, 215, 106, 0)')
    ctx.fillStyle = dot
    ctx.fillRect(x - 5, y - 5, 10, 10)
  }

  // виньетка собирает взгляд к центру
  const vg = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.25, w / 2, h * 0.55, w * 0.75)
  vg.addColorStop(0, 'rgba(8, 4, 18, 0)')
  vg.addColorStop(1, 'rgba(8, 4, 18, 0.55)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, w, h)
}
