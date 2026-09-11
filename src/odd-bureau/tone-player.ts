import type { Note } from './play-rules.js';

/** The game performs its explicit note rules locally; this is not a claimed AI audio job. */
export class TonePlayer {
  private context: AudioContext | null = null;
  private finish: ((completed: boolean) => void) | null = null;
  async play(notes: readonly Note[]): Promise<boolean> {
    this.stop();
    if (!notes.length) return false;
    const context = new AudioContext(); this.context = context;
    await context.resume();
    if (this.context !== context) return false;
    if (context.state !== 'running') { this.stop(); throw new Error('声音没有开始播放，请再点一次试听。'); }
    const pitches = [261.626, 293.665, 329.628, 391.995, 440];
    let time = context.currentTime + 0.025;
    return new Promise<boolean>(resolve => {
      this.finish = resolve;
      notes.forEach((note, index) => {
        const oscillator = context.createOscillator(), gain = context.createGain();
        const duration = note.beats * 0.23;
        oscillator.type = 'triangle'; oscillator.frequency.value = pitches[note.pitch];
        gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.15, time + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(time); oscillator.stop(time + duration + 0.025);
        if (index === notes.length - 1) oscillator.onended = () => { if (this.context === context) { resolve(true); this.stop(); } else resolve(false); };
        time += duration + 0.055;
      });
    });
  }
  stop() {
    const context = this.context; this.context = null;
    if (context) void context.close().catch(() => undefined);
    this.finish?.(false); this.finish = null;
  }
}
