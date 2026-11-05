import { afterEach, describe, expect, it, vi } from 'vitest'
import { petStore } from '../src/telegram'

/** Минимальный «Telegram»: платформа известна и initData подписан. */
const tg = { platform: 'ios', initData: 'auth_date=1&user=%7B%22id%22%3A1%7D&hash=abc' }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('petStore.serverSync', () => {
  it('шлёт initData и сейв, возвращает сейв сервера', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: tg } })
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit): Promise<Response> =>
      new Response(JSON.stringify({ save: 'серверный', invited: 2 }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await petStore.serverSync('клиентский')).toEqual({ save: 'серверный', invited: 2 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:8787/sync')
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
    // JSON.parse превращает -0 в 0, поэтому ожидание считаем без унарного минуса
    // (иначе тест падает на раннерах с таймзоной UTC, где offset = 0)
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      initData: tg.initData,
      save: 'клиентский',
      tzOffset: 0 - new Date().getTimezoneOffset(), // минуты к востоку от UTC (Москва = 180)
    })
  })

  it('сеть недоступна → null после ретраев, игра живёт на localStorage', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { Telegram: { WebApp: tg } })
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline')
    }))
    const pending = petStore.serverSync('клиентский')
    await vi.runAllTimersAsync()
    expect(await pending).toBeNull()
  })

  it('вне Telegram синка нет — fetch не вызывается', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: { platform: 'unknown', initData: '' } } })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await petStore.serverSync('клиентский')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('petStore.serverSync — ретраи потерянных запросов', () => {
  it('первые попытки теряются → ретрай, пока не доедет (лимит 3 попытки)', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { Telegram: { WebApp: tg } })
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => {
        throw new Error('потерялся')
      })
      .mockImplementationOnce(async () => {
        throw new Error('потерялся')
      })
      .mockImplementationOnce(async () => new Response(JSON.stringify({ save: 'серверный' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const pending = petStore.serverSync('клиентский')
    await vi.runAllTimersAsync()
    expect(await pending).toEqual({ save: 'серверный', invited: null })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('keepalive (pagehide) не ретраится — одна попытка', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { Telegram: { WebApp: tg } })
    const fetchMock = vi.fn(async () => {
      throw new Error('потерялся')
    })
    vi.stubGlobal('fetch', fetchMock)

    const pending = petStore.serverSync('клиентский', true)
    await vi.runAllTimersAsync()
    expect(await pending).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('успех с первой попытки — ровно один fetch без задержек', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: tg } })
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ save: null }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await petStore.serverSync('клиентский')).toEqual({ save: null, invited: null })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('petStore.serverPull — запасной pull через GET', () => {
  it('тянет сейв GET-ом с initData в query (без тела и preflight)', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: tg } })
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit): Promise<Response> =>
      new Response(JSON.stringify({ save: 'из базы' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await petStore.serverPull()).toEqual({ save: 'из базы' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url.startsWith('http://localhost:8787/sync?initData=')).toBe(true)
    expect(url).toContain(encodeURIComponent(tg.initData))
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBeUndefined() // простой GET
  })

  it('сеть недоступна → null', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: tg } })
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline')
    }))
    expect(await petStore.serverPull()).toBeNull()
  })

  it('вне Telegram — null, fetch не вызывается', async () => {
    vi.stubGlobal('window', { Telegram: { WebApp: { platform: 'unknown', initData: '' } } })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await petStore.serverPull()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
