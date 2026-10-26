import { rollAppearance } from '../../src/game/appearance'
import { deserialize } from '../../src/game/storage'
import type { PetState } from '../../src/game/types'

/**
 * Решение о слиянии сейвов при /sync. Правило то же, что было у CloudStorage:
 * у кого lastTickAt новее (позже сохранялся), тот и главный.
 */

export interface SyncDecision {
  /** главный сейв — что сервер считает правдой и вернёт клиенту */
  raw: string | null
  /** стадия победившего сейва: крон по нему заметит взросление */
  stage: PetState['stage'] | null
  /** true — клиентский сейв победил, сервер должен его сохранить */
  fromClient: boolean
}

/** запасная внешность для очень старых сейвов — общая для воркера */
export const FALLBACK_APPEARANCE = rollAppearance(() => 0)

function readSave(raw: string | null): { lastTickAt: number; stage: PetState['stage'] } | null {
  if (!raw) return null
  const pet = deserialize(raw, FALLBACK_APPEARANCE)
  if (!pet) return null
  return { lastTickAt: pet.lastTickAt, stage: pet.stage }
}

export function resolveSync(clientRaw: string | null, serverRaw: string | null): SyncDecision {
  const client = readSave(clientRaw)
  const server = readSave(serverRaw)

  if (!client) {
    return { raw: serverRaw, stage: server ? server.stage : null, fromClient: false }
  }
  // битой строке в базе не доверяем — клиент чинит своим сейвом
  if (!server || client.lastTickAt > server.lastTickAt) {
    return { raw: clientRaw, stage: client.stage, fromClient: true }
  }
  // ничья по lastTickAt — оставляем серверный, без лишней перезаписи
  return { raw: serverRaw, stage: server.stage, fromClient: false }
}
