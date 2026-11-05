/**
 * Английские строки интерфейса. Тип Strings берётся от ru.ts —
 * пропущенный или лишний ключ поймает tsc при сборке.
 */
import type { Strings } from './ru'

export const en: Strings = {
  loading: 'Loading your pet…',
  ageLabel: 'Age:',
  streakTitle: 'Days in a row',
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
    sleeping: '🤫 The pet is sleeping',
    'too-tired': '😵 Too tired — let it sleep',
    'already-full': '😋 Already full — it would burst',
    'already-happy': '😄 Already happy to the brim',
    'already-clean': '✨ Already sparkling clean',
    'already-named': '🏷️ Already named — no renaming',
    'invalid-name': '✏️ 1 to 16 characters',
    overfed: '😴 Too full — resting, feed later',
  },
  actionSuccess: { feed: '🍗 Yum-yum!', play: '😄 That was fun!', wash: '🛁 Squeaky clean!', pet: '💗 Purr-purr!' },
  sleepStart: '😴 Good night!',
  sleepWake: '☀️ Woke up!',
  missYou: (name: string) => `💗 ${name} missed you!`,
  hatched: (name: string) => `🎉 ${name} hatched!`,
  named: (name: string) => `🎉 ${name} is a great name!`,
  eggAppeared: '🥚 An egg appeared!',
  daysInRow: (n: number) => `🔥 ${n} ${n === 1 ? 'day' : 'days'} in a row!`,
  weeksOfFriendship: (n: number) => `🎂 ${n} ${n === 1 ? 'week' : 'weeks'} of friendship!`,
  claimReward: (bonus: number) => `🎁 Daily quests done: +${bonus} to the weakest stat!`,
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
  action: { feed: 'Feed', play: 'Play', wash: 'Wash', wake: 'Wake up', sleep: 'Sleep' },
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

  sceneHint: { feedCatch: 'Tap — Eggo will run for the food!', wash: 'Rub the pet with your finger' },

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
  mgLost: 'Eggo is sad but believes in you!',
  mgRecordToast: (n: number) => `🏆 New record: ${n}!`,
  mgTime: (s: number) => `${s} s`,
  mgMatched: 'pair matched',
  mgCardHidden: 'Hidden card',
  mgPairsLeft: (n: number) => `Pairs left: ${n}`,
  game: {
    memory: { title: '🧠 Memory', hint: 'Flip the cards and match every pair before time runs out' },
    runner: { title: '🏃 Runner', hint: 'Tap to jump, swipe down to duck' },
    flappy: { title: '🎈 Flight', hint: 'Tap to stay airborne' },
    snake: { title: '🐍 Snake', hint: 'Swipe or arrow keys — collect the food' },
    bubbles: { title: '🫧 Bubbles', hint: 'Pop groups of three or more alike' },
  },

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
  inviteReward: (n: number) => `✨ Your pet earned ${n} friendship star${n === 1 ? '' : 's'} — thank you!`,

  // --- menu screen ---
  menuAria: 'Menu',
  menuClose: 'Close',
  menuBack: 'Back',
  menuSettings: 'Settings',
  menuMore: 'More',
  menuNotifOn: 'Notifications on',
  menuNotifOff: 'Notifications off',
  menuLang: 'Language',
  menuChannel: 'Our channel',
  menuHelp: 'How to play',
  menuVersion: 'version',
  helpTitle: 'How to play',
  helpLines: [
    '🍔 Feed, play and wash — stats drop on their own, keep an eye on them',
    '💡 Eggo is asking for something? Do it in time — the effect is doubled',
    '🎯 Daily quests: the reward goes to the weakest stat',
    '🔥 Visit every day — streak days and friendship celebrations',
    '✨ Friends via your link — friendship stars for your pet',
    '😴 Put it to sleep at night — energy returns by morning',
  ],

  gate: {
    title: 'Eggo lives in Telegram',
    textInTg:
      'Open the bot chat and launch Eggo via the menu button — it sits to the left of the message input. The game won’t open from a link in the chat.',
    textOutside:
      'Your pet is tied to Telegram — that’s how it’s saved on the server and waits for you on any device. Open the mini app via the bot.',
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
