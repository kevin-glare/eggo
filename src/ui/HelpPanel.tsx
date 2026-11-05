import { useStrings } from './i18n'

/**
 * Карточка «Как играть»: все механики по разделам — забота, кормление-ловля,
 * мини-игры, бонусы, настройки. Живёт подэкраном меню; выход — «← Назад»
 * и системная кнопка Telegram.
 */
export default function HelpPanel() {
  const str = useStrings()
  return (
    <section className="help" aria-label={str.menuHelp}>
      <div className="help-head">
        <p className="help-title">{str.helpTitle}</p>
      </div>
      {str.helpSections.map((section) => (
        <div className="help-group" key={section.title}>
          <p className="help-group-title">{section.title}</p>
          <ul className="help-lines">
            {section.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
