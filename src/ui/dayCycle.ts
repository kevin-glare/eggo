/**
 * Цикл суток: небо сэмплируется по локальному времени пользователя.
 * Палитры заданы якорными часами и плавно интерполируются между собой,
 * поэтому рассвет и закат — это градиентный переход, а не переключение.
 */

export type RGB = readonly [number, number, number]

export interface DayPalette {
  skyTop: RGB
  skyMid: RGB
  skyBot: RGB
  sea: RGB
  meadow: RGB
  rim: RGB
  rimAlpha: number
  /** тёплая полоса у горизонта */
  warm: number
  star: number
  cloud: number
  cloudColor: RGB
  firefly: number
  vignette: number
  /** видимость солнца */
  sun: number
  /** видимость луны — собственное расписание: сумерки → ночь → рассвет */
  moon: number
  sunPos: readonly [number, number]
  sunColor: RGB
  orbR: number
}

interface Anchor extends DayPalette {
  hour: number
}

const NIGHT: Omit<Anchor, 'hour'> = {
  skyTop: [20, 16, 42],
  skyMid: [37, 27, 71],
  skyBot: [58, 42, 94],
  sea: [32, 46, 86],
  meadow: [32, 56, 46],
  rim: [255, 214, 120],
  rimAlpha: 0.12,
  warm: 0.06,
  star: 1,
  cloud: 0,
  cloudColor: [230, 225, 255],
  firefly: 1,
  vignette: 0.55,
  sun: 0,
  moon: 1,
  sunPos: [0.74, 0.16],
  sunColor: [255, 236, 190],
  orbR: 30,
}

const ANCHORS: Anchor[] = [
  { hour: 0, ...NIGHT },
  { hour: 4.5, ...NIGHT },
  {
    // рассвет
    hour: 6.5,
    skyTop: [85, 96, 176],
    skyMid: [199, 127, 157],
    skyBot: [255, 207, 150],
    sea: [70, 112, 152],
    meadow: [74, 112, 72],
    rim: [255, 217, 160],
    rimAlpha: 0.35,
    warm: 0.35,
    star: 0.25,
    cloud: 0.5,
    cloudColor: [255, 230, 208],
    firefly: 0.3,
    vignette: 0.4,
    sun: 0.55,
    moon: 0,
    sunPos: [0.15, 0.55],
    sunColor: [255, 180, 94],
    orbR: 34,
  },
  {
    // день
    hour: 12.5,
    skyTop: [111, 143, 232],
    skyMid: [157, 184, 242],
    skyBot: [201, 217, 245],
    sea: [58, 124, 198],
    meadow: [88, 168, 92],
    rim: [255, 255, 255],
    rimAlpha: 0.4,
    warm: 0,
    star: 0,
    cloud: 1,
    cloudColor: [255, 255, 255],
    firefly: 0,
    vignette: 0.25,
    sun: 1,
    moon: 0,
    sunPos: [0.7, 0.1],
    sunColor: [255, 226, 120],
    orbR: 32,
  },
  {
    // день держится
    hour: 16.5,
    skyTop: [111, 143, 232],
    skyMid: [157, 184, 242],
    skyBot: [201, 217, 245],
    sea: [58, 124, 198],
    meadow: [88, 168, 92],
    rim: [255, 255, 255],
    rimAlpha: 0.4,
    warm: 0,
    star: 0,
    cloud: 1,
    cloudColor: [255, 255, 255],
    firefly: 0,
    vignette: 0.25,
    sun: 1,
    moon: 0,
    sunPos: [0.74, 0.16],
    sunColor: [255, 226, 120],
    orbR: 32,
  },
  {
    // закат
    hour: 19,
    skyTop: [61, 47, 110],
    skyMid: [176, 86, 124],
    skyBot: [255, 157, 92],
    sea: [72, 92, 148],
    meadow: [70, 120, 68],
    rim: [255, 179, 106],
    rimAlpha: 0.3,
    warm: 0.5,
    star: 0.35,
    cloud: 0.55,
    cloudColor: [255, 201, 168],
    firefly: 0.5,
    vignette: 0.45,
    sun: 0.45,
    moon: 0,
    sunPos: [0.85, 0.55],
    sunColor: [255, 180, 94],
    orbR: 36,
  },
  {
    // сумерки
    hour: 21.5,
    skyTop: [30, 22, 60],
    skyMid: [56, 40, 96],
    skyBot: [84, 58, 116],
    sea: [32, 46, 86],
    meadow: [32, 56, 46],
    rim: [255, 214, 120],
    rimAlpha: 0.15,
    warm: 0.15,
    star: 0.8,
    cloud: 0.2,
    cloudColor: [230, 225, 255],
    firefly: 0.9,
    vignette: 0.5,
    sun: 0,
    moon: 1,
    sunPos: [0.85, 0.6],
    sunColor: [255, 180, 94],
    orbR: 30,
  },
  { hour: 24, ...NIGHT },
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

function mix(a: Anchor, b: Anchor, t: number): DayPalette {
  return {
    skyTop: lerpRGB(a.skyTop, b.skyTop, t),
    skyMid: lerpRGB(a.skyMid, b.skyMid, t),
    skyBot: lerpRGB(a.skyBot, b.skyBot, t),
    sea: lerpRGB(a.sea, b.sea, t),
    meadow: lerpRGB(a.meadow, b.meadow, t),
    rim: lerpRGB(a.rim, b.rim, t),
    rimAlpha: lerp(a.rimAlpha, b.rimAlpha, t),
    warm: lerp(a.warm, b.warm, t),
    star: lerp(a.star, b.star, t),
    cloud: lerp(a.cloud, b.cloud, t),
    cloudColor: lerpRGB(a.cloudColor, b.cloudColor, t),
    firefly: lerp(a.firefly, b.firefly, t),
    vignette: lerp(a.vignette, b.vignette, t),
    sun: lerp(a.sun, b.sun, t),
    moon: lerp(a.moon, b.moon, t),
    sunPos: [lerp(a.sunPos[0], b.sunPos[0], t), lerp(a.sunPos[1], b.sunPos[1], t)],
    sunColor: lerpRGB(a.sunColor, b.sunColor, t),
    orbR: lerp(a.orbR, b.orbR, t),
  }
}

/** Небо на заданный час (с долями часа — для плавности). */
export function sampleDayCycle(hourFloat: number): DayPalette {
  const h = ((hourFloat % 24) + 24) % 24
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const a = ANCHORS[i]!
    const b = ANCHORS[i + 1]!
    if (h >= a.hour && h <= b.hour) {
      const t = (h - a.hour) / (b.hour - a.hour)
      return mix(a, b, t)
    }
  }
  return mix(ANCHORS[0]!, ANCHORS[1]!, 0)
}

/** Подпись части суток — для подписи сцены и dev-инструментов. */
export function phaseName(hourFloat: number): string {
  const h = ((hourFloat % 24) + 24) % 24
  if (h < 5) return 'ночь'
  if (h < 11) return 'утро'
  if (h < 17) return 'день'
  if (h < 22) return 'вечер'
  return 'ночь'
}
