import Soundfont from "soundfont-player";

interface MidiNote { t: number; d: number; n: number; v: number }

export function parseMidi(buf: ArrayBuffer): { notes: MidiNote[]; duration: number } {
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
  const raw: { tick: number; on: boolean; n: number; v: number }[] = [];

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
        if (kind === 0x90 && d2 > 0) raw.push({ tick, on: true, n: d1, v: d2 });
        else if (kind === 0x80 || kind === 0x90) raw.push({ tick, on: false, n: d1, v: 0 });
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
  const open: Record<number, { tick: number; v: number }[]> = {};
  const notes: MidiNote[] = [];
  for (const e of raw) {
    if (e.on) (open[e.n] = open[e.n] || []).push({ tick: e.tick, v: e.v });
    else {
      const start = open[e.n]?.shift();
      if (start) notes.push({ t: toSec(start.tick), d: Math.max(toSec(e.tick) - toSec(start.tick), 0.05), n: e.n, v: start.v });
    }
  }
  const duration = notes.reduce((m, x) => Math.max(m, x.t + x.d), 0);
  return { notes, duration };
}

let ctx: AudioContext | null = null;
let piano: Soundfont.Player | null = null;

export async function playMidi(url: string, semitones: number, onEnd: () => void): Promise<() => void> {
  ctx = ctx || new AudioContext();
  await ctx.resume();
  piano = piano || await Soundfont.instrument(ctx, "acoustic_grand_piano");
  const { notes, duration } = parseMidi(await (await fetch(url)).arrayBuffer());
  const base = ctx.currentTime + 0.1;
  for (const x of notes) piano.play(x.n + semitones, base + x.t, { duration: x.d, gain: x.v / 127 });
  const timer = window.setTimeout(onEnd, (duration + 1) * 1000);
  return () => { window.clearTimeout(timer); piano?.stop(); };
}
