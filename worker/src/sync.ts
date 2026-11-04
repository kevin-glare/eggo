import { rollAppearance } from '../../src/game/appearance'
import { DEFAULT_CONFIG } from '../../src/game/config'
import { deserialize, mergeStates, serialize } from '../../src/game/storage'
import type { PetState } from '../../src/game/types'

/**
 * Решение о слиянии сейвов при /sync. Обе стороны досчитываются до общей
 * временной шкалы, статы и возраст берутся по максимуму, событийные поля —
 * у более свежего события игрока (mergeStates): действие с одного девайса
 * не затирается тиками с другого.
 */

export interface SyncDecision {
  /** главный сейв — что сервер сохранит в базу и вернёт клиенту */
  raw: string | null
  /** стадия итогового сейва: крон по нему заметит взросление */
  stage: PetState['stage'] | null
}

/** запасная внешность для очень старых сейвов — общая для воркера */
export const FALLBACK_APPEARANCE = rollAppearance(() => 0)

export function resolveSync(clientRaw: string | null, serverRaw: string | null): SyncDecision {
  // кросс-подстановка внешности: сейв без «генов» получает гены второй стороны
  const serverFirst = serverRaw === null ? null : deserialize(serverRaw, FALLBACK_APPEARANCE)
  const client = clientRaw === null ? null : deserialize(clientRaw, serverFirst?.appearance ?? FALLBACK_APPEARANCE)
  const server = serverRaw === null ? null : deserialize(serverRaw, client?.appearance ?? FALLBACK_APPEARANCE)

  if (!client) {
    return { raw: serverRaw, stage: server ? server.stage : null }
  }
  // свежее безымянное яйцо с нового устройства не должно побеждать
  // именованного питомца — сейв в базе не трогаем
  if (client.name === null && server?.name != null) {
    return { raw: serverRaw, stage: server.stage }
  }
  // битой строке в базе не доверяем — клиент чинит своим сейвом
  if (!server) {
    return { raw: clientRaw, stage: client.stage }
  }
  const merged = mergeStates(client, server, DEFAULT_CONFIG)
  return { raw: serialize(merged), stage: merged.stage }
}
