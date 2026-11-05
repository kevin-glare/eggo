/**
 * Общая геометрия канвасных мини-игр: мир партии равен реальному размеру
 * канваса (CSS-пиксели) — игра на весь экран; тапы переводятся обратно
 * в координаты мира. Небо и луг — те же, что на главной сцене.
 */

import type { MinigameWorld } from '../../game/minigames/world'

export interface WorldView {
  dpr: number
  scale: number
  offsetX: number
  offsetY: number
}

/** Мир новой партии: реальный размер канваса (не меньше минимального поля). */
export function canvasWorldSize(canvas: HTMLCanvasElement): MinigameWorld {
  const rect = canvas.getBoundingClientRect()
  return {
    w: Math.max(280, Math.round(rect.width)),
    h: Math.max(320, Math.round(rect.height)),
  }
}

/** Подогнать backing store под CSS-размер и вернуть вписывание мира. */
export function fitWorld(canvas: HTMLCanvasElement, worldW: number, worldH: number): WorldView {
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(rect.width * dpr))
  const h = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const scale = Math.min(w / worldW, h / worldH)
  return { dpr, scale, offsetX: (w - worldW * scale) / 2, offsetY: (h - worldH * scale) / 2 }
}

/** Очистить канвас и включить координаты мира. */
export function applyWorld(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, view: WorldView): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY)
}

/** Тап в координатах мира. */
export function worldPoint(
  canvas: HTMLCanvasElement,
  view: WorldView,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const px = ((clientX - rect.left) / rect.width) * canvas.width
  const py = ((clientY - rect.top) / rect.height) * canvas.height
  return { x: (px - view.offsetX) / view.scale, y: (py - view.offsetY) / view.scale }
}

/** Облако-«гребёнка»: ряд пуфов с плоским низом — как на главной сцене. */
function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#fffdf6'
  ctx.beginPath()
  for (const [dx, dy, r] of [
    [-26, 0, 14],
    [-8, -8, 17],
    [12, -4, 15],
    [28, 2, 11],
  ] as const) {
    ctx.moveTo(x + (dx + s) * r, y + dy * s)
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2)
  }
  ctx.fill()
  ctx.restore()
}

/** День в мире Eggo: тёплое небо, дрейфующие облака, луг снизу. */
export function drawMinigameSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  groundY: number,
  now: number,
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, groundY)
  sky.addColorStop(0, '#8fd0f5')
  sky.addColorStop(0.6, '#c8e9fb')
  sky.addColorStop(1, '#fdf3d9')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, groundY)
  // солнце
  ctx.save()
  ctx.globalAlpha = 0.5
  const sun = ctx.createRadialGradient(w - 64, 62, 4, w - 64, 62, 46)
  sun.addColorStop(0, 'rgba(255, 236, 170, 0.95)')
  sun.addColorStop(1, 'rgba(255, 236, 170, 0)')
  ctx.fillStyle = sun
  ctx.fillRect(w - 110, 16, 92, 92)
  ctx.restore()
  // облака плывут медленно и зацикливаются
  const drift = (now / 1000) % 520
  drawCloud(ctx, 90 - drift * 0.4, 64, 1, 0.85)
  drawCloud(ctx, 260 - drift * 0.4 + 520, 92, 0.75, 0.7)
  drawCloud(ctx, 340 - drift * 0.4, 48, 0.6, 0.55)
  // луг: зелёный градиент с тёмной кромкой, как у сцены
  const grass = ctx.createLinearGradient(0, groundY - 6, 0, h)
  grass.addColorStop(0, '#a7d974')
  grass.addColorStop(0.25, '#8fce5f')
  grass.addColorStop(1, '#5ea84a')
  ctx.fillStyle = grass
  ctx.fillRect(0, groundY - 6, w, h - groundY + 6)
  ctx.fillStyle = 'rgba(70, 120, 40, 0.35)'
  ctx.fillRect(0, groundY - 6, w, 2.5)
}

/** Скруглённый прямоугольник (свой — roundRect нет в старых WebView). */
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Чип счёта в мире — стекло, как тосты сцены. */
export function drawScoreChip(ctx: CanvasRenderingContext2D, score: string, x: number, y: number): void {
  ctx.save()
  ctx.font = '700 17px Nunito, system-ui, sans-serif'
  const w = ctx.measureText(score).width + 24
  ctx.fillStyle = 'rgba(26, 16, 46, 0.55)'
  ctx.beginPath()
  roundRectPath(ctx, x, y, w, 30, 15)
  ctx.fill()
  ctx.fillStyle = '#fffdf6'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(score, x + w / 2, y + 16)
  ctx.restore()
}
