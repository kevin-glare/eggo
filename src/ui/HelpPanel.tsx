import { getStrings } from './i18n'

const str = getStrings()

interface HelpPanelProps {
  onClose: () => void
}

/**
 * Карточка «Как играть»: короткие правила — забота, просьбы, квесты, стрик,
 * звёзды за друзей, сон. В языке панели приглашения; закрывается ✕.
 */
export default function HelpPanel({ onClose }: HelpPanelProps) {
  return (
    <section className="help" aria-label={str.menuHelp}>
      <div className="help-head">
        <p className="help-title">{str.helpTitle}</p>
        <button type="button" className="tool-btn" onClick={onClose} aria-label={str.menuClose}>
          ✕
        </button>
      </div>
      <ul className="help-lines">
        {str.helpLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  )
}
