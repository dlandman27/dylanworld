// Tiny sound effects. The AudioContext can only start after a user gesture, so
// initAudio() arms it on the first pointerdown; until then sounds are skipped.

let ctx: AudioContext | null = null
let armed = false

export function initAudio(): void {
  if (armed) return
  armed = true
  const arm = (): void => {
    if (!ctx) {
      try { ctx = new AudioContext() } catch { /* no audio — fine */ }
    }
    ctx?.resume()
    window.removeEventListener('pointerdown', arm)
  }
  window.addEventListener('pointerdown', arm)
}

let lastClunk = 0

/** A wooden clunk — strength 0..1 scales volume and thud depth. */
export function clunk(strength: number): void {
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  // rate-limit so a pile of collisions doesn't machine-gun
  if (now - lastClunk < 0.03) return
  lastClunk = now

  const s = Math.min(1, Math.max(0, strength))
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(150 + Math.random() * 90 + s * 60, now)
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.07)
  gain.gain.setValueAtTime(0.12 * s + 0.02, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.1)
}

/** A bright bell/chime at a given frequency — the marble-run xylophone bars. */
export function chime(freq: number): void {
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.17, now + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.55)
}

/** A rising four-note fanfare — the Plinko jackpot payoff. */
export function fanfare(): void {
  if (!ctx || ctx.state !== 'running') return
  const c = ctx
  const now = c.currentTime
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6, a major arpeggio
  notes.forEach((f, i) => {
    const at = now + i * 0.09
    // two detuned oscillators for a brassy shimmer
    for (const det of [0, 1.006]) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(f * (det || 1), at)
      const vol = i === notes.length - 1 ? 0.2 : 0.14
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(vol, at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + (i === notes.length - 1 ? 0.6 : 0.22))
      osc.connect(gain).connect(c.destination)
      osc.start(at)
      osc.stop(at + 0.65)
    }
  })
}

/** A dry-erase marker squeak — for wiping the whiteboard. */
export function squeak(): void {
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(1150, now)
  osc.frequency.linearRampToValueAtTime(1950, now + 0.05)
  osc.frequency.linearRampToValueAtTime(880, now + 0.13)
  gain.gain.setValueAtTime(0.05, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.16)
}

/** A short bright pick/pop — for UI toggles like equipping a cursor. */
export function pop(): void {
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(520, now)
  osc.frequency.exponentialRampToValueAtTime(900, now + 0.06)
  gain.gain.setValueAtTime(0.14, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.13)
}
