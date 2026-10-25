import { describe, expect, it } from 'vitest'
import { BLINK_FACE, BODIES, CRACKS, FACES, PALETTE } from '../src/game/sprites'
import type { Sprite } from '../src/game/sprites'
import type { Mood, Stage } from '../src/game/types'

const ALL_SPRITES: Record<string, Sprite> = {
  'тело: egg': BODIES.egg,
  'тело: baby': BODIES.baby,
  'тело: adult': BODIES.adult,
  'лицо: happy': FACES.happy,
  'лицо: content': FACES.content,
  'лицо: sad': FACES.sad,
  'лицо: sick': FACES.sick,
  'лицо: sleeping': FACES.sleeping,
  'моргание': BLINK_FACE,
  'трещина 1': CRACKS.first,
  'трещина 2': CRACKS.second,
}

describe('структура спрайтов', () => {
  it.each(Object.entries(ALL_SPRITES))('%s: сетка ровно 16×16', (_, sprite) => {
    expect(sprite.width).toBe(16)
    expect(sprite.height).toBe(16)
    expect(sprite.rows).toHaveLength(16)
    for (const row of sprite.rows) expect(row).toHaveLength(16)
  })

  it.each(Object.entries(ALL_SPRITES))('%s: только известные символы палитры', (_, sprite) => {
    const known = Object.keys(PALETTE)
    for (const row of sprite.rows) {
      for (const ch of row) expect(known).toContain(ch)
    }
  })
})

describe('полнота набора', () => {
  it('тело есть для каждой стадии', () => {
    const stages: Stage[] = ['egg', 'baby', 'adult']
    for (const stage of stages) expect(BODIES[stage]).toBeDefined()
  })

  it('лицо есть для каждого настроения', () => {
    const moods: Mood[] = ['happy', 'content', 'sad', 'sick', 'sleeping']
    for (const mood of moods) expect(FACES[mood]).toBeDefined()
  })

  it('вторая трещина не меньше первой', () => {
    const count = (sprite: Sprite) =>
      sprite.rows.reduce((sum, row) => sum + [...row].filter((ch) => ch !== '.').length, 0)
    expect(count(CRACKS.second)).toBeGreaterThan(count(CRACKS.first))
  })
})
