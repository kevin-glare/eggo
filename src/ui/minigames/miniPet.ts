import type { PetPalette } from '../petArt'

/**
 * Мини-питомец для канвасных мини-игр: тот же «виниловый» радиальный свет,
 * контур и румянец, что в petArt, но без генов-деталей — компактный герой.
 */

export interface MiniPetOpts {
  /** взгляд: happy — дуги, open — бусинки, sad — грустные */
  eyes?: 'open' | 'happy' | 'sad'
  /** сплющенность по вертикали (присед): 1 — обычный */
  squash?: number
  /** наклон, рад */
  tilt?: number
  /** открытый рот (ловит еду) */
  mouthOpen?: number
}

export function drawMiniPet(
  ctx: CanvasRenderingContext2D,
  p: PetPalette,
  x: number,
  y: number,
  r: number,
  opts: MiniPetOpts = {},
): void {
  const squash = opts.squash ?? 1
  const ry = r * 0.92 * squash
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(opts.tilt ?? 0)

  // уши: два мягких лепестка на макушке
  ctx.fillStyle = p.bodyMid
  ctx.strokeStyle = p.outline
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(side * r * 0.52, -ry * 0.82)
    ctx.rotate(side * 0.3)
    ctx.beginPath()
    ctx.ellipse(0, -r * 0.18, r * 0.16, r * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  // тело: радиальный свет из верхне-левого источника
  const body = ctx.createRadialGradient(-r * 0.35, -ry * 0.45, r * 0.12, 0, ry * 0.1, r * 1.35)
  body.addColorStop(0, p.bodyLight)
  body.addColorStop(0.55, p.bodyMid)
  body.addColorStop(1, p.bodyShade)
  ctx.beginPath()
  ctx.ellipse(0, 0, r, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = p.outline
  ctx.lineWidth = 3
  ctx.stroke()

  // животик + блик
  ctx.fillStyle = 'rgba(255, 248, 235, 0.5)'
  ctx.beginPath()
  ctx.ellipse(0, ry * 0.3, r * 0.5, ry * 0.34, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.beginPath()
  ctx.ellipse(-r * 0.4, -ry * 0.55, r * 0.16, ry * 0.09, -0.5, 0, Math.PI * 2)
  ctx.fill()

  // лицо
  const eyeDX = r * 0.36
  const eyeY = -ry * 0.18
  const eyes = opts.eyes ?? 'open'
  ctx.strokeStyle = p.outline
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    if (eyes === 'happy') {
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(side * eyeDX, eyeY + 2, r * 0.16, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
    } else {
      ctx.fillStyle = '#2c2118'
      ctx.beginPath()
      ctx.ellipse(side * eyeDX, eyeY, r * 0.09, r * (eyes === 'sad' ? 0.06 : 0.11), 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (eyes === 'sad') {
    ctx.lineWidth = 2
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(side * (eyeDX - r * 0.14), eyeY - r * 0.26)
      ctx.lineTo(side * (eyeDX + r * 0.08), eyeY - r * 0.18)
      ctx.stroke()
    }
  }

  // румянец
  ctx.fillStyle = p.blush
  ctx.globalAlpha = 0.5
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(side * r * 0.58, ry * 0.1, r * 0.13, r * 0.08, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // рот: открыт (ловит/радуется), дуга или грустный
  const open = opts.mouthOpen ?? 0
  if (open > 0.05) {
    ctx.beginPath()
    ctx.ellipse(0, ry * 0.3, r * 0.18 * (0.6 + open * 0.6), ry * 0.2 * open + 2, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#a34d33'
    ctx.fill()
  } else if (eyes === 'sad') {
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(0, ry * 0.44, r * 0.16, Math.PI * 1.2, Math.PI * 1.8)
    ctx.stroke()
  } else {
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(0, ry * 0.14, r * 0.18, Math.PI * 0.2, Math.PI * 0.8)
    ctx.stroke()
  }
  ctx.restore()
}
