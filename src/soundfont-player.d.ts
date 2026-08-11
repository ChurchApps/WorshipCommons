declare module "soundfont-player" {
  namespace Soundfont {
    interface Player {
      play(note: string | number, when?: number, opts?: { duration?: number; gain?: number }): unknown;
      stop(): void;
    }
  }
  const Soundfont: {
    instrument(ac: AudioContext, name: string, opts?: { nameToUrl?: (name: string, soundfont?: string, format?: string) => string }): Promise<Soundfont.Player>;
  };
  export default Soundfont;
}
