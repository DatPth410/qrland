import jsQR from 'jsqr';

export interface DecodeResult {
  /** the decoded payload, or null if no QR could be read */
  text: string | null;
  /** a friendly, user-facing reason when `text` is null */
  error?: string;
}

/** Longest edge we rasterize the upload to before decoding. Big enough to keep
 *  small modules legible, capped so a huge photo doesn't blow up memory. */
const MAX_EDGE = 1400;
/** A second, downscaled pass — sometimes a noisy/over-large photo decodes
 *  better once shrunk (averaging smooths JPEG speckle). */
const FALLBACK_EDGE = 700;

/** Rasterize the image at a target longest-edge and try to decode it. */
function decodeAtEdge(img: HTMLImageElement, targetEdge: number): string | null {
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest === 0) return null;
  const scale = Math.min(1, targetEdge / longest);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // flatten onto white so a transparent PNG QR still reads as dark-on-light
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  // attemptBoth covers normal AND inverted polarity (e.g. our light-on-dark world)
  const result = jsQR(data, w, h, { inversionAttempts: 'attemptBoth' });
  return result ? result.data : null;
}

/**
 * Decode a QR code from an image file the user picked or dropped. Resolves with
 * the decoded text, or a friendly error when the file isn't an image or no QR
 * could be found. Never rejects — callers branch on `result.text`.
 */
export function decodeImageFile(file: File): Promise<DecodeResult> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ text: null, error: 'That file isn’t an image.' });
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const text = decodeAtEdge(img, MAX_EDGE) ?? decodeAtEdge(img, FALLBACK_EDGE);
      if (text) resolve({ text });
      else resolve({ text: null, error: 'Couldn’t find a QR code in that image.' });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ text: null, error: 'Couldn’t read that image file.' });
    };

    img.src = url;
  });
}
