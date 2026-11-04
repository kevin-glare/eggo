import { useStrings } from './i18n'

interface InvitePanelProps {
  /** сколько друзей пришло (с сервера); null — счётчик ещё не приходил */
  invited: number | null
  /** сколько звёзд дружбы уже заработано */
  stars: number
  /** пороги приглашённых из config.referrals.milestones */
  milestones: number[]
  onShare: () => void
}

/**
 * Панель «Позови друга»: объясняет звёзды дружбы, показывает пороги
 * и большую кнопку шеря со ссылкой-приглашением. Подэкран экрана меню;
 * выход — «← Назад» и системная кнопка Telegram.
 */
export default function InvitePanel({ invited, stars, milestones, onShare }: InvitePanelProps) {
  const str = useStrings()
  return (
    <section className="invite" aria-label={str.inviteAria}>
      <div className="invite-head">
        <div className="invite-text">
          <p className="invite-title">{str.inviteTitle}</p>
          <p className="invite-sub">{str.inviteSub}</p>
        </div>
      </div>
      <div className="invite-stars">
        {milestones.map((m, i) => (
          <span key={m} className={i < stars ? 'invite-star got' : 'invite-star'} title={str.inviteMilestone(m)}>
            ✨ {m}
          </span>
        ))}
      </div>
      {invited !== null && <p className="invite-count">{str.inviteCount(invited)}</p>}
      <button type="button" className="invite-share" onClick={onShare}>
        {str.inviteShare}
      </button>
    </section>
  )
}
