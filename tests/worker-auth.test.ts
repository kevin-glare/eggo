import { describe, expect, it } from 'vitest'
import { validateInitData } from '../worker/src/auth'

/** Подпись строим так же, как её считает Telegram — по алгоритму из доки. */
const BOT_TOKEN = '7000000001:TEST-TOKEN-abcdef'
const NOW_SEC = 1_800_000_000

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmac(keyMaterial: string | ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const raw = typeof keyMaterial === 'string' ? enc.encode(keyMaterial) : keyMaterial
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', key, enc.encode(message))
}

async function sign(params: Record<string, string>): Promise<string> {
  // по документации: строка проверки — все поля, кроме hash
  // (в том числе signature, который Telegram реально присылает)
  const dataCheckString = Object.entries(params)
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secretKey = await hmac('WebAppData', BOT_TOKEN)
  const hash = toHex(await hmac(secretKey, dataCheckString))
  return new URLSearchParams({ ...params, hash }).toString()
}

const baseParams = () => ({
  auth_date: String(NOW_SEC - 60),
  query_id: 'AAHdqu6JBAABCQ',
  user: JSON.stringify({ id: 42, first_name: 'Кевин', username: 'kevin' }),
})

describe('validateInitData', () => {
  it('корректно подписанные данные → пользователь', async () => {
    const user = await validateInitData(await sign(baseParams()), BOT_TOKEN, NOW_SEC)
    expect(user).toEqual({ id: 42, first_name: 'Кевин', username: 'kevin' })
  })

  it('поле signature из реального initData участвует в подписи', async () => {
    const withSignature = await sign({
      ...baseParams(),
      signature: 'Ed25519-signature-from-telegram',
    })
    const user = await validateInitData(withSignature, BOT_TOKEN, NOW_SEC)
    expect(user?.id).toBe(42)
  })

  it('подделанное поле ломает подпись', async () => {
    const tampered = (await sign(baseParams())).replace('kevin', 'hacker')
    expect(await validateInitData(tampered, BOT_TOKEN, NOW_SEC)).toBeNull()
  })

  it('подпись другого бота не проходит', async () => {
    expect(await validateInitData(await sign(baseParams()), '8000:OTHER-BOT', NOW_SEC)).toBeNull()
  })

  it('протухший auth_date отклоняется (лимит 24 ч)', async () => {
    const old = { ...baseParams(), auth_date: String(NOW_SEC - 25 * 60 * 60) }
    expect(await validateInitData(await sign(old), BOT_TOKEN, NOW_SEC)).toBeNull()
  })

  it('без hash отклоняется', async () => {
    expect(await validateInitData(new URLSearchParams(baseParams()).toString(), BOT_TOKEN, NOW_SEC)).toBeNull()
  })
})
