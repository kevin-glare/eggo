import type { QuestId } from '../game/quests'
import type { DailyQuests } from '../game/quests'

interface QuestsBarProps {
  daily: DailyQuests
  targets: Record<QuestId, number>
  onClaim: () => void
  /** пояснение по тапу на колонку (тост) */
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
 * Задания дня — одна карточка с четырьмя колонками, в языке панели статов:
 * иконка + подпись сверху, счётчик «2/3» снизу. Последняя колонка — награда:
 * тусклая, пока задания не выполнены, золотая и кликабельная когда готова,
 * «Получено» после забора. До готовности кликабельна — движок откажет
 * с подсказкой (как и остальные действия).
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
            className={done ? 'qcell done' : 'qcell'}
            key={q}
            onClick={() => explain(q, p)}
            aria-label={`Задание «${QUEST_LABELS[q]}»: ${p} из ${t} сегодня`}
          >
            <span className="qtop">
              <span className="qicon" aria-hidden="true">
                {QUEST_ICONS[q]}
              </span>
              <span className="qlabel">{QUEST_LABELS[q]}</span>
            </span>
            <span className="qcount">{p}/{t}</span>
          </button>
        )
      })}
      <button
        type="button"
        className={daily.claimed ? 'qcell claim claimed' : complete ? 'qcell claim ready' : 'qcell claim'}
        onClick={onClaim}
        aria-label={daily.claimed ? 'Награда получена' : 'Получить награду дня'}
      >
        <span className="qicon" aria-hidden="true">
          🎁
        </span>
        <span className="qword">{daily.claimed ? 'Получено' : 'Получить'}</span>
      </button>
    </section>
  )
}
