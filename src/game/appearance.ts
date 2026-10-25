/**
 * Внешность питомца — его «гены»: форма тела, уши, глаза, нос, руки, ноги
 * и палитра. Здесь только чистые данные: как именно их рисовать, знает
 * UI-слой (petArt). Гены бросаются один раз при создании питомца и живут
 * в сейве — питомец не меняет внешность между запусками.
 */

export type BodyShape = 'round' | 'pear' | 'tall'
export type EarKind = 'round' | 'long' | 'droopy' | 'tuft'
export type EyeKind = 'big' | 'beady' | 'wide'
export type NoseKind = 'oval' | 'triangle' | 'dot' | 'none'
export type ArmKind = 'none' | 'stub' | 'long'
export type LegKind = 'round' | 'wide' | 'tiny'
export type PaletteKind = 'sunny' | 'mint' | 'pink' | 'sky' | 'lavender' | 'peach'

export interface PetAppearance {
  body: BodyShape
  ears: EarKind
  eyes: EyeKind
  nose: NoseKind
  arms: ArmKind
  legs: LegKind
  palette: PaletteKind
}

/** Каталоги вариантов — источник правды для броска генов и проверки сейвов. */
export const BODY_SHAPES = ['round', 'pear', 'tall'] as const
export const EAR_KINDS = ['round', 'long', 'droopy', 'tuft'] as const
export const EYE_KINDS = ['big', 'beady', 'wide'] as const
export const NOSE_KINDS = ['oval', 'triangle', 'dot', 'none'] as const
export const ARM_KINDS = ['none', 'stub', 'long'] as const
export const LEG_KINDS = ['round', 'wide', 'tiny'] as const
export const PALETTE_KINDS = ['sunny', 'mint', 'pink', 'sky', 'lavender', 'peach'] as const

/** Бросить случайную внешность. Чистая: источник случайности приходит снаружи. */
export function rollAppearance(rand: () => number): PetAppearance {
  return {
    body: pick(BODY_SHAPES, rand()),
    ears: pick(EAR_KINDS, rand()),
    eyes: pick(EYE_KINDS, rand()),
    nose: pick(NOSE_KINDS, rand()),
    arms: pick(ARM_KINDS, rand()),
    legs: pick(LEG_KINDS, rand()),
    palette: pick(PALETTE_KINDS, rand()),
  }
}

function pick<T extends string>(variants: readonly T[], roll: number): T {
  const i = Math.min(variants.length - 1, Math.floor(roll * variants.length))
  return variants[i]!
}

function isOneOf<T extends string>(value: unknown, variants: readonly T[]): value is T {
  return typeof value === 'string' && (variants as readonly string[]).includes(value)
}

/** Проверка внешности из сейва: старые сейвы поля не имеют, битые — отбрасываем. */
export function isAppearance(value: unknown): value is PetAppearance {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    isOneOf(v.body, BODY_SHAPES) &&
    isOneOf(v.ears, EAR_KINDS) &&
    isOneOf(v.eyes, EYE_KINDS) &&
    isOneOf(v.nose, NOSE_KINDS) &&
    isOneOf(v.arms, ARM_KINDS) &&
    isOneOf(v.legs, LEG_KINDS) &&
    isOneOf(v.palette, PALETTE_KINDS)
  )
}
