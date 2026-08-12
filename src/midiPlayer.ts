import Soundfont from "soundfont-player";

export interface MidiNote { t: number; d: number; n: number; v: number; p: number; tk: number; dt: number }

const PART_NAMES: Record<number, string[]> = {
  2: ["Treble", "Bass"],
  3: ["Soprano", "Tenor", "Bass"],
  4: ["Soprano", "Alto", "Tenor", "Bass"]
};

// Open Hymnal exports put each voice on its own track, highest first; anything else stays generic.
function namePart(rank: number, total: number) {
  return PART_NAMES[total]?.[rank] || `Part ${rank + 1}`;
}

export function parseMidi(buf: ArrayBuffer): { notes: MidiNote[]; duration: number; parts: string[]; tpb: number } {
  const data = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let pos = 0;
  const readStr = (n: number) => { const s = String.fromCharCode(...bytes.subarray(pos, pos + n)); pos += n; return s; };
  const readVar = () => { let v = 0, b; do { b = bytes[pos++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

  if (readStr(4) !== "MThd") throw new Error("not a MIDI file");
  pos += 4;
  pos += 2;
  const ntrks = data.getUint16(pos); pos += 2;
  const tpb = data.getUint16(pos); pos += 2;

  const tempos: { tick: number; us: number }[] = [];
  const raw: { tick: number; on: boolean; n: number; v: number; tr: number }[] = [];

  for (let tr = 0; tr < ntrks; tr++) {
    if (readStr(4) !== "MTrk") break;
    const len = data.getUint32(pos); pos += 4;
    const end = pos + len;
    let tick = 0, status = 0;
    while (pos < end) {
      tick += readVar();
      let b = bytes[pos];
      if (b & 0x80) { status = b; pos++; } else b = status;
      if (b === 0xff) {
        const type = bytes[pos++]; const mlen = readVar();
        if (type === 0x51) tempos.push({ tick, us: (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2] });
        pos += mlen;
      } else if (b === 0xf0 || b === 0xf7) {
        pos += readVar();
      } else {
        const kind = b & 0xf0;
        const d1 = bytes[pos++];
        const d2 = kind === 0xc0 || kind === 0xd0 ? 0 : bytes[pos++];
        if (kind === 0x90 && d2 > 0) raw.push({ tick, on: true, n: d1, v: d2, tr });
        else if (kind === 0x80 || kind === 0x90) raw.push({ tick, on: false, n: d1, v: 0, tr });
      }
    }
    pos = end;
  }

  tempos.sort((a, b) => a.tick - b.tick);
  const toSec = (tick: number) => {
    let sec = 0, prevTick = 0, us = 500000;
    for (const t of tempos) {
      if (t.tick >= tick) break;
      sec += ((t.tick - prevTick) / tpb) * (us / 1e6);
      prevTick = t.tick; us = t.us;
    }
    return sec + ((tick - prevTick) / tpb) * (us / 1e6);
  };

  raw.sort((a, b) => a.tick - b.tick || Number(a.on) - Number(b.on));
  const open: Record<string, { tick: number; v: number }[]> = {};
  const notes: MidiNote[] = [];
  for (const e of raw) {
    const k = e.tr + ":" + e.n;
    if (e.on) (open[k] = open[k] || []).push({ tick: e.tick, v: e.v });
    else {
      const start = open[k]?.shift();
      if (start) notes.push({ t: toSec(start.tick), d: Math.max(toSec(e.tick) - toSec(start.tick), 0.05), n: e.n, v: start.v, p: e.tr, tk: start.tick, dt: Math.max(e.tick - start.tick, 1) });
    }
  }

  const stats: Record<number, { sum: number; count: number }> = {};
  for (const n of notes) {
    const s = stats[n.p] = stats[n.p] || { sum: 0, count: 0 };
    s.sum += n.n; s.count++;
  }
  const order = Object.keys(stats).map(Number).sort((a, b) => stats[b].sum / stats[b].count - stats[a].sum / stats[a].count);
  const rank = new Map(order.map((tr, i) => [tr, i]));
  for (const n of notes) n.p = rank.get(n.p)!;
  const parts = order.map((_, i) => namePart(i, order.length));

  notes.sort((a, b) => a.t - b.t);
  const duration = notes.reduce((m, x) => Math.max(m, x.t + x.d), 0);
  return { notes, duration, parts, tpb };
}

export interface TunePlayer {
  readonly duration: number;
  readonly parts: string[];
  play(): void;
  pause(): void;
  stop(): void;
  getTime(): number;
  setRate(r: number): void;
  setSemitones(s: number): void;
  setSolo(part: number | null): void;
  onEnd: (() => void) | null;
}

let ctx: AudioContext | null = null;
const loaded: Record<string, Soundfont.Player> = {};

const LOOKAHEAD = 0.35;
const BACKING_GAIN = 0.35;

const load = async (name: "acoustic_grand_piano" | "choir_aahs") =>
  loaded[name] = loaded[name] || await Soundfont.instrument(ctx!, name, { nameToUrl: () => `/soundfonts/${name}-mp3.js` });

// ponytail: one global player set — stop() silences everything, so never run two tunes at once
export async function loadTune(url: string): Promise<TunePlayer> {
  ctx = ctx || new AudioContext();
  await ctx.resume();
  const [piano, choir] = await Promise.all([load("acoustic_grand_piano"), load("choir_aahs")]);
  const { notes, duration, parts } = parseMidi(await (await fetch(url)).arrayBuffer());

  let rate = 1, semis = 0, playing = false, pausedAt = 0, solo: number | null = null;
  let anchorCtx = 0, anchorSong = 0, idx = 0, timer = 0;
  let sched: { t: number; node: { stop: (when?: number) => void } }[] = [];

  const getTime = () => (playing ? anchorSong + (ctx!.currentTime - anchorCtx) * rate : pausedAt);
  const firstAfter = (t: number) => { let i = 0; while (i < notes.length && notes[i].t <= t) i++; return i; };

  const tick = () => {
    const now = getTime();
    while (idx < notes.length && notes[idx].t <= now + LOOKAHEAD * rate) {
      const n = notes[idx++];
      const when = anchorCtx + (n.t - anchorSong) / rate;
      const lead = solo === n.p;
      const inst = lead ? choir : piano;
      const gain = (n.v / 127) * (solo === null || lead ? 1 : BACKING_GAIN);
      const node = inst.play(n.n + semis, when, { duration: n.d / rate, gain }) as { stop: (when?: number) => void };
      sched.push({ t: n.t, node });
    }
    sched = sched.filter(s => s.t > now);
    if (idx >= notes.length && now >= duration) {
      playing = false;
      window.clearInterval(timer);
      pausedAt = 0;
      idx = 0;
      player.onEnd?.();
    }
  };

  const silence = () => {
    window.clearInterval(timer);
    piano.stop();
    choir.stop();
    sched = [];
  };

  // drop everything queued past `now` so the next tick re-schedules it with current rate/solo
  const reschedule = () => {
    const now = getTime();
    for (const s of sched) if (s.t > now) { try { s.node.stop(); } catch { /* already ended */ } }
    sched = [];
    idx = firstAfter(now);
    anchorSong = now;
    anchorCtx = ctx!.currentTime;
    return now;
  };

  const player: TunePlayer = {
    duration,
    parts,
    onEnd: null,
    getTime,
    play() {
      if (playing || notes.length === 0) return;
      ctx!.resume();
      anchorCtx = ctx!.currentTime + 0.05;
      anchorSong = pausedAt;
      idx = firstAfter(pausedAt - 0.001);
      playing = true;
      timer = window.setInterval(tick, 50);
      tick();
    },
    pause() {
      if (!playing) return;
      pausedAt = getTime();
      playing = false;
      silence();
    },
    stop() {
      playing = false;
      pausedAt = 0;
      idx = 0;
      silence();
    },
    setRate(r: number) {
      r = Math.min(2, Math.max(0.25, r));
      if (playing) {
        reschedule();
        rate = r;
        tick();
      } else rate = r;
    },
    setSemitones(s: number) {
      semis = s;
    },
    setSolo(part: number | null) {
      if (part === solo) return;
      solo = part;
      if (playing) { reschedule(); tick(); }
    }
  };
  return player;
}
