/**
 * Русские строки интерфейса. Форма этого объекта — контракт i18n:
 * en.ts обязан повторить её один в один (type Strings), иначе tsc не соберётся.
 * Интерполяция и плюрализация — функции вместо шаблонов с подстановкой.
 */
import type { ActionReason } from '../../game/actions'
import type { QuestId } from '../../game/quests'
import type { MinigameId } from '../../game/minigames/types'

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

/** Русская плюрализация: 1 звезда, 2 звезды, 5 звёзд. */
function pluralStars(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'звезда'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'звезды'
  return 'звёзд'
}

export const ru = {
  // --- главный экран ---
  loading: 'Загружаем питомца…',
  ageLabel: 'Возраст:',
  streakConverted: '⭐ Накопленные огоньки стали звёздочками!',
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
    sleeping: '🤫 Питомец спит — сначала разбуди его',
    'too-tired': '😵 Слишком устал — пусть поспит',
    'already-full': '😋 Уже сыт — не лопнет',
    'already-happy': '😄 Уже счастлив по полной',
    'already-clean': '✨ Уже сияет чистотой',
    'already-named': '🏷️ Имя уже есть — другое не дать',
    'invalid-name': '✏️ От 1 до 16 символов',
    'no-stars': '⭐ Не хватает звёздочек',
    overfed: '😴 Объелся — отдыхает, покормишь позже',
  } as Record<ActionReason, string>,
  actionSuccess: { feed: '🍗 Ням-ням!', play: '😄 Было весело!', wash: '🛁 Чистота!', pet: '💗 Мур-мур!' },
  sleepStart: '😴 Спокойной ночи!',
  sleepWake: '☀️ Проснулся!',
  missYou: (name: string) => `💗 ${name} скучал по тебе!`,
  hatched: (name: string) => `🎉 ${name} вылупился!`,
  named: (name: string) => `🎉 ${name} — отличное имя!`,
  eggAppeared: '🥚 Появилось яйцо!',
  daysInRow: (n: number, stars: number) =>
    stars > 0 ? `📅 ${n} ${pluralDays(n)} подряд — +${stars} ⭐!` : `📅 ${n} ${pluralDays(n)} подряд!`,
  weeksOfFriendship: (n: number) => `🎂 ${n} ${pluralWeeks(n)} дружбы!`,
  claimReward: (bonus: number) => `🎁 Задания дня выполнены: +${bonus} ⭐ в кошелёк!`,
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
  action: { feed: 'Покормить', play: 'Играть', wash: 'Помыть', wake: 'Разбудить', sleep: 'Спать', shop: 'Магазин' },
  statsAria: 'Показатели',
  stat: { fullness: 'Сытость', happiness: 'Счастье', energy: 'Энергия', cleanliness: 'Чистота' },
  questsAria: 'Задания дня',
  quest: {
    feed: 'Покормить',
    play: 'Поиграть',
    wash: 'Помыть',
    pet: 'Погладить',
    gameOfDay: 'Сыграть в игру дня',
    catchStar: 'Поймать звёздочку',
    shopVisit: 'Заглянуть в магазин',
    sleep: 'Уложить спать',
  } as Record<QuestId, string>,
  questExplainDone: (label: string, t: number) =>
    `✅ «${label}» — ${t}/${t} сегодня. Задания считают заботу, а статы падают сами.`,
  questExplainProgress: (label: string, p: number, t: number) => `🎯 «${label}» — ${p}/${t} сегодня.`,
  questCellAria: (label: string, p: number, t: number) => `Задание «${label}»: ${p} из ${t} сегодня`,
  questClaim: 'Забрать',
  questClaimed: 'Получено',
  questClaimAria: 'Получить награду дня',
  questClaimedAria: 'Награда получена',

  // --- подсказки сценок (PetCanvas) ---
  sceneHint: { feedCatch: 'Тапай — Эгго побежит за едой!', wash: 'Води пальцем по питомцу', stars: '⭐ За заботу дают звёздочки!' },

  // --- мини-игры (кнопка «Играть») ---
  mgPause: 'Пауза',
  mgResume: 'Продолжить',
  mgExit: 'Выйти',
  mgStart: 'Старт',
  mgAgain: 'Ещё раз',
  mgDone: 'Готово',
  mgBest: (n: number) => `Рекорд: ${n}`,
  mgNewRecord: '🏆 Новый рекорд!',
  mgBonus: (n: number) => `Эгго в восторге: +${n} к счастью`,
  mgStars: (n: number) => `⭐ +${n} за партию`,
  mgGameOver: 'Игра окончена',
  mgRecordToast: (n: number) => `🏆 Новый рекорд: ${n}!`,
  mgTime: (s: number) => `${s} с`,
  mgMatched: 'пара собрана',
  mgCardHidden: 'Закрытая карточка',
  mgPairsLeft: (n: number) => `Осталось пар: ${n}`,
  mgLevel: (n: number) => `Ряд ${n}`,
  game: {
    memory: { title: '🧠 Память', hint: 'Открывай карточки и находи пары — собранный ряд добавляет время, но таймер тикает быстрее' },
    runner: { title: '🏃 Побег', hint: 'Тап сверху — прыжок. Держи низ экрана — пригнёшься' },
    flappy: { title: '🎈 Полёт', hint: 'Тапай в любом месте — питомец взмахнёт' },
    snake: { title: '🐍 Змейка', hint: 'Свайпы или стрелки — собирай еду; не залезай на себя и не врезайся в стены' },
    bubbles: { title: '🫧 Пузыри', hint: 'Лопай группы от трёх — большие группы дают бонус' },
  } as Record<MinigameId, { title: string; hint: string }>,
  // подписи прямо на канвасе в первые секунды партии
  mgHint: {
    runnerJump: '👆 Тап — прыжок',
    runnerDuck: '👇 Держи низ — пригнуться',
    flappy: '👆 Тап — взмах',
    snake: '👉 Свайп или стрелки — поворот',
    bubbles: '👆 Лопай группы от трёх',
  },

  // --- выбор мини-игры ---
  pickTitle: 'Во что играем?',
  pickRandom: 'Случайная',
  pickDayTitle: 'Игра дня — новый рекорд даёт двойной бонус',
  renameAria: 'Переименовать питомца',
  renameSave: 'Сохранить имя',
  renameCancel: 'Не менять имя',
  renamePriceHint: (n: number) => `⭐ ${n} за смену имени`,

  // --- уровень дружбы ---
  friendshipTitles: ['Знакомый', 'Приятель', 'Товарищ', 'Друг', 'Лучший друг', 'Родная душа'],
  levelUp: (title: string) => `💖 Дружба крепнет: вы теперь «${title}»!`,

  // --- достижения: ключи = стабильные id из game/achievements ---
  menuAchievements: 'Достижения',
  achievementsCount: (n: number, total: number) => `${n} из ${total}`,
  achievementUnlocked: (title: string) => `🏅 Достижение: ${title}!`,
  achievements: {
    'streak-7': { title: '📅 Неделя в ритме' },
    'streak-14': { title: '📅 Две недели подряд' },
    'streak-30': { title: '📅 Месяц заботы' },
    'age-7': { title: '🎂 Недельный питомец' },
    'age-30': { title: '🎂 Месяц вместе' },
    'score-100': { title: '🎯 Сотня очков' },
    'all-games': { title: '🎮 Попробовал всё' },
    'weeks-2': { title: '✨ Две недели дружбы' },
    'weeks-6': { title: '✨ Полтора месяца дружбы' },
    'ref-1': { title: '🤝 Первый друг' },
    'ref-3': { title: '🤝 Компания друзей' },
    'lvl-3': { title: '💖 Крепкая дружба' },
    'lvl-5': { title: '💖 Неразлучные' },
    'stars-100': { title: '🌟 Сотня звёздочек' },
    'stars-300': { title: '🌟 Звёздный капитал' },
  } as Record<string, { title: string }>,

  // --- магазин ---
  menuShop: 'Магазин',
  shopDishes: 'Еда',
  shopAccessories: 'Аксессуары',
  shopDecor: 'Декор сцены',
  shopServices: 'Помощники',
  shopNameSection: 'Имя питомца',
  shopRenameTitle: 'Сменить имя',
  renameDone: '✏️ Имя сменено!',
  shopActive: 'Подано',
  shopOwned: 'Куплено',
  shopBought: (title: string) => `🛍 Куплено: ${title}`,
  shopNoStars: '⭐ Не хватает звёздочек — заботься дальше!',
  shopDishActive: '🍽 Сначала покормите — блюдо уже подано',
  shopStarsHint: '⭐ Звёздочки дают мини-игры, задания дня и друзья — трать их в магазине',
  walletAria: 'Кошелёк звёздочек',
  whatsNewText: '⭐ В Eggo звёздочки! За партии в мини-игры, задания дня, каждый день серии и друзей — трать их в магазине',
  whatsNewOpen: '🛍 Открыть магазин',
  serviceLeft: (h: number) => `ещё ${h} ч`,
  serviceHealthy: '💚 Питомец здоров — витамин не нужен',
  svcFeed: 'Автокормушка — кормит сама сутки',
  svcWash: 'Автомойка — моет сама сутки',
  svcSleep: 'Автосон — укладывает сам, когда зевает',
  svcVitamin: 'Витамин — лечит сразу',
  svcNanny: 'Няня на сутки — все три сервиса',
  shopItem: {
    'dish-cake': { title: 'Торт — сытнее за один сеанс кормления' },
    'dish-feast': { title: 'Пир — сытнее всего за один сеанс' },
    'acc-cap': { title: 'Кепка — видавший виды головной убор' },
    'acc-bandana': { title: 'Шарф-бандана — стиль в любую погоду' },
    'acc-glasses': { title: 'Очки — умный взгляд питомца' },
    'acc-crown': { title: 'Корона — для королевской особы' },
    'dec-flower': { title: 'Цветы — украсят луг слева от питомца' },
    'dec-mushroom': { title: 'Гриб — лесной гость на полянке' },
    'dec-house': { title: 'Домик — уютное жилище на лугу' },
    'dec-boat': { title: 'Лодка — качается на волнах моря' },
  } as Record<string, { title: string }>,
  wear: 'Надеть',
  remove: 'Снять',

  // --- просьбы питомца ---
  requestHint: '💡 Эгго что-то просит! Успей — эффект будет двойным',
  requestBonus: (name: string) => `✨ Просьба выполнена — ${name} в восторге!`,

  // --- события на сцене ---
  eventHint: '✨ На полянке что-то появилось — тапни, чтобы поймать!',
  eventStar: (n: number) => `⭐ +${n} — звёздочка поймана!`,
  eventButterfly: (n: number) => `🦋 Эгго любуется бабочкой: +${n} к счастью`,
  eventBubbles: (n: number) => `🫧 Пузырьки лопнуты: +${n} к чистоте`,

  // --- кормление-ловля ---
  overfed: '🤢 Эгго объелся! Теперь немного отдохнёт',

  // --- переключатель пушей (useNotifications) ---
  notifOn: '🔔 Уведомления включены',
  notifOff: '🔕 Уведомления выключены',
  notifBlocked: '✋ Открой чат с ботом и нажми «Запустить», потом попробуй снова',
  notifError: '⚠️ Не получилось — попробуй ещё раз',

  // --- шапка: поделиться и написать автору ---
  shareText: (stage: string, days: number) =>
    `Мой Eggo с нами уже ${days} ${pluralDays(days)}! Стадия: ${stage}. Заведи своего 🥚`,
  authorAria: 'Написать автору',

  // --- панель «Позови друга» ---
  inviteAria: 'Позови друга',
  inviteTitle: 'Позови друга!',
  inviteSub: 'Друг запустит Eggo по твоей ссылке — питомцу звезда дружбы и звёздочки ✨',
  invitePerFriend: (n: number) => `⭐ +${n} за каждого друга`,
  inviteCount: (n: number) => `Уже позвал: ${n}`,
  inviteShare: 'Поделиться ссылкой',
  inviteReward: (n: number, stars: number) =>
    stars > 0
      ? `✨ У питомца ${n} ${pluralStars(n)} дружбы и +${stars} ⭐ — спасибо!`
      : `✨ У питомца ${n} ${pluralStars(n)} дружбы — спасибо!`,

  // --- экран меню ---
  menuAria: 'Меню',
  menuClose: 'Закрыть',
  menuBack: 'Назад',
  menuSettings: 'Настройки',
  menuNotifOn: 'Уведомления включены',
  menuNotifOff: 'Уведомления выключены',
  menuSoundOn: 'Звук включён',
  menuSoundOff: 'Звук выключен',
  menuLang: 'Язык',
  menuHelp: 'Как играть',
  menuVersion: 'версия',
  helpTitle: 'Как играть',
  helpSections: [
    {
      title: 'Забота',
      lines: [
        '🍔 Корми, играй и мой — шкалы падают сами, за ними и следим',
        '😴 На ночь укладывай спать — энергия вернётся к утру',
        '🤒 Заболел? Вылечит хороший уход: все шкалы в порядке',
        '💡 Эгго что-то просит? Успей за окно — эффект будет двойным',
      ],
    },
    {
      title: 'Кормление-ловля',
      lines: [
        '👆 Тапай по экрану — питомец побежит и поймает еду ртом',
        '🥫 Банки — не еда: питомцу от них плохо, и серия дней сбивается',
        '🤢 Объелся? Питомец немного отдохнёт и снова будет готов к еде',
      ],
    },
    {
      title: 'Мини-игры',
      lines: [
        '🎮 Кнопка «Играть» запускает одну из пяти: память, побег, полёт, змейка, пузыри',
        '🏃 Побег: тап сверху — прыжок, держи низ — пригнёшься',
        '⭐ Любая доигранная партия — звёздочка, даже без рекорда',
        '🎯 Игра дня меняется каждый день: за рекорд в ней звёздочки удваиваются',
        '🏆 Победа радует питомца, рекорды сохраняются даже на новом устройстве',
      ],
    },
    {
      title: 'Звёздочки',
      lines: [
        '⭐ Звёздочки — валюта Eggo: счётчик виден в шапке экрана',
        '🎮 Партия в мини-игре — звёздочка, новый рекорд — ещё пара сверху',
        '🎯 Выполни все задания дня и забери награду — звёздочки твои',
        '📅 Каждый день захода продлевает серию и приносит звёздочку',
        '✨ Друг запустит Eggo по твоей ссылке — звёздочки за каждого нового друга',
      ],
    },
    {
      title: 'Магазин',
      lines: [
        '🛍 Кнопка «Магазин» на главном экране: там тратят звёздочки',
        '🍰 Блюда — премиум-еда на один сеанс кормления, обычная еда бесплатна',
        '🧢 Аксессуары надеваются на питомца, 🌸 декор украшает полянку',
        '🔧 Помощники — сутки сами кормят, моют и укладывают спать',
        '✏️ Сменить имя питомца можно прямо в магазине',
      ],
    },
    {
      title: 'Настройки',
      lines: ['🔊 Звук и язык переключаются в меню', '🔔 Пуш подскажет, что случилось и что делать'],
    },
  ],

  // --- заглушка вне Telegram ---
  gate: {
    title: 'Eggo живёт в Telegram',
    textInTg:
      'Открой чат с ботом и запусти Eggo кнопкой меню — она слева от поля ввода сообщения. По ссылке из чата игра не открывается.',
    textOutside:
      'Питомец привязан к Telegram — так он сохраняется на сервере и ждёт тебя на любом устройстве. Открой мини-апп через бота.',
    // Фишки на заглушке: для новичков — быстрый ответ «что за игра»,
    // для поисковиков — единственный индексируемый контент сайта
    features: [
      '🍽️ Кормите и ухаживайте — питомец растёт',
      '🎮 Мини-игры, квесты и звёзды каждый день',
      '🐣 Вылупляется из яйца и проходит 5 стадий роста',
    ],
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
