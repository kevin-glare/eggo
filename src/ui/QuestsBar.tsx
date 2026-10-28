import type { QuestId } from '../game/quests'
import type { DailyQuests } from '../game/quests'

interface QuestsBarProps {
  daily: DailyQuests
  targets: Record<QuestId, number>
  onClaim: () => void
  /** пояснение по тапу на чип (тост) */
  onExplain: (text: string) => void
}

const QUEST_ICONS: Record<QuestId, string> = { feed: '🍔', play: '🎮', wash: '🛁', pet: '💗' }
const QUEST_LABELS: Record<QuestId, string> = {
  feed: 'Покормить',
  play: 'Поиграть',
  wash: 'Помыть',
  pet: 'Погладить',
}

/**
 * Полоска заданий дня. Чип читается как задание (подпись + счётчик «2/3»),
 * а не как статус питомца: задания считают заботу за сегодня, а статы
 * падают сами. Кнопка «Забрать» до готовности кликабельна — движок
 * откажет с подсказкой (как и остальные действия).
 */
export default function QuestsBar({ daily, targets, onClaim, onExplain }: QuestsBarProps) {
  const complete = daily.quests.every((q, i) => (daily.progress[i] ?? 0) >= targets[q])
  const explain = (q: QuestId, p: number) => {
    const t = targets[q]
    onExplain(
      p >= t
        ? `✅ «${QUEST_LABELS[q]}» — ${t}/${t} сегодня. Задания считают заботу, а статы падают сами.`
        : `🎯 «${QUEST_LABELS[q]}» — ${p}/${t} сегодня.`,
    )
  }
  return (
    <section className="quests" aria-label="Задания дня">
      {daily.quests.map((q, i) => {
        const p = daily.progress[i] ?? 0
        const t = targets[q]
        const done = p >= t
        return (
          <button
            type="button"
            className={done ? 'quest done' : 'quest'}
            key={q}
            onClick={() => explain(q, p)}
            aria-label={`Задание «${QUEST_LABELS[q]}»: ${p} из ${t} сегодня`}
          >
            <span className="qicon" aria-hidden="true">
              {QUEST_ICONS[q]}
            </span>
            <span className="qmeta">
              <span className="qlabel">{QUEST_LABELS[q]}</span>
              <span className="qcount">{p}/{t}</span>
            </span>
          </button>
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
