import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/game/config'
import { createSnake, moveInterval, snakeScore, stepSnake, turnSnake } from '../src/game/minigames/snake'
import { bubblesScore, cellAt, createBubbles, stepBubbles, tapBubble } from '../src/game/minigames/bubbles'

const SN = DEFAULT_CONFIG.minigames.snake
const BB = DEFAULT_CONFIG.minigames.bubbles

/** Еда всегда в правом дальнем углу: голова идёт направо и доедает. */
const foodRight = () => 0.999
const mid = Math.floor(SN.cells / 2)

describe('snake — ядро «Змейки»', () => {
  it('змейка ползёт направо, ход раз в moveMs', () => {
    let s = createSnake(SN, foodRight)
    const before = s.snake[0]!.x
    s = stepSnake(s, 10, SN, foodRight)
    expect(s.snake[0]!.x).toBe(before) // ход ещё не созрел
    s = stepSnake(s, SN.moveMs, SN, foodRight)
    expect(s.snake[0]!.x).toBe(before + 1)
  })

  it('разворот на 180° игнорируется', () => {
    let s = createSnake(SN, foodRight)
    s = turnSnake(s, 'left')
    expect(s.pendingDir).toBeNull()
    expect(s.dir).toBe('right')
  })

  it('поворот применяется на следующем ходу', () => {
    let s = turnSnake(createSnake(SN, foodRight), 'down')
    expect(s.pendingDir).toBe('down')
    s = stepSnake(s, SN.moveMs, SN, foodRight)
    expect(s.dir).toBe('down')
    expect(s.snake[0]!.y).toBe(mid + 1)
  })

  it('стена — конец партии', () => {
    let s = createSnake(SN, foodRight)
    for (let i = 0; i < SN.cells * 2 && !s.over; i += 1) s = stepSnake(s, SN.moveMs, SN, foodRight)
    expect(s.over).toBe(true)
    expect(s.won).toBe(false)
  })

  it('еда растит змейку и ускоряет ход', () => {
    let s = createSnake(SN, foodRight)
    // голова в центре, еда в углу (cells-1, cells-1): ведём вниз, потом вправо
    const stepsDown = SN.cells - 1 - mid
    s = turnSnake(s, 'down')
    for (let i = 0; i < stepsDown; i += 1) s = stepSnake(s, SN.moveMs, SN, foodRight)
    s = turnSnake(s, 'right')
    const lenBefore = s.snake.length
    const speedBefore = moveInterval(s, SN)
    for (let i = 0; i < SN.cells * 2 && s.score === 0; i += 1) s = stepSnake(s, SN.moveMs, SN, foodRight)
    expect(s.score).toBe(1)
    expect(s.snake.length).toBe(lenBefore + 1)
    expect(moveInterval(s, SN)).toBe(speedBefore - SN.moveStep)
  })

  it('winScore кусков — победа', () => {
    let s = createSnake(SN, foodRight)
    s = { ...s, score: SN.winScore - 1, snake: [{ x: mid, y: 1 }, { x: mid - 1, y: 1 }, { x: mid - 2, y: 1 }], food: { x: mid + 1, y: 1 } }
    const next = stepSnake(s, SN.moveMs, SN, foodRight)
    expect(next.won).toBe(true)
    expect(next.over).toBe(true)
    expect(snakeScore(next)).toBe(SN.winScore)
  })

  it('в собственный хвост — конец', () => {
    let s = createSnake(SN, foodRight)
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
  it('старт: три нижних ряда заполнены', () => {
    const s = createBubbles(BB, () => 0.25)
    for (let row = BB.rows - 3; row < BB.rows; row++)
      for (let col = 0; col < BB.cols; col++) expect(cellAt(s, BB, col, row)).toBeGreaterThanOrEqual(0)
    expect(cellAt(s, BB, 0, 0)).toBe(-1)
  })

  it('группа меньше трёх не лопается', () => {
    // поле с единственным пузырём цвета 0
    const grid = new Int8Array(BB.cols * BB.rows).fill(-1)
    grid[(BB.rows - 1) * BB.cols] = 0
    const s = { grid, riseMsLeft: BB.riseMs, score: 0, over: false, won: false }
    const { state, popped } = tapBubble(s, BB, 0, BB.rows - 1)
    expect(popped).toBe(0)
    expect(state.grid[(BB.rows - 1) * BB.cols]).toBe(0)
  })

  it('группа из трёх лопается, столб оседает, очки капают', () => {
    const grid = new Int8Array(BB.cols * BB.rows).fill(-1)
    // столб 0: три пузыря цвета 1 внизу + чужой над ними
    grid[(BB.rows - 1) * BB.cols] = 1
    grid[(BB.rows - 2) * BB.cols] = 1
    grid[(BB.rows - 3) * BB.cols] = 1
    grid[(BB.rows - 4) * BB.cols] = 2
    const s = { grid, riseMsLeft: BB.riseMs, score: 0, over: false, won: false }
    const { state, popped } = tapBubble(s, BB, 0, BB.rows - 1)
    expect(popped).toBe(3)
    expect(bubblesScore(state)).toBe(30)
    expect(cellAt(state, BB, 0, BB.rows - 1)).toBe(2) // верхний опустился
    expect(cellAt(state, BB, 0, BB.rows - 4)).toBe(-1)
  })

  it('диагональные не считаются одной группой', () => {
    const grid = new Int8Array(BB.cols * BB.rows).fill(-1)
    const r = BB.rows - 1
    grid[r * BB.cols] = 3
    grid[(r - 1) * BB.cols + 1] = 3
    grid[(r - 2) * BB.cols + 2] = 3
    const s = { grid, riseMsLeft: BB.riseMs, score: 0, over: false, won: false }
    // группа из одного — не лопается вовсе
    expect(tapBubble(s, BB, 0, r).popped).toBe(0)
  })

  it('поле поднимается; достав до верхней кромки — проигрыш', () => {
    let s = createBubbles(BB, () => 0.25)
    for (let i = 0; i < BB.rows * 3 && !s.over; i += 1) s = stepBubbles(s, BB.riseMs + 10, BB, () => 0.25)
    expect(s.over).toBe(true)
    expect(s.won).toBe(false)
  })

  it('winScore очков — победа на месте', () => {
    const s = { ...createBubbles(BB, () => 0.25), score: BB.winScore }
    expect(s.won).toBe(false)
    const grid = new Int8Array(BB.cols * BB.rows).fill(-1)
    for (let i = 0; i < 3; i += 1) grid[(BB.rows - 1) * BB.cols + i] = 0
    const next = tapBubble({ ...s, grid }, BB, 0, BB.rows - 1)
    expect(next.state.won).toBe(true)
    expect(next.state.over).toBe(true)
  })
})
