/** Soft alert beep via Web Audio — works after a user click (unmute). */

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Call from a click handler (e.g. Unmute) so browsers allow audio. */
export async function unlockCommandCenterSound(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state === "suspended") await c.resume();
    unlocked = c.state === "running";
    return unlocked;
  } catch {
    return false;
  }
}

export function playCommandCenterAlert() {
  const c = getCtx();
  if (!c || !unlocked) return;
  try {
    if (c.state === "suspended") void c.resume();
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(660, t0 + 0.12);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  } catch {
    /* ignore */
  }
}

export function isCommandCenterSoundUnlocked() {
  return unlocked;
}
