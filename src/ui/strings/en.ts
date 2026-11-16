/**
 * Английские строки интерфейса. Тип Strings берётся от ru.ts —
 * пропущенный или лишний ключ поймает tsc при сборке.
 */
import type { Strings } from './ru'

export const en: Strings = {
  loading: 'Loading your pet…',
  ageLabel: 'Age:',
  streakConverted: '⭐ Your accumulated streak days became stars!',
  stage: {
    egg: '🥚 Egg',
    baby: '🐣 Baby',
    child: '🐤 Child',
    teen: '🐓 Teen',
    adult: '🐥 Adult',
  },
  mood: {
    happy: '🤩 Happy',
    content: '😌 Content',
    sad: '😢 Sad',
    sick: '🤒 Sick — needs care',
    sleeping: '😴 Sleeping',
  },
  formatAge: (ageMs: number): string => {
    const minutes = Math.floor(ageMs / 60_000)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} h ${minutes % 60} min`
    return `${Math.floor(hours / 24)} d ${hours % 24} h`
  },

  petFallbackName: 'Pet',
  reason: {
    'not-hatched': '🥚 The pet hasn’t hatched yet',
    sleeping: '🤫 The pet is sleeping — wake it up first',
    'too-tired': '😵 Too tired — let it sleep',
    'already-full': '😋 Already full — it would burst',
    'already-happy': '😄 Already happy to the brim',
    'already-clean': '✨ Already sparkling clean',
    'already-named': '🏷️ Already named — no renaming',
    'invalid-name': '✏️ 1 to 16 characters',
    'no-stars': '⭐ Not enough stars',
    overfed: '😴 Too full — resting, feed later',
  },
  actionSuccess: { feed: '🍗 Yum-yum!', play: '😄 That was fun!', wash: '🛁 Squeaky clean!', pet: '💗 Purr-purr!' },
  sleepStart: '😴 Good night!',
  sleepWake: '☀️ Woke up!',
  missYou: (name: string) => `💗 ${name} missed you!`,
  hatched: (name: string) => `🎉 ${name} hatched!`,
  named: (name: string) => `🎉 ${name} is a great name!`,
  eggAppeared: '🥚 An egg appeared!',
  daysInRow: (n: number, stars: number) =>
    stars > 0 ? `📅 ${n} ${n === 1 ? 'day' : 'days'} in a row — +${stars} ⭐!` : `📅 ${n} ${n === 1 ? 'day' : 'days'} in a row!`,
  weeksOfFriendship: (n: number) => `🎂 ${n} ${n === 1 ? 'week' : 'weeks'} of friendship!`,
  claimReward: (bonus: number) => `🎁 Daily quests done: +${bonus} ⭐ into your wallet!`,
  claimAlready: '🎁 Reward already claimed',
  claimNotReady: '🎯 Finish the daily quests first',
  newGame: '🥚 New game — name your pet!',

  create: {
    headline: 'Name your pet',
    sub: 'The pet hatches once it gets a name',
    namePlaceholder: 'Pet name',
    nameButton: 'Name it',
    pitch: 'Feed, play and watch it grow',
  },

  actionsAria: 'Actions',
  action: { feed: 'Feed', play: 'Play', wash: 'Wash', wake: 'Wake up', sleep: 'Sleep', shop: 'Shop' },
  statsAria: 'Stats',
  stat: { fullness: 'Fullness', happiness: 'Happiness', energy: 'Energy', cleanliness: 'Cleanliness' },
  questsAria: 'Daily quests',
  quest: {
    feed: 'Feed',
    play: 'Play',
    wash: 'Wash',
    pet: 'Pet',
  },
  questExplainDone: (label: string, t: number) =>
    `✅ “${label}” — ${t}/${t} today. Quests count your care; stats drop on their own.`,
  questExplainProgress: (label: string, p: number, t: number) => `🎯 “${label}” — ${p}/${t} today.`,
  questCellAria: (label: string, p: number, t: number) => `Quest “${label}”: ${p} of ${t} today`,
  questClaim: 'Claim',
  questClaimed: 'Claimed',
  questClaimAria: 'Claim the daily reward',
  questClaimedAria: 'Reward claimed',

  sceneHint: { feedCatch: 'Tap — Eggo will run for the food!', wash: 'Rub the pet with your finger', stars: '⭐ Caring earns stars!' },

  // --- minigames (the “Play” button) ---
  mgPause: 'Pause',
  mgResume: 'Resume',
  mgExit: 'Exit',
  mgStart: 'Start',
  mgAgain: 'Play again',
  mgDone: 'Done',
  mgBest: (n: number) => `Best: ${n}`,
  mgNewRecord: '🏆 New record!',
  mgBonus: (n: number) => `Eggo is thrilled: +${n} happiness`,
  mgStars: (n: number) => `⭐ +${n} for playing`,
  mgGameOver: 'Game over',
  mgRecordToast: (n: number) => `🏆 New record: ${n}!`,
  mgTime: (s: number) => `${s} s`,
  mgMatched: 'pair matched',
  mgCardHidden: 'Hidden card',
  mgPairsLeft: (n: number) => `Pairs left: ${n}`,
  mgLevel: (n: number) => `Level ${n}`,
  game: {
    memory: { title: '🧠 Memory', hint: 'Flip cards and match pairs — a cleared level adds time, but the clock ticks faster' },
    runner: { title: '🏃 Runner', hint: 'Tap above — jump. Hold the bottom — duck' },
    flappy: { title: '🎈 Flight', hint: 'Tap anywhere — the pet flaps' },
    snake: { title: '🐍 Snake', hint: 'Swipe or arrows — eat and don’t bite yourself or hit the walls' },
    bubbles: { title: '🫧 Bubbles', hint: 'Pop groups of three — bigger groups score a bonus' },
  },
  // on-canvas hints shown during the first seconds of a round
  mgHint: {
    runnerJump: '👆 Tap — jump',
    runnerDuck: '👇 Hold the bottom — duck',
    flappy: '👆 Tap — flap',
    snake: '👉 Swipe or arrows — turn',
    bubbles: '👆 Pop groups of three',
  },

  // --- minigame picker ---
  pickTitle: 'What shall we play?',
  pickRandom: 'Random',
  pickDayTitle: 'Game of the day — a new record earns double bonus',
  renameAria: 'Rename pet',
  renameSave: 'Save name',
  renameCancel: 'Keep the name',
  renamePriceHint: (n: number) => `⭐ ${n} to change the name`,

  // --- friendship level ---
  friendshipTitles: ['Acquaintance', 'Buddy', 'Companion', 'Friend', 'Best friend', 'Soulmate'],
  levelUp: (title: string) => `💖 Your friendship grows: you are now “${title}”!`,

  // --- achievements: keys = stable ids from game/achievements ---
  menuAchievements: 'Achievements',
  achievementsCount: (n: number, total: number) => `${n} of ${total}`,
  achievementUnlocked: (title: string) => `🏅 Achievement: ${title}!`,
  achievements: {
    'streak-7': { title: '📅 Week in rhythm' },
    'streak-14': { title: '📅 Two weeks straight' },
    'streak-30': { title: '📅 A month of care' },
    'age-7': { title: '🎂 One-week pet' },
    'age-30': { title: '🎂 A month together' },
    'score-100': { title: '🎯 Century score' },
    'all-games': { title: '🎮 Tried them all' },
    'weeks-2': { title: '✨ Two weeks of friendship' },
    'weeks-6': { title: '✨ Six weeks of friendship' },
    'ref-1': { title: '🤝 First friend' },
    'ref-3': { title: '🤝 Friend circle' },
    'lvl-3': { title: '💖 Strong bond' },
    'lvl-5': { title: '💖 Inseparable' },
    'stars-100': { title: '🌟 Hundred stars' },
    'stars-300': { title: '🌟 Star capital' },
  } as Record<string, { title: string }>,

  // --- shop ---
  menuShop: 'Shop',
  shopDishes: 'Food',
  shopAccessories: 'Accessories',
  shopDecor: 'Scene decor',
  shopServices: 'Helpers',
  shopNameSection: 'Pet name',
  shopRenameTitle: 'Change the name',
  renameDone: '✏️ Name changed!',
  shopActive: 'Served',
  shopOwned: 'Owned',
  shopBought: (title: string) => `🛍 Bought: ${title}`,
  shopNoStars: '⭐ Not enough stars yet — keep caring!',
  shopDishActive: '🍽 Feed first — a dish is already served',
  shopStarsHint: '⭐ Caring earns stars — spend them in the shop',
  walletAria: 'Star wallet',
  whatsNewText: '🛍 Eggo has a shop now! Earn ⭐ by caring — dishes, accessories, decor and helpers',
  whatsNewOpen: '🛍 Open the shop',
  serviceLeft: (h: number) => `${h} h left`,
  serviceHealthy: '💚 The pet is healthy — no vitamin needed',
  svcFeed: 'Auto-feeder — feeds itself for a day',
  svcWash: 'Auto-wash — cleans itself for a day',
  svcSleep: 'Auto-sleep — tucks in when sleepy',
  svcVitamin: 'Vitamin — instant cure',
  svcNanny: 'Nanny for a day — all three services',
  shopItem: {
    'dish-cake': { title: 'Cake — extra fullness for one feeding session' },
    'dish-feast': { title: 'Feast — the heartiest single session' },
    'acc-cap': { title: 'Cap — a well-worn headpiece' },
    'acc-bandana': { title: 'Bandana scarf — style in any weather' },
    'acc-glasses': { title: 'Glasses — a clever look for your pet' },
    'acc-crown': { title: 'Crown — for royalty' },
    'dec-flower': { title: 'Flowers — brighten the meadow by the pet' },
    'dec-mushroom': { title: 'Mushroom — a forest guest on the lawn' },
    'dec-house': { title: 'House — a cozy home on the meadow' },
    'dec-boat': { title: 'Boat — rocks on the sea waves' },
  } as Record<string, { title: string }>,
  wear: 'Wear',
  remove: 'Remove',

  // --- pet requests ---
  requestHint: '💡 Eggo is asking for something! Do it in time — the effect is doubled',
  requestBonus: (name: string) => `✨ Request fulfilled — ${name} is delighted!`,

  // --- catch-the-food feeding ---
  overfed: '🤢 Eggo overate! It will rest a bit now',

  notifOn: '🔔 Notifications on',
  notifOff: '🔕 Notifications off',
  notifBlocked: '✋ Open the bot chat, tap “Start”, then try again',
  notifError: '⚠️ Something went wrong — try again',

  // --- header: share and contact the author ---
  shareText: (stage: string, days: number) =>
    `My Eggo has been with me for ${days} ${days === 1 ? 'day' : 'days'}! Stage: ${stage}. Get your own 🥚`,
  authorAria: 'Message the author',

  // --- invite panel ---
  inviteAria: 'Invite a friend',
  inviteTitle: 'Invite a friend!',
  inviteSub: 'A friend launches Eggo via your link — your pet gets a friendship star ✨',
  inviteMilestone: (n: number) => `Star for ${n} ${n === 1 ? 'friend' : 'friends'}`,
  inviteCount: (n: number) => `Friends joined: ${n}`,
  inviteShare: 'Share the link',
  inviteReward: (n: number, stars: number) =>
    stars > 0
      ? `✨ Your pet earned ${n} friendship star${n === 1 ? '' : 's'} and +${stars} ⭐ — thank you!`
      : `✨ Your pet earned ${n} friendship star${n === 1 ? '' : 's'} — thank you!`,

  // --- menu screen ---
  menuAria: 'Menu',
  menuClose: 'Close',
  menuBack: 'Back',
  menuSettings: 'Settings',
  menuNotifOn: 'Notifications on',
  menuNotifOff: 'Notifications off',
  menuSoundOn: 'Sound on',
  menuSoundOff: 'Sound off',
  menuLang: 'Language',
  menuHelp: 'How to play',
  menuVersion: 'version',
  helpTitle: 'How to play',
  helpSections: [
    {
      title: 'Care',
      lines: [
        '🍔 Feed, play and wash — stats drop on their own, keep an eye on them',
        '😴 Put it to sleep at night — energy returns by morning',
        '🤒 Sick? Good care heals: keep every stat in the clear',
      ],
    },
    {
      title: 'Catch the food',
      lines: [
        '👆 Tap the screen — the pet runs and catches food with its mouth',
        '🥫 Cans aren’t food: dizzy head and a broken streak',
        '🤢 Overate? It rests a bit, then you can feed again',
      ],
    },
    {
      title: 'Mini-games',
      lines: [
        '🎮 The “Play” button launches one of five: memory, runner, flight, snake, bubbles',
        '🏃 Runner: tap above — jump, hold the bottom — duck',
        '🏆 Winning delights your pet; records survive even on a new device',
      ],
    },
    {
      title: 'Bonuses',
      lines: [
        '💡 Eggo is asking for something? Do it in time — the effect is doubled',
        '🎯 Daily quests: the reward goes to the weakest stat',
        '📅 Visit every day — streak days and friendship celebrations',
        '✨ Friends via your link — friendship stars for your pet',
      ],
    },
    {
      title: 'Settings',
      lines: ['🔊 Sound and language switch in the menu', '🔔 A push will tell you what happened and what to do'],
    },
  ],

  gate: {
    title: 'Eggo lives in Telegram',
    textInTg:
      'Open the bot chat and launch Eggo via the menu button — it sits to the left of the message input. The game won’t open from a link in the chat.',
    textOutside:
      'Your pet is tied to Telegram — that’s how it’s saved on the server and waits for you on any device. Open the mini app via the bot.',
    features: [
      '🍽️ Feed and care — your pet grows',
      '🎮 Mini-games, quests and daily star rewards',
      '🐣 Hatches from an egg through 5 growth stages',
    ],
    button: 'Sign in with Telegram',
    debugNoSdk: 'no SDK',
    debugYes: 'yes',
    debugNo: 'no',
  },

  dev: {
    timeBadge: (n: number) => `⚡ time ×${n}`,
    plusHour: '+1 hour',
    plusDay: '+1 day',
    skyButton: (label: string) => `Sky: ${label}`,
    skyAuto: 'auto',
    skyMorning: '🌅 morning',
    skyDay: '☀️ day',
    skyEvening: '🌆 evening',
    skyNight: '🌙 night',
    reset: 'Reset',
    resetConfirm: 'Start a new game?',
  },
}
