import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import type { StatKey, Stats } from '../game/types'

interface StatsBarProps {
  stats: Stats
  /** ниже этого значения полоска краснеет и светится тревожно */
  lowBelow: number
}

const BARS: { key: StatKey; icon: string; label: string; color: string }[] = [
  { key: 'fullness', icon: '🍔', label: 'Сытость', color: '#ffb84d' },
  { key: 'happiness', icon: '💛', label: 'Счастье', color: '#ff7ab8' },
  { key: 'energy', icon: '⚡', label: 'Энергия', color: '#7ec8f0' },
  { key: 'cleanliness', icon: '🫧', label: 'Чистота', color: '#8ee6b8' },
]

export default function StatsBar({ stats, lowBelow }: StatsBarProps) {
  const fillRefs = useRef<(HTMLDivElement | null)[]>([])

  // GSAP плавно доводит полоски до нового значения
  useLayoutEffect(() => {
    BARS.forEach(({ key }, i) => {
      const el = fillRefs.current[i]
      if (!el) return
      gsap.to(el, { width: `${Math.round(stats[key])}%`, duration: 0.7, ease: 'power3.out', overwrite: 'auto' })
    })
  }, [stats])

  return (
    <section className="stats" aria-label="Показатели">
      {BARS.map(({ key, icon, label, color }, i) => {
        const value = Math.round(stats[key])
        return (
          <div className={value < lowBelow ? 'stat low' : 'stat'} key={key}>
            <span className="stat-label">
              {icon} {label}
            </span>
            <div className="stat-track">
              <div
                className="stat-fill"
                role="meter"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={label}
                ref={(el) => {
                  fillRefs.current[i] = el
                }}
                style={{ background: `linear-gradient(90deg, ${color}aa, ${color})` }}
              />
            </div>
            <span className="stat-value">{value}</span>
          </div>
        )
      })}
    </section>
  )
}
