import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import { createSnake, moveInterval, snakeScore, stepSnake, turnSnake } from '../src/game/minigames/snake'
import { bubblesRiseMs, bubblesScore, cellAt, createBubbles, stepBubbles, tapBubble } from '../src/game/minigames/bubbles'

const SN = DEFAULT_CONFIG.minigames.snake
const BB = DEFAULT_CONFIG.minigames.bubbles
/** Сетка тестов — как старое поле 15×15. */
const GRID = { cols: 15, rows: 15 }
/** Сетка «Пузырей» — как старое поле 8×10. */
const BSIZE = { cols: 8, rows: 10 }

/** Еда всегда в правом дальнем углу: голова идёт направо и доедает. */
const foodRight = () => 0.999
const mid = Math.floor(GRID.cols / 2)

describe('snake — ядро «Змейки»', () => {
  it('змейка ползёт направо, ход раз в moveMs', () => {
    let s = createSnake(SN, GRID, foodRight)
    const before = s.snake[0]!.x
    s = stepSnake(s, 10, SN, foodRight)
    expect(s.snake[0]!.x).toBe(before) // ход ещё не созрел
    s = stepSnake(s, SN.moveMs, SN, foodRight)
    expect(s.snake[0]!.x).toBe(before + 1)
  })

  it('разворот на 180° игнорируется', () => {
    let s = createSnake(SN, GRID, foodRight)
    s = turnSnake(s, 'left')
    expect(s.pendingDir).toBeNull()
    expect(s.dir).toBe('right')
  })

  it('поворот применяется на следующем ходу', () => {
    let s = turnSnake(createSnake(SN, GRID, foodRight), 'down')
    expect(s.pendingDir).toBe('down')
    s = stepSnake(s, SN.moveMs, SN, foodRight)
    expect(s.dir).toBe('down')
    expect(s.snake[0]!.y).toBe(mid + 1)
  })

  it('стена смертельна: шаг за край — конец', () => {
    const narrow = { cols: 6, rows: 6 }
    let s = createSnake(SN, narrow, foodRight)
    // еда не на пути головы (y головы ≠ y еды): ведём голову к правому краю
    s = { ...s, food: { x: 0, y: 5 } }
    const stepsToWall = narrow.cols - 1 - s.snake[0]!.x
    for (let i = 0; i < stepsToWall && !s.over; i += 1) s = stepSnake(s, SN.moveMs, SN, foodRight)
    // голова дошла до последней колонки и ещё жива
    expect(s.over).toBe(false)
    expect(s.snake[0]!.x).toBe(narrow.cols - 1)
    // следующий шаг — в стену
    s = stepSnake(s, SN.moveMs, SN, foodRight)
    expect(s.over).toBe(true)
  })

  it('еда у стены съедается перед ней', () => {
    const narrow = { cols: 6, rows: 6 }
    let s = createSnake(SN, narrow, foodRight)
    // голова в предпоследней колонке, тело позади; еда — в самой стеновой
    s = { ...s, snake: [{ x: 4, y: 3 }, { x: 3, y: 3 }, { x: 2, y: 3 }], food: { x: 5, y: 3 } }
    const next = stepSnake(s, SN.moveMs, SN, foodRight)
    expect(next.score).toBe(1)
    expect(next.snake[0]!.x).toBe(5)
    expect(next.over).toBe(false)
  })

  it('еда растит змейку', () => {
    let s = createSnake(SN, GRID, foodRight)
    // голова в центре, еда в углу (cells-1, cells-1): ведём вниз, потом вправо
    const stepsDown = GRID.rows - 1 - mid
    s = turnSnake(s, 'down')
    for (let i = 0; i < stepsDown; i += 1) s = stepSnake(s, SN.moveMs, SN, foodRight)
    s = turnSnake(s, 'right')
    const lenBefore = s.snake.length
    for (let i = 0; i < GRID.cols * 2 && s.score === 0; i += 1) s = stepSnake(s, SN.moveMs, SN, foodRight)
    expect(s.score).toBe(1)
    expect(s.snake.length).toBe(lenBefore + 1)
  })

  it('со временем ход ускоряется, даже если ничего не есть', () => {
    let s = createSnake(SN, GRID, foodRight)
    const start = moveInterval(s, SN)
    for (let i = 0; i < 30; i += 1) {
      s = stepSnake(s, 1000, SN, foodRight)
      expect(s.over).toBe(false)
      // змейку возвращаем в центр, чтобы не врезалась в стену;
      // время партии (elapsedMs) не трогаем — разгон копится честно
      s = {
        ...s,
        moveMsLeft: SN.moveMs,
        snake: [{ x: 4, y: mid }, { x: 3, y: mid }, { x: 2, y: mid }],
        dir: 'right',
        pendingDir: null,
      }
    }
    expect(moveInterval(s, SN)).toBe(start - 30 * SN.rampPerSec)
  })

  it('разгон упирается в пол moveMin', () => {
    let s = createSnake(SN, GRID, foodRight)
    for (let i = 0; i < 200; i += 1) {
      s = stepSnake(s, 1000, SN, foodRight)
      s = {
        ...s,
        moveMsLeft: SN.moveMs,
        snake: [{ x: 4, y: mid }, { x: 3, y: mid }, { x: 2, y: mid }],
        dir: 'right',
        pendingDir: null,
      }
    }
    expect(s.over).toBe(false)
    expect(moveInterval(s, SN)).toBe(SN.moveMin)
  })

  it('партия бесконечна: большой счёт не завершает игру', () => {
    let s = createSnake(SN, GRID, foodRight)
    s = { ...s, score: 99, snake: [{ x: mid, y: 1 }, { x: mid - 1, y: 1 }, { x: mid - 2, y: 1 }], food: { x: mid + 1, y: 1 } }
    const next = stepSnake(s, SN.moveMs, SN, foodRight)
    expect(next.over).toBe(false)
    expect(snakeScore(next)).toBe(100)
  })

  it('в собственный хвост — конец', () => {
    let s = createSnake(SN, GRID, foodRight)
    // сворачиваем кольцо: вправо-вниз-влево-вверх лоб в лоб с телом
    s = { ...s, snake: [{ x: 3, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 3 }] }
    s = turnSnake(s, 'down')
    s = stepSnake(s, SN.moveMs, SN, foodRight)
    s = turnSnake(s, 'left')
    s = stepSnake(s, SN.moveMs, SN, foodRight)
    s = turnSnake(s, 'up')
    s = stepSnake(s, SN.moveMs, SN, foodRight)
    expect(s.over).toBe(true)
  })
})

describe('bubbles — ядро «Пузырей»', () => {
  it('старт: пять нижних рядов заполнены — сразу есть что лопать', () => {
    const s = createBubbles(BB, BSIZE, () => 0.25)
    for (let row = BSIZE.rows - 5; row < BSIZE.rows; row++)
      for (let col = 0; col < BSIZE.cols; col++) expect(cellAt(s, col, row)).toBeGreaterThanOrEqual(0)
    expect(cellAt(s, 0, 0)).toBe(-1)
  })

  it('группа меньше трёх не лопается', () => {
    // поле с единственным пузырём цвета 0
    const grid = new Int8Array(BSIZE.cols * BSIZE.rows).fill(-1)
    grid[(BSIZE.rows - 1) * BSIZE.cols] = 0
    const s = { size: BSIZE, grid, riseMsLeft: BB.riseMs, rises: 0, score: 0, over: false }
    const { state, popped } = tapBubble(s, BB, 0, BSIZE.rows - 1)
    expect(popped).toBe(0)
    expect(state.grid[(BSIZE.rows - 1) * BSIZE.cols]).toBe(0)
  })

  it('группа из трёх лопается, столб оседает, очки капают', () => {
    const grid = new Int8Array(BSIZE.cols * BSIZE.rows).fill(-1)
    // столб 0: три пузыря цвета 1 внизу + чужой над ними
    grid[(BSIZE.rows - 1) * BSIZE.cols] = 1
    grid[(BSIZE.rows - 2) * BSIZE.cols] = 1
    grid[(BSIZE.rows - 3) * BSIZE.cols] = 1
    grid[(BSIZE.rows - 4) * BSIZE.cols] = 2
    const s = { size: BSIZE, grid, riseMsLeft: BB.riseMs, rises: 0, score: 0, over: false }
    const { state, popped } = tapBubble(s, BB, 0, BSIZE.rows - 1)
    expect(popped).toBe(3)
    expect(bubblesScore(state)).toBe(30)
    expect(cellAt(state, 0, BSIZE.rows - 1)).toBe(2) // верхний опустился
    expect(cellAt(state, 0, BSIZE.rows - 4)).toBe(-1)
  })

  it('группа от пяти — бонус +50% к очкам', () => {
    const grid = new Int8Array(BSIZE.cols * BSIZE.rows).fill(-1)
    for (let i = 0; i < 5; i += 1) grid[(BSIZE.rows - 1) * BSIZE.cols + i] = 0
    const s = { size: BSIZE, grid, riseMsLeft: BB.riseMs, rises: 0, score: 0, over: false }
    const next = tapBubble(s, BB, 0, BSIZE.rows - 1)
    expect(next.popped).toBe(5)
    expect(bubblesScore(next.state)).toBe(5 * 10 + 5 * 5)
  })

  it('диагональные не считаются одной группой', () => {
    const grid = new Int8Array(BSIZE.cols * BSIZE.rows).fill(-1)
    const r = BSIZE.rows - 1
    grid[r * BSIZE.cols] = 3
    grid[(r - 1) * BSIZE.cols + 1] = 3
    grid[(r - 2) * BSIZE.cols + 2] = 3
    const s = { size: BSIZE, grid, riseMsLeft: BB.riseMs, rises: 0, score: 0, over: false }
    // группа из одного — не лопается вовсе
    expect(tapBubble(s, BB, 0, r).popped).toBe(0)
  })

  it('поле поднимается всё быстрее; достав до верхней кромки — проигрыш', () => {
    let s = createBubbles(BB, BSIZE, () => 0.25)
    const first = bubblesRiseMs(s, BB)
    for (let i = 0; i < BSIZE.rows * 3 && !s.over; i += 1) s = stepBubbles(s, BB.riseMs + 10, BB, () => 0.25)
    expect(s.over).toBe(true)
    expect(bubblesRiseMs(s, BB)).toBeLessThan(first)
  })
})
