import { slidesFor, type Deck } from "./slides.ts";
import type { Song } from "./songs";

/** One song as a projector / setlist wants it: the key it will be sung in and the sections picked. */
export interface ExportItem { song: Song; key?: string; order?: string[]; }
export interface ExportFile { name: string; type: string; body: string | Blob; }

export const decksFor = (items: ExportItem[]): Deck[] => items.map(i => slidesFor(i.song, i.order));

/** Hand the browser a file to save. */
export function downloadFile(file: ExportFile) {
  const blob = file.body instanceof Blob ? file.body : new Blob([file.body], { type: file.type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}
