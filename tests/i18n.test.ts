import { describe, expect, it } from 'vitest'
import { detectLang } from '../src/ui/i18n'

describe('detectLang — язык по локали устройства', () => {
  it('языки СНГ и пост-советского пространства — русский', () => {
    const cis = ['ru', 'uk', 'be', 'kk', 'uz', 'ky', 'tg', 'tk', 'az', 'hy', 'ka', 'mo']
    for (const code of cis) {
      expect(detectLang(code), code).toBe('ru')
    }
  })

  it('региональные коды разбираются до базового языка', () => {
    expect(detectLang('ru-RU')).toBe('ru')
    expect(detectLang('ru_RU')).toBe('ru')
    expect(detectLang('uk-UA')).toBe('ru')
    expect(detectLang('en-US')).toBe('en')
  })

  it('остальные языки — английский', () => {
    expect(detectLang('en')).toBe('en')
    expect(detectLang('de-DE')).toBe('en')
    expect(detectLang('fr')).toBe('en')
    expect(detectLang('es-419')).toBe('en')
    expect(detectLang('pl')).toBe('en')
  })

  it('нет или пустая локаль — английский по умолчанию', () => {
    expect(detectLang(null)).toBe('en')
    expect(detectLang(undefined)).toBe('en')
    expect(detectLang('')).toBe('en')
  })
})
