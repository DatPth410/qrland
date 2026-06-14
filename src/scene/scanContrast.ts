/**
 * Top-down scan contrast control, shared by every theme.
 *
 * In scan (top-down) view the lighting flattens to near-flat ambient, so jsQR sees
 * essentially the raw material albedo — the only thing that keeps a code scannable
 * is the LUMINANCE GAP between each cell's DARK-module / LIGHT-module material pair.
 *
 * Each theme picks a SCAN_CONTRAST in (0, 1]: 1 = the palette's original gap, lower
 * pulls the two materials of every pair toward their shared mid-luminance so the code
 * melts into the terrain. The finder squares are deliberately left at full contrast in
 * each theme (they must stay easy to locate). `globalThis.__scanC` overrides the factor
 * at runtime so the balance point can be swept live without a rebuild.
 */
export interface Dimmer {
  /** current contrast factor: the runtime override (globalThis.__scanC) ?? the theme default */
  scanC: () => number;
  /** sRGB luminance (0..255) of a hex colour */
  lum: (hex: string) => number;
  /** squeeze a single colour's luminance toward `mid` (0..255) by the current factor */
  squeeze: (hex: string, mid: number) => string;
  /** a DARK/LIGHT material pair, each squeezed toward the pair's own mid by the current factor */
  pair: (lightHex: string, darkHex: string) => { light: string; dark: string };
}

export function makeDimmer(themeDefault: number): Dimmer {
  const scanC = (): number => {
    const o = (globalThis as { __scanC?: number }).__scanC;
    return typeof o === 'number' ? o : themeDefault;
  };
  const hexRGB = (hex: string): [number, number, number] => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgbHex = (r: number, g: number, b: number): string => {
    const f = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
    return '#' + ((f(r) << 16) | (f(g) << 8) | f(b)).toString(16).padStart(6, '0');
  };
  const lumRGB = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
  const lum = (hex: string) => lumRGB(...hexRGB(hex));
  const squeeze = (hex: string, mid: number): string => {
    const c = scanC();
    const [r, g, b] = hexRGB(hex);
    const L = lumRGB(r, g, b);
    const s = L > 1 ? (mid + (L - mid) * c) / L : 1; // scale RGB to hit the target luma (keeps hue)
    return rgbHex(r * s, g * s, b * s);
  };
  const pair = (lightHex: string, darkHex: string) => {
    const mid = (lum(lightHex) + lum(darkHex)) / 2;
    return { light: squeeze(lightHex, mid), dark: squeeze(darkHex, mid) };
  };
  return { scanC, lum, squeeze, pair };
}
