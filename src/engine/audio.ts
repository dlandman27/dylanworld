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
