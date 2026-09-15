import type { Instrument, TunePlayer } from "./midiPlayer";

/** HTML-audio TunePlayer so Lead worship can clock lyrics off a writer MP3. */
export function loadRecording(url: string): Promise<TunePlayer> {
  return new Promise((resolve, reject) => {
    const a = new Audio(url);
    a.preload = "auto";
    const fail = () => reject(new Error("recording failed to load"));
    a.addEventListener("error", fail, { once: true });
    a.addEventListener("loadedmetadata", () => {
      a.removeEventListener("error", fail);
      let onEnd: (() => void) | null = null;
      a.onended = () => onEnd?.();
      const player: TunePlayer = {
        duration: Number.isFinite(a.duration) ? a.duration : 0,
        parts: [],
        play() { void a.play(); },
        pause() { a.pause(); },
        stop() { a.pause(); a.currentTime = 0; },
        getTime() { return a.currentTime || 0; },
        setRate(r: number) { a.playbackRate = r; },
        setSemitones() { /* recordings play as sung */ },
        setSolo() {},
        seek(seconds: number) { a.currentTime = Math.max(0, seconds); },
        async setInstrument(_name: Instrument) {},
        get onEnd() { return onEnd; },
        set onEnd(fn) { onEnd = fn; }
      };
      resolve(player);
    }, { once: true });
  });
}
