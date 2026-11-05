/**
 * Синтезированный звук (WebAudio, без файлов и зависимостей): короткие
 * сигналы для мини-игр и кормления. Выбор «звук вкл/выкл» живёт в
 * localStorage (как язык) — это удобство устройства, не игровой сейв.
 * AudioContext заводится лениво: браузеры разрешают звук только после
 * жеста пользователя, поэтому первые сигналы до первого тапа молчат.
 */

const FLAG = 'eggo.sound'

export type SoundName =
  | 'tap'
  | 'chomp'
  | 'pop'
  | 'ding'
  | 'jump'
  | 'flap'
  | 'catch'
  | 'miss'
  | 'dizzy'
  | 'win'
  | 'lose'
  | 'record'

let ctx: AudioContext | null = null
let muted = loadMuted()

function loadMuted(): boolean {
  try {
    return window.localStorage.getItem(FLAG) === 'off'
  } catch {
    return false
  }
}

/** Включён ли звук (тумблер в меню). */
export function isSoundOn(): boolean {
  return !muted
}

/** Переключить звук; выбор запоминается. */
export function setSoundOn(on: boolean): void {
  muted = !on
  try {
    window.localStorage.setItem(FLAG, on ? 'on' : 'off')
  } catch {
    // приватный режим: выбор не переживёт перезагрузку — не страшно
  }
}

function ensureCtx(): AudioContext | null {
  if (muted) return null
  if (ctx === null) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface Tone {
  freq: number
  /** секунд */
  dur: number
  type?: OscillatorType
  gain?: number
  /** к какой частоте съехать за dur */
  slideTo?: number
  /** задержка старта, секунд */
  delay?: number
}

function playTones(tones: Tone[]): void {
  const audio = ensureCtx()
  if (!audio) return
  const t0 = audio.currentTime
  for (const tone of tones) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    const start = t0 + (tone.delay ?? 0)
    osc.type = tone.type ?? 'sine'
    osc.frequency.setValueAtTime(tone.freq, start)
    if (tone.slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(tone.slideTo, start + tone.dur)
    const vol = tone.gain ?? 0.07
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(vol, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start(start)
    osc.stop(start + tone.dur + 0.03)
  }
}

/** Проиграть сигнал; до первого жеста пользователя браузер может молчать. */
export function playSound(name: SoundName): void {
  switch (name) {
    case 'tap':
      playTones([{ freq: 660, dur: 0.06, type: 'triangle', gain: 0.045 }])
      break
    case 'chomp':
      playTones([{ freq: 300, dur: 0.09, type: 'square', gain: 0.055, slideTo: 120 }])
      break
    case 'pop':
      playTones([{ freq: 520, dur: 0.09, gain: 0.09, slideTo: 940 }])
      break
    case 'ding':
      playTones([{ freq: 880, dur: 0.12, gain: 0.07 }, { freq: 1320, dur: 0.18, gain: 0.05, delay: 0.07 }])
      break
    case 'jump':
      playTones([{ freq: 330, dur: 0.12, type: 'triangle', gain: 0.06, slideTo: 660 }])
      break
    case 'flap':
      playTones([{ freq: 440, dur: 0.07, type: 'triangle', gain: 0.05, slideTo: 640 }])
      break
    case 'catch':
      playTones([{ freq: 523, dur: 0.09, gain: 0.07 }, { freq: 784, dur: 0.12, gain: 0.06, delay: 0.08 }])
      break
    case 'miss':
      playTones([{ freq: 280, dur: 0.16, gain: 0.05, slideTo: 160 }])
      break
    case 'dizzy':
      playTones([
        { freq: 500, dur: 0.1, type: 'square', gain: 0.045, slideTo: 250 },
        { freq: 380, dur: 0.12, type: 'square', gain: 0.04, slideTo: 190, delay: 0.1 },
      ])
      break
    case 'win':
      playTones([
        { freq: 523, dur: 0.12, gain: 0.07 },
        { freq: 659, dur: 0.12, gain: 0.07, delay: 0.1 },
        { freq: 784, dur: 0.2, gain: 0.08, delay: 0.2 },
      ])
      break
    case 'lose':
      playTones([
        { freq: 330, dur: 0.14, type: 'triangle', gain: 0.06 },
        { freq: 262, dur: 0.2, type: 'triangle', gain: 0.06, delay: 0.12 },
      ])
      break
    case 'record':
      playTones([
        { freq: 659, dur: 0.1, gain: 0.07 },
        { freq: 880, dur: 0.1, gain: 0.07, delay: 0.09 },
        { freq: 1175, dur: 0.24, gain: 0.08, delay: 0.18 },
      ])
      break
  }
}
