let _audioCtx: AudioContext | null = null
let _soundMuted = false

export function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext()
  return _audioCtx
}

export function getSoundMuted(): boolean { return _soundMuted }
export function setSoundMuted(v: boolean) { _soundMuted = v }

export function playTone(
  freq: number, type: OscillatorType, duration: number,
  volume = 0.25, freqEnd?: number, startDelay = 0,
) {
  if (_soundMuted) return
  try {
    const ac = getAudioCtx()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain); gain.connect(ac.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, ac.currentTime + startDelay)
    if (freqEnd !== undefined) osc.frequency.linearRampToValueAtTime(freqEnd, ac.currentTime + startDelay + duration)
    gain.gain.setValueAtTime(volume, ac.currentTime + startDelay)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + startDelay + duration)
    osc.start(ac.currentTime + startDelay)
    osc.stop(ac.currentTime + startDelay + duration + 0.01)
  } catch {}
}

export function playNoise(duration: number, volume = 0.15, highpass = 800) {
  if (_soundMuted) return
  try {
    const ac = getAudioCtx()
    const buf = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource()
    src.buffer = buf
    const filter = ac.createBiquadFilter()
    filter.type = "highpass"; filter.frequency.value = highpass
    const gain = ac.createGain()
    gain.gain.setValueAtTime(volume, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination)
    src.start(); src.stop(ac.currentTime + duration + 0.01)
  } catch {}
}

export const SFX = {
  shoot()       { playTone(660, "square", 0.06, 0.12, 220) },
  shootLaser()  { playTone(1200, "sawtooth", 0.12, 0.15, 400) },
  shootSpread() {
    playTone(580, "square", 0.05, 0.08, 200)
    playTone(620, "square", 0.05, 0.08, 200, 0.03)
    playTone(540, "square", 0.05, 0.08, 200, 0.06)
  },
  shootMissile() { playTone(320, "sawtooth", 0.18, 0.18, 180) },
  enemyHit()     { playNoise(0.06, 0.12, 1200) },
  explosion()    {
    playNoise(0.3, 0.25, 80)
    playTone(80, "sine", 0.3, 0.2, 30)
  },
  bigExplosion() {
    playNoise(0.6, 0.35, 40)
    playTone(60, "sine", 0.6, 0.3, 20)
    playTone(120, "sawtooth", 0.4, 0.15, 40, 0.05)
  },
  playerHit()    {
    playNoise(0.15, 0.2, 400)
    playTone(220, "square", 0.18, 0.15, 110)
  },
  shieldOn()     {
    playTone(800, "sine", 0.08, 0.2, 1400)
    playTone(600, "sine", 0.12, 0.12, 1000, 0.04)
  },
  shieldOff()    { playTone(500, "sine", 0.2, 0.15, 150) },
  shieldBreak()  {
    playNoise(0.25, 0.2, 300)
    playTone(300, "sawtooth", 0.25, 0.12, 80)
  },
  pickup()       {
    playTone(660, "sine", 0.06, 0.18)
    playTone(880, "sine", 0.06, 0.18, undefined, 0.06)
    playTone(1100, "sine", 0.1, 0.18, undefined, 0.12)
  },
  bossIntro()    {
    for (let i = 0; i < 4; i++) {
      playTone(100 + i * 30, "sawtooth", 0.3, 0.2 - i * 0.03, undefined, i * 0.22)
    }
    playNoise(0.8, 0.08, 60)
  },
  worldClear()   {
    const notes = [523, 659, 784, 1047]
    notes.forEach((n, i) => playTone(n, "sine", 0.25, 0.22, undefined, i * 0.18))
  },
  bossPhase2()   {
    playTone(150, "sawtooth", 0.5, 0.3, 80)
    playNoise(0.3, 0.15, 200)
  },
}