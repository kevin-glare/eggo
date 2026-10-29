// Яндекс.Метрика: невидимый счётчик, грузится только в прод-сборке
// (import.meta.env.PROD), в dev-сервере и тестах — тихо.

const METRIKA_ID = 113874165
const SCRIPT_URL = `https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}`

type YmCall = [id: number, method: string, params?: Record<string, unknown>]
type YmFn = ((...args: YmCall) => void) & { a?: YmCall[]; l?: number }

export function initMetrika(): void {
  if (!import.meta.env.PROD) return
  if (document.querySelector(`script[src="${SCRIPT_URL}"]`)) return

  // очередная заглушка: tag.js при загрузке подхватит накопившиеся вызовы
  const ym: YmFn = (...args) => {
    ym.a = [...(ym.a ?? []), args]
  }
  ym.l = Date.now()
  ;(window as Window & { ym?: YmFn }).ym = ym

  const script = document.createElement('script')
  script.async = true
  script.src = SCRIPT_URL
  document.head.appendChild(script)

  ym(METRIKA_ID, 'init', {
    ssr: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  })
}
