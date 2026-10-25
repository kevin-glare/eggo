import type { StatKey, Stats } from '../game/types'

interface StatsBarProps {
  stats: Stats
  /** ниже этого значения полоска становится тревожно-красной */
  lowBelow: number
}

const BARS: { key: StatKey; icon: string; label: string; color: string }[] = [
  { key: 'fullness', icon: '🍔', label: 'Сытость', color: '#ffb84d' },
  { key: 'happiness', icon: '💛', label: 'Счастье', color: '#ff7ab8' },
  { key: 'energy', icon: '⚡', label: 'Энергия', color: '#7ec8f0' },
  { key: 'cleanliness', icon: '🫧', label: 'Чистота', color: '#8ee6b8' },
]

export default function StatsBar({ stats, lowBelow }: StatsBarProps) {
  return (
    <section className="stats" aria-label="Показатели">
      {BARS.map(({ key, icon, label, color }) => {
        const value = Math.round(stats[key])
        const low = value < lowBelow
        return (
          <div className="stat" key={key}>
            <span className="stat-label">
              {icon} {label}
            </span>
            <div className="stat-track">
              <div
                className="stat-fill"
                style={{ width: `${value}%`, background: low ? '#ff5a5a' : color }}
              />
            </div>
            <span className="stat-value">{value}</span>
          </div>
        )
      })}
    </section>
  )
}
