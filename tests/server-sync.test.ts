import { afterEach, describe, expect, it, vi } from 'vitest'
import { petStore } from '../src/telegram'

/** Минимальный «Telegram»: платформа известна и initData подписан. */
const tg = { platform: 'ios', initData: 'auth_date=1&user=%7B%22id%22%3A1%7D&hash=abc' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('petStore.serverSync', () => {
  it('шлёт initData и сейв, возвращает сейв сервера', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: tg } })
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit): Promise<Response> =>
      new Response(JSON.stringify({ save: 'серверный' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await petStore.serverSync('клиентский')).toEqual({ save: 'серверный' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:8787/sync')
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      initData: tg.initData,
      save: 'клиентский',
    })
  })

  it('сеть недоступна → null, игра живёт на localStorage', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: tg } })
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline')
    }))
    expect(await petStore.serverSync('клиентский')).toBeNull()
  })

  it('вне Telegram синка нет — fetch не вызывается', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: { platform: 'unknown', initData: '' } } })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await petStore.serverSync('клиентский')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
