/**
 * Русские строки интерфейса. Форма этого объекта — контракт i18n:
 * en.ts обязан повторить её один в один (type Strings), иначе tsc не соберётся.
 * Интерполяция и плюрализация — функции вместо шаблонов с подстановкой.
 */
import type { ActionReason } from '../../game/actions'
import type { QuestId } from '../../game/quests'

/** Русская плюрализация: 1 день, 3 дня, 14 дней. */
function pluralDays(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня'
  return 'дней'
}

/** Русская плюрализация: 1 неделю, 2 недели, 5 недель. */
function pluralWeeks(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'неделю'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'недели'
  return 'недель'
}

export const ru = {
  // --- главный экран ---
  loading: 'Загружаем питомца…',
  ageLabel: 'Возраст:',
  streakTitle: 'Дней подряд',
  stage: {
    egg: '🥚 Яйцо',
    baby: '🐣 Малыш',
    child: '🐤 Ребёнок',
    teen: '🐓 Подросток',
    adult: '🐥 Взрослый',
  },
  mood: {
    happy: '🤩 Счастлив',
    content: '😌 Спокоен',
    sad: '😢 Грустит',
    sick: '🤒 Болеет — нужен уход',
    sleeping: '😴 Спит',
  },
  formatAge: (ageMs: number): string => {
    const minutes = Math.floor(ageMs / 60_000)
    if (minutes < 60) return `${minutes} мин`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} ч ${minutes % 60} мин`
    return `${Math.floor(hours / 24)} дн ${hours % 24} ч`
  },

  // --- тосты и причины отказов (usePet) ---
  petFallbackName: 'Питомец',
  reason: {
    'not-hatched': '🥚 Питомец ещё не вылупился',
    sleeping: '🤫 Питомец спит',
    'too-tired': '😵 Слишком устал — пусть поспит',
    'already-full': '😋 Уже сыт — не лопнет',
    'already-happy': '😄 Уже счастлив по полной',
    'already-clean': '✨ Уже сияет чистотой',
    'already-named': '🏷️ Имя уже есть — другое не дать',
    'invalid-name': '✏️ От 1 до 16 символов',
  } as Record<ActionReason, string>,
  actionSuccess: { feed: '🍗 Ням-ням!', play: '😄 Было весело!', wash: '🛁 Чистота!', pet: '💗 Мур-мур!' },
  sleepStart: '😴 Спокойной ночи!',
  sleepWake: '☀️ Проснулся!',
  missYou: (name: string) => `💗 ${name} скучал по тебе!`,
  hatched: (name: string) => `🎉 ${name} вылупился!`,
  named: (name: string) => `🎉 ${name} — отличное имя!`,
  eggAppeared: '🥚 Появилось яйцо!',
  daysInRow: (n: number) => `🔥 ${n} ${pluralDays(n)} подряд!`,
  weeksOfFriendship: (n: number) => `🎂 ${n} ${pluralWeeks(n)} дружбы!`,
  claimReward: (bonus: number) => `🎁 Задания дня выполнены: +${bonus} к счастью!`,
  claimAlready: '🎁 Награда уже получена',
  claimNotReady: '🎯 Сначала выполни задания дня',
  newGame: '🥚 Новая игра — дай имя!',

  // --- экран создания питомца ---
  create: {
    headline: 'Как назовём питомца?',
    sub: 'Питомец вылупится, когда получит имя',
    namePlaceholder: 'Имя питомца',
    nameButton: 'Дать имя',
    pitch: 'Корми, играй и смотри, как он растёт',
  },

  // --- панели: действия, статы, задания ---
  actionsAria: 'Действия',
  action: { feed: 'Покормить', play: 'Играть', wash: 'Помыть', wake: 'Разбудить', sleep: 'Спать' },
  statsAria: 'Показатели',
  stat: { fullness: 'Сытость', happiness: 'Счастье', energy: 'Энергия', cleanliness: 'Чистота' },
  questsAria: 'Задания дня',
  quest: {
    feed: 'Покормить',
    play: 'Поиграть',
    wash: 'Помыть',
    pet: 'Погладить',
  } as Record<QuestId, string>,
  questExplainDone: (label: string, t: number) =>
    `✅ «${label}» — ${t}/${t} сегодня. Задания считают заботу, а статы падают сами.`,
  questExplainProgress: (label: string, p: number, t: number) => `🎯 «${label}» — ${p}/${t} сегодня.`,
  questCellAria: (label: string, p: number, t: number) => `Задание «${label}»: ${p} из ${t} сегодня`,
  questClaim: 'Получить',
  questClaimed: 'Получено',
  questClaimAria: 'Получить награду дня',
  questClaimedAria: 'Награда получена',

  // --- подсказки сценок (PetCanvas) ---
  sceneHint: { feed: 'Тапай по еде!', wash: 'Води пальцем по питомцу', play: 'Тапай по мячу!' },

  // --- переключатель пушей (useNotifications) ---
  notifOn: '🔔 Уведомления включены',
  notifOff: '🔕 Уведомления выключены',
  notifBlocked: '✋ Открой чат с ботом и нажми «Запустить», потом попробуй снова',
  notifError: '⚠️ Не получилось — попробуй ещё раз',

  // --- шапка: поделиться и написать автору ---
  shareText: (stage: string, days: number) =>
    `Мой Eggo с нами уже ${days} ${pluralDays(days)}! Стадия: ${stage}. Заведи своего 🥚`,
  shareAria: 'Поделиться питомцем',
  authorAria: 'Написать автору',

  // --- заглушка вне Telegram ---
  gate: {
    title: 'Eggo живёт в Telegram',
    textInTg:
      'Открой чат с ботом и запусти Eggo кнопкой меню — она слева от поля ввода сообщения. По ссылке из чата игра не открывается.',
    textOutside:
      'Питомец привязан к Telegram — так он сохраняется на сервере и ждёт тебя на любом устройстве. Открой мини-апп через бота.',
    button: 'Войти через Telegram',
    debugNoSdk: 'нет SDK',
    debugYes: 'есть',
    debugNo: 'нет',
  },

  // --- dev-панель ---
  dev: {
    timeBadge: (n: number) => `⚡ время ×${n}`,
    plusHour: '+1 час',
    plusDay: '+1 день',
    skyButton: (label: string) => `Небо: ${label}`,
    skyAuto: 'авто',
    skyMorning: '🌅 утро',
    skyDay: '☀️ день',
    skyEvening: '🌆 вечер',
    skyNight: '🌙 ночь',
    reset: 'Сброс',
    resetConfirm: 'Начать новую игру?',
  },
}

export type Strings = typeof ru
