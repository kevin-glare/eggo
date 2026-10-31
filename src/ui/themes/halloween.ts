/**
 * Хэллоуин: летучие мыши в небе и тыквы-светильники на лугу.
 * Только добавляет декор поверх базовой сцены: днём мыши — тёмные
 * силуэты, ночью чуть подсвечены, лица тыкв темнее светятся.
 * Позиции детерминированы — никакого Math.random на кадре.
 */
import type { DayPalette } from '../dayCycle'

interface Bat {
  /** стартовая доля ширины/высоты сцены */
  x0: number
  y0: number
  s: number
  /** доля ширины сцены в секунду */
  speed: number
  ph: number
  flapSp: number
}

const BATS: Bat[] = [
  { x0: 0.15, y0: 0.14, s: 1, speed: 0.012, ph: 0, flapSp: 9 },
  { x0: 0.45, y0: 0.09, s: 0.7, speed: 0.016, ph: 2.1, flapSp: 11 },
  { x0: 0.7, y0: 0.2, s: 1.2, speed: 0.01, ph: 4.4, flapSp: 7 },
  { x0: 0.3, y0: 0.28, s: 0.8, speed: 0.014, ph: 5.6, flapSp: 10 },
]

/** x, y — доли сцены; r — радиус тыквы. «Резиновая» сцена прижимает канвас
    к низу и режет бока (object-fit: cover), поэтому держимся полосы
    x ≈ 0.23–0.77 — она видна на любом экране, от широкого до высокого. */
const PUMPKINS = [
  { x: 0.23, y: 0.855, r: 16 },
  { x: 0.77, y: 0.845, r: 13 },
  { x: 0.335, y: 0.885, r: 10 },
]

export function drawHalloween(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tMs: number,
  sky: DayPalette,
): void {
  const t = tMs / 1000
  // ночью мыши подсвечиваются фиолетовым, чтобы не тонули в тёмном небе
  const night = sky.star
  const batColor = `rgb(${22 + 68 * night | 0}, ${14 + 56 * night | 0}, ${40 + 104 * night | 0})`
  for (const bat of BATS) {
    const x = (((bat.x0 + t * bat.speed) % 1.2) - 0.1) * w
    const y = (bat.y0 + Math.sin(t * 0.6 + bat.ph) * 0.012) * h
    drawBat(ctx, x, y, bat.s, Math.sin(t * bat.flapSp + bat.ph), batColor)
  }
  // днём лица как нарисованные, ночью светятся изнутри
  const glow = 0.45 + 0.55 * (1 - sky.sun)
  for (const p of PUMPKINS) drawPumpkin(ctx, p.x * w, p.y * h, p.r, tMs, glow)
}

function drawBat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  flap: number,
  color: string,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = color
  // тело и уши
  ctx.beginPath()
  ctx.ellipse(0, 0, 3.6, 5.2, 0, 0, Math.PI * 2)
  ctx.moveTo(-2.6, -3.8)
  ctx.lineTo(-1.7, -7.6)
  ctx.lineTo(-0.5, -4.4)
  ctx.closePath()
  ctx.moveTo(2.6, -3.8)
  ctx.lineTo(1.7, -7.6)
  ctx.lineTo(0.5, -4.4)
  ctx.closePath()
  ctx.fill()
  // крылья: взмах поднимает внешние края
  const lift = flap * 6
  ctx.beginPath()
  ctx.moveTo(-3, -1)
  ctx.quadraticCurveTo(-11, -6 - lift, -18, -3 - lift * 1.2)
  ctx.quadraticCurveTo(-11, 3 - lift * 0.4, -3, 2)
  ctx.closePath()
  ctx.moveTo(3, -1)
  ctx.quadraticCurveTo(11, -6 - lift, 18, -3 - lift * 1.2)
  ctx.quadraticCurveTo(11, 3 - lift * 0.4, 3, 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawPumpkin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tMs: number,
  glow: number,
): void {
  ctx.save()
  ctx.translate(x, y)
  // тень на траве
  ctx.fillStyle = 'rgba(10, 20, 10, 0.14)'
  ctx.beginPath()
  ctx.ellipse(0, 2, r * 1.15, r * 0.22, 0, 0, Math.PI * 2)
  ctx.fill()
  // свечение за тыквой — мерцает, как огонёк внутри
  const flicker = 1 + Math.sin(tMs / 130 + x) * 0.12
  const halo = ctx.createRadialGradient(0, -r * 0.55, 0, 0, -r * 0.55, r * 2.6)
  halo.addColorStop(0, `rgba(255, 186, 84, ${0.22 * glow * flicker})`)
  halo.addColorStop(1, 'rgba(255, 186, 84, 0)')
  ctx.fillStyle = halo
  ctx.fillRect(-r * 2.6, -r * 3.15, r * 5.2, r * 5.2)
  // дольки: тёмные бока, светлая середина
  ctx.fillStyle = '#b95414'
  ctx.beginPath()
  ctx.ellipse(-r * 0.42, -r * 0.55, r * 0.5, r * 0.68, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(r * 0.42, -r * 0.55, r * 0.5, r * 0.68, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e07a2e'
  ctx.beginPath()
  ctx.ellipse(0, -r * 0.55, r * 0.55, r * 0.68, 0, 0, Math.PI * 2)
  ctx.fill()
  // хвостик
  ctx.fillStyle = '#5d7a34'
  ctx.beginPath()
  ctx.moveTo(-r * 0.09, -r * 1.2)
  ctx.quadraticCurveTo(-r * 0.06, -r * 1.45, r * 0.02, -r * 1.5)
  ctx.lineTo(r * 0.12, -r * 1.42)
  ctx.quadraticCurveTo(r * 0.1, -r * 1.3, r * 0.09, -r * 1.18)
  ctx.closePath()
  ctx.fill()
  // лицо: треугольные глаза и улыбка-полумесяц, светятся тем сильнее, чем темнее
  ctx.fillStyle = `rgba(255, 214, 106, ${0.4 + 0.6 * glow})`
  ctx.beginPath()
  ctx.moveTo(-r * 0.55, -r * 0.6)
  ctx.lineTo(-r * 0.18, -r * 0.6)
  ctx.lineTo(-r * 0.37, -r * 0.92)
  ctx.closePath()
  ctx.moveTo(r * 0.55, -r * 0.6)
  ctx.lineTo(r * 0.18, -r * 0.6)
  ctx.lineTo(r * 0.37, -r * 0.92)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, -r * 0.45, r * 0.5, Math.PI * 0.12, Math.PI * 0.88)
  ctx.arc(0, -r * 0.58, r * 0.4, Math.PI * 0.8, Math.PI * 0.2, true)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
