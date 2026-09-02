// Cover art is resized in the browser: the API stores art.{ext} and art-thumb.webp but generates neither.
const ART_LONG_SIDE = 1600;
const THUMB_SHORT_SIDE = 128;

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Couldn’t read ${file.name}`)); };
    img.src = url;
  });

// null whenever the browser can't give us webp — the caller falls back to the original file
const toWebp = (img: HTMLImageElement, scale: number, quality: number, name: string) =>
  new Promise<File | null>(resolve => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(null);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => resolve(blob && blob.type === "image/webp" ? new File([blob], name, { type: "image/webp" }) : null), "image/webp", quality);
  });

/** Full-size art plus the thumbnail the song cards use, both webp. Falls back to the original file as art. */
export const prepareArt = async (file: File): Promise<{ art: File; thumb?: File }> => {
  const img = await loadImage(file);
  const long = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const short = Math.min(img.naturalWidth, img.naturalHeight) || 1;
  const art = await toWebp(img, Math.min(1, ART_LONG_SIDE / long), 0.85, "art.webp");
  if (!art) return { art: file };
  const thumb = await toWebp(img, Math.min(1, THUMB_SHORT_SIDE / short), 0.72, "art-thumb.webp");
  return { art, thumb: thumb || undefined };
};
