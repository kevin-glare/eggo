import { getStrings } from './i18n'

const str = getStrings()

/**
 * Карточка «Как играть»: короткие правила — забота, просьбы, квесты, стрик,
 * звёзды за друзей, сон. Живёт подэкраном меню; выход — «← Назад» и
 * системная кнопка Telegram.
 */
export default function HelpPanel() {
  return (
    <section className="help" aria-label={str.menuHelp}>
      <div className="help-head">
        <p className="help-title">{str.helpTitle}</p>
      </div>
      <ul className="help-lines">
        {str.helpLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  )
}
