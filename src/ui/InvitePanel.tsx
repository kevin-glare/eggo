import { useStrings } from './i18n'

interface InvitePanelProps {
  /** сколько друзей пришло (с сервера); null — счётчик ещё не приходил */
  invited: number | null
  /** сколько звёздочек платит за каждого друга (config.shop.referralStarsPerFriend) */
  perFriend: number
  onShare: () => void
}

/**
 * Панель «Позови друга»: объясняет звёзды дружбы — за каждого друга питомцу
 * звезда на боку и звёздочки в кошелёк — и кнопку шеря со ссылкой-приглашением.
 * Подэкран экрана меню; выход — «← Назад» и системная кнопка Telegram.
 */
export default function InvitePanel({ invited, perFriend, onShare }: InvitePanelProps) {
  const str = useStrings()
  return (
    <section className="invite" aria-label={str.inviteAria}>
      <div className="invite-head">
        <div className="invite-text">
          <p className="invite-title">{str.inviteTitle}</p>
          <p className="invite-sub">{str.inviteSub}</p>
        </div>
      </div>
      <p className="invite-count">{str.invitePerFriend(perFriend)}</p>
      {invited !== null && <p className="invite-count">{str.inviteCount(invited)}</p>}
      <button type="button" className="invite-share" onClick={onShare}>
        {str.inviteShare}
      </button>
    </section>
  )
}
