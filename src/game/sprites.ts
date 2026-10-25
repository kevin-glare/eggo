import type { Mood, Stage } from './types'

/**
 * Пиксель-арт как данные: сетка 16×16, один символ = один пиксель.
 * '.' — прозрачный. Спрайты — чистые данные, рендерит их уже UI-слой.
 */
export interface Sprite {
  width: number
  height: number
  rows: readonly string[]
}

/** Символ → цвет; '' — прозрачный. */
export const PALETTE: Readonly<Record<string, string>> = {
  '.': '',
  K: '#3b3024', // контур, закрытые глаза
  B: '#ffd23f', // тело
  L: '#ffe9a3', // светлые пятна
  E: '#3b3024', // глаза-зрачки
  M: '#b3573f', // рот
  C: '#ffb0a0', // румянец
  S: '#7ec8f0', // капля пота
}

const D16 = '................'

/** Тела: яйцо → малыш (круглый) → взрослый (с ушками). */
export const BODIES: Record<Stage, Sprite> = {
  egg: {
    width: 16,
    height: 16,
    rows: [
      '......KKKK......',
      '....KKBBBBKK....',
      '...KBBBBBBBBK...',
      '..KBBLLLLBBBBK..',
      '..KBBLLLLBBBBK..',
      '.KBBBBBBBBBBBBK.',
      '.KBBBBLLBBBBBBK.',
      '.KBBBLLLLBBBBBK.',
      'KBBBBBBBBBBBBBBK',
      'KBBBBBBBBBBBBBBK',
      'KBBBLLBBBBLLBBBK',
      'KBBLLLLBBBBLLBBK',
      '.KBBBBBBBBBBBBK.',
      '.KBBBBBBBBBBBBK.',
      '..KKBBBBBBBBKK..',
      '....KKKKKKKK....',
    ],
  },
  baby: {
    width: 16,
    height: 16,
    rows: [
      D16,
      D16,
      D16,
      '......KKKK......',
      '....KKBBBBKK....',
      '...KBBBBBBBBK...',
      '..KBBBBBBBBBBK..',
      '.KBBBBBBBBBBBBK.',
      '.KBBBBBBBBBBBBK.',
      'KBBBBBBBBBBBBBBK',
      'KBBBBBBBBBBBBBBK',
      'KBBBBBBBBBBBBBBK',
      'KBBBBBBBBBBBBBBK',
      '.KBBBBBBBBBBBBK.',
      '..KKBBBBBBBBKK..',
      '....KKKKKKKK....',
    ],
  },
  adult: {
    width: 16,
    height: 16,
    rows: [
      '..KK........KK..',
      '.KBBK......KBBK.',
      '.KBBK......KBBK.',
      '..KKKKKKKKKKKK..',
      '.KBBBBBBBBBBBBK.',
      'KBBBBBBBBBBBBBBK',
      'KBBBBBBBBBBBBBBK',
      'KBBBBBBBBBBBBBBK',
      'KBBBBBBBBBBBBBBK',
      'KBBBBBBBBBBBBBBK',
      'KBBBBBBBBBBBBBBK',
      'KBBBBBBBBBBBBBBK',
      '.KBBBBBBBBBBBBK.',
      '.KBBBBBBBBBBBBK.',
      '..KKBBBBBBBBKK..',
      '....KKKKKKKK....',
    ],
  },
}

const EMPTY = (rows: Record<number, string>): Sprite => {
  const grid = Array.from({ length: 16 }, (_, y) => rows[y] ?? D16)
  return { width: 16, height: 16, rows: grid }
}

/** Лица — оверлеи поверх тела: глаза на строках 5–7, рот на 10–11. */
export const FACES: Record<Mood, Sprite> = {
  content: EMPTY({
    6: '....EE....EE....',
    7: '....EE....EE....',
    10: '.....MMMMMM.....',
  }),
  happy: EMPTY({
    6: '....EE....EE....',
    7: '....EE....EE....',
    9: '..CC........CC..',
    10: '....MM....MM....',
    11: '.....MMMMMM.....',
  }),
  sad: EMPTY({
    5: '...KK......KK...',
    6: '....EE....EE....',
    7: '....EE....EE....',
    10: '.....MMMMMM.....',
    11: '....MM....MM....',
  }),
  sick: EMPTY({
    4: '............SS..',
    6: '....EE....EE....',
    7: '....EE....EE....',
    10: '....M.M..M.M....',
  }),
  sleeping: EMPTY({
    7: '....KK....KK....',
    10: '.......MM.......',
  }),
}

/** Короткое моргание: закрытые глаза + нейтральный рот. */
export const BLINK_FACE: Sprite = EMPTY({
  7: '....KK....KK....',
  10: '.....MMMMMM.....',
})

/** Трещины на яйце: вторая стадия — супермножество первой. */
export const CRACKS = {
  first: EMPTY({
    5: '.........K......',
    6: '........K.......',
    7: '.........K......',
  }),
  second: EMPTY({
    3: '....K...........',
    4: '.....K..........',
    5: '..K...K..K......',
    6: '...K.K...K..K...',
    7: '..K...K.K...K...',
    8: '....K.......K...',
    9: '.....K.....K....',
    10: '......K...K.....',
  }),
}
