// Contemporary-era songs (any license: WC, CC, PD dedication, custom). Dated
// works before this stay hymns. Undated non-PD is treated as a living-writer song.
export const MODERN_YEAR = 1970;

export function isModernWorship(song: { year?: number | null; license?: string | null }) {
  const y = song.year || 0;
  if (y >= MODERN_YEAR) return true;
  if (y > 0) return false;
  return song.license !== "PD";
}
