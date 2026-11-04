import { useStrings } from './i18n'

/**
 * Карточка «Как играть»: короткие правила — забота, просьбы, квесты, стрик,
 * звёзды за друзей, сон. Живёт подэкраном меню; выход — «← Назад» и
 * системная кнопка Telegram.
 */
export default function HelpPanel() {
  const str = useStrings()
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
