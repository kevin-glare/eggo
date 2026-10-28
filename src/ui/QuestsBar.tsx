import type { QuestId } from '../game/quests'
import type { DailyQuests } from '../game/quests'

interface QuestsBarProps {
  daily: DailyQuests
  targets: Record<QuestId, number>
  onClaim: () => void
}

const QUEST_ICONS: Record<QuestId, string> = { feed: '🍔', play: '🎮', wash: '🛁', pet: '💗' }
const QUEST_LABELS: Record<QuestId, string> = {
  feed: 'Покормить',
  play: 'Поиграть',
  wash: 'Помыть',
  pet: 'Погладить',
}

/**
 * Полоска заданий дня: иконка и прогресс по каждому; когда все полные —
 * кнопка «Забрать» оживает. До готовности она кликабельна: движок
 * откажет с подсказкой (как и остальные действия).
 */
export default function QuestsBar({ daily, targets, onClaim }: QuestsBarProps) {
  const complete = daily.quests.every((q, i) => (daily.progress[i] ?? 0) >= targets[q])
  return (
    <section className="quests" aria-label="Задания дня">
      {daily.quests.map((q, i) => {
        const p = daily.progress[i] ?? 0
        const done = p >= targets[q]
        return (
          <div className={done ? 'quest done' : 'quest'} key={q} title={QUEST_LABELS[q]}>
            <span className="qicon" aria-hidden="true">
              {QUEST_ICONS[q]}
            </span>
            <span className="qcount">{done ? '✓' : `${p}/${targets[q]}`}</span>
            <span className="qsr">{QUEST_LABELS[q]}</span>
          </div>
        )
      })}
      <button
        type="button"
        className={complete && !daily.claimed ? 'claim ready' : 'claim'}
        onClick={onClaim}
        aria-label={daily.claimed ? 'Награда забрана' : 'Забрать награду дня'}
      >
        {daily.claimed ? '🎁 Забрано' : '🎁 Забрать'}
      </button>
    </section>
  )
}
