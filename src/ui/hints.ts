/**
 * Одноразовые подсказки сценок: показываем, пока игрок ни разу не выполнил
 * интерактив сам. Флаги живут в localStorage — это UI-удобство, не игровой
 * сейв: на новом устройстве подсказки просто покажутся снова.
 */

const PREFIX = 'eggo.hint.'

export type HintKind = 'feed' | 'wash' | 'play'

export function isHintDone(kind: HintKind): boolean {
  try {
    return window.localStorage.getItem(PREFIX + kind) === 'done'
  } catch {
    return true // хранилище недоступно — не мешаем подсказками
  }
}

export function markHintDone(kind: HintKind): void {
  try {
    window.localStorage.setItem(PREFIX + kind, 'done')
  } catch {
    // без хранилища подсказка будет показываться снова — не страшно
  }
}
