// Practice tools: a click track and a pitch pipe, both plain oscillators.
// Deliberately not sharing midiPlayer's context — its stop() silences every voice it owns.

let ctx: AudioContext | null = null;
const audio = () => (ctx = ctx || new AudioContext());

const LOOKAHEAD = 0.25; // seconds of clicks queued ahead of the clock
const TICK_MS = 40;

let timer = 0, nextBeat = 0, beat = 0, bpm = 100, beats = 4;

const click = (at: number, accent: boolean) => {
  const ac = audio();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.frequency.value = accent ? 1600 : 1000;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.28, at + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  osc.connect(gain).connect(ac.destination);
  osc.start(at);
  osc.stop(at + 0.06);
};

const tick = () => {
  const ac = audio();
  while (nextBeat < ac.currentTime + LOOKAHEAD) {
    click(nextBeat, beat === 0);
    beat = (beat + 1) % beats;
    nextBeat += 60 / bpm;
  }
};

export function startMetronome(beatsPerMinute: number, beatsPerBar = 4) {
  stopMetronome();
  bpm = Math.max(20, beatsPerMinute);
  beats = Math.max(1, beatsPerBar);
  beat = 0;
  const ac = audio();
  ac.resume();
  nextBeat = ac.currentTime + 0.1;
  tick();
  timer = window.setInterval(tick, TICK_MS);
}

// tempo slider moves under a running metronome — the next beat picks the new spacing up
export function setMetronomeBpm(beatsPerMinute: number) {
  bpm = Math.max(20, beatsPerMinute);
}

export function stopMetronome() {
  if (timer) window.clearInterval(timer);
  timer = 0;
}

export function playPitch(midiNote: number, seconds = 1.5) {
  const ac = audio();
  ac.resume();
  const at = ac.currentTime + 0.02;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "triangle";
  osc.frequency.value = 440 * Math.pow(2, (midiNote - 69) / 12);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.25, at + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  osc.connect(gain).connect(ac.destination);
  osc.start(at);
  osc.stop(at + seconds + 0.05);
}
