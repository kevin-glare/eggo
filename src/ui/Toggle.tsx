interface ToggleProps {
  /** включён ли тумблер */
  on: boolean
  /** подпись для скринридеров */
  label: string
}

/** Тумблер настроек в меню: роль switch — состояние видно и глазами, и скринридеру. */
export default function Toggle({ on, label }: ToggleProps) {
  return (
    <span className={on ? 'toggle on' : 'toggle'} role="switch" aria-checked={on} aria-label={label}>
      <span className="toggle-knob" aria-hidden="true" />
    </span>
  )
}
