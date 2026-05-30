import jsQR from 'jsqr';
import type { ScanResult } from '../state/useView';

/**
 * Decode the rendered WebGL canvas as a QR code and (optionally) compare it to
 * `expected`. Requires the <Canvas> to use `preserveDrawingBuffer: true`, and is
 * meant to be run in flat (top-down) view. `attemptBoth` covers both normal and
 * inverted polarity so it stays robust to palette choices.
 */
export function verifyCanvas(canvas: HTMLCanvasElement | null, expected?: string): ScanResult {
  if (!canvas) return { ok: false, decoded: null };

  const maxW = 1600;
  const scale = Math.min(1, maxW / canvas.width);
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { ok: false, decoded: null };

  // flatten onto white in case the canvas has any transparency
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(canvas, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const result = jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' });
  const decoded = result ? result.data : null;
  return { ok: expected ? decoded === expected : Boolean(decoded), decoded };
}
