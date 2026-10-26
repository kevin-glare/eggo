/**
 * Проверка Telegram initData — единственный вход в API.
 * Подпись HMAC считается токеном бота, который живёт в секретах воркера
 * и никогда не попадает на клиент.
 */

export interface TgUser {
  id: number
  first_name: string | null
  username: string | null
}

/** initData старше суток считаем протухшим */
const AUTH_MAX_AGE_SEC = 24 * 60 * 60

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmacRaw(keyMaterial: string, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(keyMaterial), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', key, enc.encode(message))
}

async function hmacHex(keyMaterial: ArrayBuffer, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', keyMaterial, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

function parseUser(raw: string | null): TgUser | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Partial<{ id: unknown; first_name: unknown; username: unknown }>
    if (typeof data.id !== 'number' || !Number.isInteger(data.id)) return null
    return {
      id: data.id,
      first_name: typeof data.first_name === 'string' ? data.first_name : null,
      username: typeof data.username === 'string' ? data.username : null,
    }
  } catch {
    return null
  }
}

/** null = не Telegram, подделка или протухшая подпись. */
export async function validateInitData(initData: string, botToken: string, nowSec: number): Promise<TgUser | null> {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null

  const authDate = Number(params.get('auth_date'))
  if (!Number.isInteger(authDate) || authDate <= 0 || nowSec - authDate > AUTH_MAX_AGE_SEC) return null

  const user = parseUser(params.get('user'))
  if (!user) return null

  // строка проверки: все поля кроме hash, отсортированные, key=value через \n
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash' && key !== 'signature')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = await hmacRaw('WebAppData', botToken)
  const computed = await hmacHex(secretKey, dataCheckString)
  return computed === hash ? user : null
}
