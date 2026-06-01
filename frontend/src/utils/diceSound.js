class DiceSoundEngine {
  constructor() {
    this.audioContext = null
    this.masterGain = null
    this.shakeOscillator = null
    this.shakeGain = null
    this.shakeFilter = null
  }

  ensureContext() {
    if (typeof window === 'undefined') return null
    if (!this.audioContext) {
      const AudioContextRef = window.AudioContext || window.webkitAudioContext
      if (!AudioContextRef) return null
      this.audioContext = new AudioContextRef()
      this.masterGain = this.audioContext.createGain()
      this.masterGain.gain.value = 0.18
      this.masterGain.connect(this.audioContext.destination)
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {})
    }

    return this.audioContext
  }

  playShake() {
    const context = this.ensureContext()
    if (!context || this.shakeOscillator) return

    this.shakeOscillator = context.createOscillator()
    this.shakeFilter = context.createBiquadFilter()
    this.shakeGain = context.createGain()

    this.shakeOscillator.type = 'sawtooth'
    this.shakeOscillator.frequency.value = 58
    this.shakeFilter.type = 'bandpass'
    this.shakeFilter.frequency.value = 360
    this.shakeFilter.Q.value = 0.3
    this.shakeGain.gain.value = 0.0001

    this.shakeOscillator.connect(this.shakeFilter)
    this.shakeFilter.connect(this.shakeGain)
    this.shakeGain.connect(this.masterGain)

    const now = context.currentTime
    this.shakeGain.gain.cancelScheduledValues(now)
    this.shakeGain.gain.linearRampToValueAtTime(0.06, now + 0.06)

    this.shakeOscillator.start(now)
  }

  stopShake() {
    if (!this.audioContext || !this.shakeOscillator || !this.shakeGain) return

    const now = this.audioContext.currentTime
    this.shakeGain.gain.cancelScheduledValues(now)
    this.shakeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)

    const oscillator = this.shakeOscillator
    const filter = this.shakeFilter
    const gain = this.shakeGain

    setTimeout(() => {
      try {
        oscillator.stop()
      } catch {}
      oscillator.disconnect()
      filter?.disconnect()
      gain?.disconnect()
    }, 120)

    this.shakeOscillator = null
    this.shakeFilter = null
    this.shakeGain = null
  }

  playCollision(strength = 1) {
    const context = this.ensureContext()
    if (!context) return

    const now = context.currentTime
    const gain = context.createGain()
    const oscillator = context.createOscillator()
    const filter = context.createBiquadFilter()

    oscillator.type = 'triangle'
    oscillator.frequency.value = 180 + Math.random() * 90
    filter.type = 'highpass'
    filter.frequency.value = 120

    const volume = Math.min(Math.max(Number(strength || 0), 0.2), 1.2)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.085 * volume, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13)

    oscillator.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    oscillator.start(now)
    oscillator.stop(now + 0.14)
  }

  playStop() {
    const context = this.ensureContext()
    if (!context) return

    const now = context.currentTime
    const gain = context.createGain()
    const oscillator = context.createOscillator()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(220, now)
    oscillator.frequency.exponentialRampToValueAtTime(110, now + 0.12)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)

    oscillator.connect(gain)
    gain.connect(this.masterGain)

    oscillator.start(now)
    oscillator.stop(now + 0.17)
  }

  destroy() {
    this.stopShake()
    if (this.masterGain) {
      this.masterGain.disconnect()
      this.masterGain = null
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }
  }
}

export function createDiceSoundEngine() {
  return new DiceSoundEngine()
}
