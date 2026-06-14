import * as THREE from 'three';
import type { PropVoxel, QRTheme } from '../theme';
import type { QRMatrix } from '../../qr/generate';
import { makeDimmer } from '../scanContrast';

/**
 * Tháp Rùa — "The Island in the Lake".
 *
 * The Turtle Tower (built 1886) on its small islet in Hoàn Kiếm Lake, Hà Nội — a
 * square stone tower of diminishing tiers in weathered, moss-stained limestone,
 * pierced by pointed (gothic) arches: a three-bay arcade at the base and arched
 * windows in the tiers above, crowned by a small ornamental top story + finial.
 *
 * LAYOUT — radial, mirroring the photo. The tower stands on a grassy ISLAND at
 * the centre, ringed by a dense band of lush bushes, with a thin pale SHORE rim
 * where the grass meets the water, then the open jade LAKE filling the rest of
 * the field — lighter (reflective) near the island and deepening outward, dotted
 * with floating lily pads — and a far tree-line ringing the outer shore.
 *
 * SCANNABILITY — kept "forward" so the scan layer drops back in trivially. The
 * polarity rule is preserved everywhere (DARK module → LIGHT material, LIGHT
 * module → DARK material) so every zone already encodes the QR; the finder /
 * timing / alignment handling is retained; the tower's stone tops are encoded
 * and decorative props are `isoOnly` so they fold flat for a clean top-down decode.
 *
 * Three named variants are exported (dawn / verdant / dusk). `thapRuaTheme` is
 * the dawn default.
 */

// ---- footprint (module/voxel units) ----
const ISLAND_R = 15;    // grassy island radius (modules from centre)
const SHORE_BAND = 1.6; // pale sand/rock rim at the island's water edge
// const DAIS_R = 8;       // raised earth mound under the tower
const LAKE_RX = 46;     // lake basin half-width (x) — very wide → a gentle, shallow shore
const LAKE_RZ = 27;     // lake basin half-depth (z) — banks pulled out to the top/bottom edges

// tower tier half-widths (square plan, diminishing upward) — 3 tiers
const T1 = 6, T2 = 5, T3 = 3;
const ROOF_KEEP_R = 3;  // crown patch that keeps encoding (centre alignment pattern)

const GRASS_H = 1.3;    // raised island ground ("ink")
const WATER_H = 0.42;   // sunken lake height
// const PAD_H = 0.46;     // lily-pad height — flush with the water (one flat plane)

// ---- palette (variant-independent stonework / earth) ----
const STONE_PALE = '#c8bfa9'; // weathered tan-gray (upper tiers, sunlit)
const STONE_MID  = '#a3997e';
const STONE_DK   = '#635b48';
const STONE_MOSS = '#6a6f52'; // mossy green-gray (damp base)
const STONE_SILL = '#dfd6bd'; // pale carved sills / cornice highlight
const TRUNK = '#5a3b25';

const GRASS_LIGHT = '#a5c96b'; // sunlit island grass (light)
const GRASS_DARK  = '#263d1a'; // shaded earth / moss (dark)
const BUSH_LIGHT = ['#8cb85e', '#98c46a', '#7fae54'];
const BUSH_DARK  = ['#324c23', '#3d592b', '#2a431d'];
// flowering colour — bright blooms on shrubs + flower stalks (photo borders)
const FLOWER = ['#cf4636', '#e0a93a', '#8d5fae', '#4f86b0', '#d56a4f', '#cf5a86'];
// warm autumn / blossom canopies for the small flowering trees (the red branch)
const BLOSSOM = ['#c4452f', '#d56a3f', '#d98c2e', '#cf5a5a'];
// pale water-lily petals dotting the open water
const WATERLILY = ['#ecd9e0', '#f0e6c8', '#e6c0cd'];
const SAND_LIGHT = '#dfceaa'; // dry pale sand (light)
const SAND_DARK  = '#6b5c3e'; // wet sand at the waterline (dark)
const QR_FLOOR_LIGHT = '#e6dec6'; // stone top reading "dark module"
const QR_FLOOR_DARK = '#3d372a';  // stone top reading "light module"
const LEAF_LIGHT = ['#b0d17d', '#bdde8b', '#a2c46f'];
const LEAF_DARK = ['#3f572a', '#4a6334', '#374e24', '#31471f'];
const FIN_ROCK = '#e8e1cd';

const FIN_ROCK_H = GRASS_H + 0.8;
const FIN_REED = '#c2df8b';
const FIN_REED_H = GRASS_H + 0.3;
const FIN_DEEP = '#0c2927';
const FIN_DEEP_H = GRASS_H - 0.55;

// ---- per-variant palette (lake / sky / crown / bloom) ----
interface Variant {
  sky: string; sky2: string; fog: string; sun: string; ambient: number;
  lakeLit: string; lakeShallow: string; lakeDeep: string;
  padCol: string; lotus: string; lotusN: number; padN: number;
  crown: string;
}

export const VARIANTS: Record<string, Variant> = {
  dawn: {
    sky: '#cdd8d2', sky2: '#e9eee8', fog: '#dde4dd', sun: '#fbf3df', ambient: 0.70,
    lakeLit: '#baddce', lakeShallow: '#466e60', lakeDeep: '#183630',
    padCol: '#5c7f4e', lotus: '#efe6ec', lotusN: 0, padN: 22,
    crown: '#9d9379',
  },
  verdant: {
    sky: '#9fc1da', sky2: '#dde9ec', fog: '#cfe0e2', sun: '#fff5dc', ambient: 0.66,
    lakeLit: '#78cdb3', lakeShallow: '#236350', lakeDeep: '#0f2f28',
    padCol: '#4f7e42', lotus: '#f0ecd8', lotusN: 0, padN: 20,
    crown: '#9d9379',
  },
  dusk: {
    sky: '#e8c08e', sky2: '#f4e0bd', fog: '#eed3aa', sun: '#ffd79f', ambient: 0.54,
    lakeLit: '#8cc2b3', lakeShallow: '#28544d', lakeDeep: '#142c2d',
    padCol: '#557a48', lotus: '#f0a6c4', lotusN: 16, padN: 14,
    crown: '#b08a4a',
  },
};

// ---- helpers ----
const shade = (() => {
  const c = new THREE.Color();
  return (hex: string, dl: number) => {
    c.set(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + dl, 0, 1));
    return `#${c.getHexString()}`;
  };
})();

// Top-down scan contrast. 1 = original palette gap; lower melts the code into the
// terrain. Measured clean-decode floor is ~0.22 top-down; 0.33 keeps a ~1.5× real-world
// margin. See ../scanContrast for the mechanism (and globalThis.__scanC for live tuning).
const SCAN_CONTRAST = 0.33;
const { pair: dimPair, scanC, lum, squeeze } = makeDimmer(SCAN_CONTRAST);

function rand2(a: number, b: number): number {
  let h = (Math.imul(a + 7, 73856093) ^ Math.imul(b + 13, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}
function hashText(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inFinderZone(qRow: number, qCol: number, modules: number): boolean {
  const lo = 7, hi = modules - 8;
  const top = qRow >= 0 && qRow <= lo, bottom = qRow >= hi && qRow <= modules - 1;
  const left = qCol >= 0 && qCol <= lo, right = qCol >= hi && qCol <= modules - 1;
  return (top && left) || (top && right) || (bottom && left);
}
function finderRing(qRow: number, qCol: number, modules: number): number {
  const centres: Array<[number, number]> = [[3, 3], [3, modules - 4], [modules - 4, 3]];
  let best = 99;
  for (const [cr, cc] of centres) best = Math.min(best, Math.max(Math.abs(qRow - cr), Math.abs(qCol - cc)));
  return best;
}

// radial zones, but the surrounding shore is planted on only TWO opposite sides:
//   a grassy ISLAND at the centre, then open LAKE, with wooded+flowering BANKs
//   lining the top & bottom edges (the other two sides stay open water).
type Zone = 'island' | 'shore' | 'lake' | 'bank';
function radius(qCol: number, qRow: number, modules: number): number {
  const center = (modules - 1) / 2;
  return Math.hypot(qCol - center, qRow - center);
}
function zoneOf(qCol: number, qRow: number, modules: number): Zone {
  const center = (modules - 1) / 2;
  const dx = qCol - center, dz = qRow - center;
  const r = Math.hypot(dx, dz);
  if (r <= ISLAND_R) return r > ISLAND_R - SHORE_BAND ? 'shore' : 'island';
  // an elliptical lake basin holds the water; planted banks wrap the top & bottom
  // with a rounded shore that curves in toward the centre — left & right stay open.
  const nx = dx / LAKE_RX, nz = dz / LAKE_RZ;
  if (nx * nx + nz * nz < 1) return 'lake';
  return Math.abs(nz) > Math.abs(nx) ? 'bank' : 'lake';
}
function fromShore(qCol: number, qRow: number, modules: number): number {
  return radius(qCol, qRow, modules) - ISLAND_R;
}

// =====================================================================
//  THE TURTLE TOWER — square stone tower, diminishing tiers, pointed arches
// =====================================================================
function buildTower(
  ccol: number, crow: number, baseY: number, _rng: () => number, matrix: QRMatrix, V: Variant,
): PropVoxel[] {
  const map = new Map<string, PropVoxel>();
  const extras: PropVoxel[] = [];
  const put = (x: number, z: number, layer: number, color: string, size = 1) => {
    map.set(`${x}|${z}|${layer}`, { col: ccol + x, row: crow + z, y: baseY + layer, size, color });
  };
  const del = (x: number, z: number, layer: number) => map.delete(`${x}|${z}|${layer}`);
  const plate = (layer: number, hw: number, color: string, rim?: string) => {
    for (let x = -hw; x <= hw; x++)
      for (let z = -hw; z <= hw; z++)
        put(x, z, layer, rim && Math.max(Math.abs(x), Math.abs(z)) === hw ? rim : color);
  };

  const TOWER_TOP = 21;
  const stoneColor = (x: number, z: number, l: number) => {
    const r = rand2(x * 7 + l * 5, z * 9 + l * 3);
    const t = l / TOWER_TOP;
    let base = t < 0.30 ? STONE_MOSS : t < 0.62 ? STONE_MID : STONE_PALE;
    if (r < 0.13) base = STONE_DK;
    return shade(base, (r - 0.5) * 0.06);
  };

  const wallRing = (l0: number, l1: number, hw: number) => {
    for (let l = l0; l <= l1; l++)
      for (let x = -hw; x <= hw; x++)
        for (let z = -hw; z <= hw; z++)
          if (Math.max(Math.abs(x), Math.abs(z)) === hw) put(x, z, l, stoneColor(x, z, l));
  };
  // carve pointed arches — side cells are 1 shorter than the centre (gothic point)
  const carveArches = (sill: number, archH: number, hw: number, centres: number[], halfW: number) => {
    for (const c of centres)
      for (let d = -halfW; d <= halfW; d++) {
        const reduce = Math.abs(d);
        for (let y = sill; y <= sill + archH - 1 - reduce; y++) {
          del(c + d, hw, y); del(c + d, -hw, y);
          del(hw, c + d, y); del(-hw, c + d, y);
        }
      }
  };

  // raised stone base / island plinth (two courses)
  plate(0, T1 + 2, STONE_DK, shade(STONE_DK, -0.04));
  plate(1, T1 + 1, shade(STONE_MID, 0.02));

  // diminishing tiers
  const tiers = [
    { hw: T1, h: 7, centres: [-4, 0, 4], halfW: 1, archH: 5 }, // ground arcade — 3 wide bays
    { hw: T2, h: 5, centres: [-3, 0, 3], halfW: 0, archH: 3 }, // arched windows
    { hw: T3, h: 4, centres: [0],        halfW: 0, archH: 3 }, // top story — single window per face
  ];
  let cur = 2;
  let lastTopHw = T3;
  for (const T of tiers) {
    const l1 = cur + T.h - 1;
    wallRing(cur, l1, T.hw);
    carveArches(cur + 1, T.archH, T.hw, T.centres, T.halfW);
    plate(l1 + 1, T.hw + 1, STONE_MID, shade(STONE_DK, 0.02));
    for (const c of T.centres)
      for (let d = -T.halfW; d <= T.halfW; d++) {
        put(c + d, T.hw, cur, STONE_SILL); put(c + d, -T.hw, cur, STONE_SILL);
        put(T.hw, c + d, cur, STONE_SILL); put(-T.hw, c + d, cur, STONE_SILL);
      }
    lastTopHw = T.hw;
    cur += T.h + 1;
  }

  // ornamental crown + slender finial
  const capBase = cur;
  plate(capBase, lastTopHw, V.crown, shade(STONE_DK, 0.02));
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]])
    extras.push({ col: ccol + sx * lastTopHw, row: crow + sz * lastTopHw, y: baseY + capBase + 0.6, size: 0.7, color: STONE_SILL, isoOnly: true, collapseTo: baseY + capBase });
  plate(capBase + 1, lastTopHw - 1, V.crown);
  plate(capBase + 2, Math.max(1, lastTopHw - 2), shade(V.crown, 0.04));
  extras.push(
    { col: ccol, row: crow, y: baseY + capBase + 3.0, size: 0.55, color: STONE_SILL, isoOnly: true, collapseTo: baseY + capBase },
    { col: ccol, row: crow, y: baseY + capBase + 3.7, size: 0.4, color: V.crown, isoOnly: true, collapseTo: baseY + capBase },
    { col: ccol, row: crow, y: baseY + capBase + 4.3, size: 0.28, color: shade(V.crown, -0.08), isoOnly: true, collapseTo: baseY + capBase },
  );

  // encode the QR on the tower's flat stone tops (crown stays solid except keep-patch)
  const top = new Map<string, { layer: number; key: string; x: number; z: number }>();
  for (const key of map.keys()) {
    const [x, z, layer] = key.split('|').map(Number);
    const ck = `${x}|${z}`; const cur2 = top.get(ck);
    if (!cur2 || layer > cur2.layer) top.set(ck, { layer, key, x, z });
  }
  for (const { key, x, z, layer } of top.values()) {
    const v = map.get(key)!;
    const gr = crow + z, gc = ccol + x;
    const isDark = !!(matrix.cells[gr] && matrix.cells[gr][gc]);
    const inKeepPatch = Math.max(Math.abs(x), Math.abs(z)) <= ROOF_KEEP_R;
    if (layer >= capBase && !inKeepPatch) continue;
    const floor = dimPair(QR_FLOOR_LIGHT, QR_FLOOR_DARK);
    v.color = isDark ? floor.light : floor.dark;
  }

  // Up-lighting for the tower at night (warm golden light)
  const upLightColor = '#ffad33';
  for (const [lx, lz] of [[T1 + 1.5, T1 + 1.5], [T1 + 1.5, -(T1 + 1.5)], [-(T1 + 1.5), T1 + 1.5], [-(T1 + 1.5), -(T1 + 1.5)]]) {
    extras.push({
      col: ccol + lx,
      row: crow + lz,
      y: baseY + 1.8,
      size: 0.3,
      color: upLightColor,
      glowing: true,
      isoOnly: true,
      light: { color: upLightColor, intensity: 5.5, distance: 25 },
    });
  }
  
  // Upper tier corner lights (glowing + soft point light for extra brightness)
  for (const [lx, lz] of [[T2 + 0.8, T2 + 0.8], [T2 + 0.8, -(T2 + 0.8)], [-(T2 + 0.8), T2 + 0.8], [-(T2 + 0.8), -(T2 + 0.8)]]) {
    extras.push({
      col: ccol + lx, row: crow + lz, y: baseY + 10.5, size: 0.3, color: upLightColor, glowing: true, isoOnly: true,
      light: { color: upLightColor, intensity: 2.5, distance: 12 }
    });
  }

  // Internal glow inside the arches for all 3 tiers
  extras.push({ // Ground tier
    col: ccol, row: crow, y: baseY + 4, size: 0.2, color: '#ffcc66', glowing: true, isoOnly: true,
    light: { color: '#ffcc66', intensity: 4.5, distance: 15 }
  });
  extras.push({ // Middle tier
    col: ccol, row: crow, y: baseY + 12, size: 0.2, color: '#ffcc66', glowing: true, isoOnly: true,
    light: { color: '#ffcc66', intensity: 3.0, distance: 12 }
  });
  extras.push({ // Top tier
    col: ccol, row: crow, y: baseY + 18, size: 0.2, color: '#ffcc66', glowing: true, isoOnly: true,
    light: { color: '#ffcc66', intensity: 2.0, distance: 10 }
  });

  return [...map.values(), ...extras];
}

// =====================================================================
//  ISLAND BUSHES + TREES + FINDER ROCK ISLETS (fold flat for scanning)
// =====================================================================
function bush(ccol: number, crow: number, baseY: number, x: number, z: number, rnd: number): PropVoxel[] {
  const iso = { isoOnly: true as const, collapseTo: baseY };
  const lg = BUSH_LIGHT[Math.floor(rnd * 997) % BUSH_LIGHT.length];
  const dg = BUSH_DARK[Math.floor(rnd * 601) % BUSH_DARK.length];
  const out: PropVoxel[] = [
    { col: ccol + x, row: crow + z, y: baseY, size: 0.95, color: dg, ...iso },
    { col: ccol + x, row: crow + z, y: baseY + 0.7, size: 1.0, color: lg, ...iso },
    { col: ccol + x, row: crow + z, y: baseY + 1.35, size: 0.6, color: shade(lg, 0.04), ...iso },
  ];
  // a flowering shrub — a bright bloom cap in one of the photo's border colours
  if (rnd > 0.5) {
    const f = FLOWER[Math.floor(rnd * 131) % FLOWER.length];
    out.push({ col: ccol + x, row: crow + z, y: baseY + 1.75, size: 0.42, color: f, ...iso });
  }
  return out;
}

// a slim flowering stalk — reeds topped by a bright blossom (foreground colour)
function flowerCluster(ccol: number, crow: number, baseY: number, x: number, z: number, rnd: number): PropVoxel[] {
  const iso = { isoOnly: true as const, collapseTo: baseY };
  const f = FLOWER[Math.floor(rnd * 271) % FLOWER.length];
  return [
    { col: ccol + x, row: crow + z, y: baseY, size: 0.4, color: BUSH_DARK[0], ...iso },
    { col: ccol + x, row: crow + z, y: baseY + 0.55, size: 0.32, color: BUSH_LIGHT[1], ...iso },
    { col: ccol + x, row: crow + z, y: baseY + 1.05, size: 0.46, color: f, ...iso },
  ];
}

// a small flowering tree — a warm autumn / blossom canopy (the red branch)
function blossomTree(col: number, row: number, gy: number, rnd: number): PropVoxel[] {
  const iso = { isoOnly: true as const, collapseTo: gy };
  const warm = BLOSSOM[Math.floor(rnd * 467) % BLOSSOM.length];
  const tiers = 3 + Math.floor(rnd * 3);
  const out: PropVoxel[] = [{ col, row, y: gy, size: 0.5, color: TRUNK, ...iso }];
  for (let i = 0; i < tiers; i++) {
    const isCrown = i === tiers - 1;
    out.push({
      col, row, y: gy + 0.7 + i * 0.85, size: 0.95,
      color: i >= tiers - 2 ? warm : shade(warm, -0.12),
      ...(isCrown ? { isoOnly: true as const, tile: true, collapseTo: GRASS_H } : iso),
    });
  }
  return out;
}

function makeTree(col: number, row: number, gy: number, rnd: number, heightScale = 1): PropVoxel[] {
  const lg = LEAF_LIGHT[Math.floor(rnd * 997) % LEAF_LIGHT.length];
  const dg = LEAF_DARK[Math.floor(rnd * 601) % LEAF_DARK.length];
  const W = 0.98;
  const base = rnd < 0.2 ? 3 : rnd < 0.5 ? 5 : rnd < 0.78 ? 7 : 9;
  const tiers = Math.max(2, Math.round(base * heightScale));
  const fold = { isoOnly: true as const, collapseTo: gy };
  const out: PropVoxel[] = [{ col, row, y: gy, size: 0.5, color: TRUNK, ...fold }];
  const lightFrom = Math.ceil(tiers / 2);
  for (let i = 0; i < tiers; i++) {
    const isCrown = i === tiers - 1;
    out.push({
      col, row, y: gy + 0.7 + i * 0.9, size: W, color: i >= lightFrom ? lg : dg,
      ...(isCrown ? { isoOnly: true as const, tile: true, collapseTo: GRASS_H } : fold),
    });
  }
  return out;
}

// =====================================================================
//  THEME FACTORY
// =====================================================================
export function makeThapRua(variantKey: keyof typeof VARIANTS | string = 'dawn'): QRTheme {
  const V = VARIANTS[variantKey] ?? VARIANTS.dawn;
  // the lake is a dark/light pair too: V.lakeLit (dark-module material) vs the
  // shallow→deep gradient (light-module material). Squeeze both toward their shared
  // mid so the water's contrast drops with everything else.
  const lakeMid = (lum(V.lakeLit) + lum(V.lakeShallow)) / 2;

  return {
    name: 'Tháp Rùa',
    sampleText: 'https://en.wikipedia.org/wiki/Turtle_Tower',
    background: V.sky,
    background2: V.sky2,
    fog: V.fog,
    groundColor: V.lakeDeep,
    lightColor: '#d8ccab',
    darkColor: V.lakeDeep,
    lightSceneColor: V.lakeDeep,
    lightSceneHeight: WATER_H,
    sunColor: V.sun,
    ambient: V.ambient,

    // DARK modules → the LIGHT material of the zone
    column: ({ qRow, qCol, modules, rand }) => {
      if (inFinderZone(qRow, qCol, modules)) {
        return finderRing(qRow, qCol, modules) <= 1
          ? { height: FIN_ROCK_H, scanHeight: GRASS_H, color: FIN_ROCK }
          : { height: FIN_REED_H, scanHeight: GRASS_H, color: FIN_REED };
      }
      const v = (rand - 0.5) * 0.05 * scanC(); // jitter shrinks with contrast
      switch (zoneOf(qCol, qRow, modules)) {
        case 'island': return { height: GRASS_H, color: shade(dimPair(GRASS_LIGHT, GRASS_DARK).light, v) };
        case 'shore': return { height: GRASS_H, color: shade(dimPair(SAND_LIGHT, SAND_DARK).light, v) };
        case 'bank': return { height: GRASS_H, color: shade(dimPair(GRASS_LIGHT, GRASS_DARK).light, v) };
        case 'lake':
          // a reflective "lit" ripple — keeps the lake reading as a flat
          // shimmering plane (lit vs deep) rather than a lawn of pads.
          return { height: WATER_H + 0.03, scanHeight: GRASS_H, color: shade(squeeze(V.lakeLit, lakeMid), v) };
      }
      return { height: GRASS_H, color: shade(dimPair(GRASS_LIGHT, GRASS_DARK).light, v) };
    },

    // LIGHT modules → the DARK material of the zone
    light: ({ qRow, qCol, modules, rand }) => {
      if (inFinderZone(qRow, qCol, modules)) return { height: FIN_DEEP_H, scanHeight: GRASS_H, color: FIN_DEEP };
      const v = (rand - 0.5) * 0.05 * scanC();
      switch (zoneOf(qCol, qRow, modules)) {
        case 'island': return { height: GRASS_H - 0.3, color: shade(dimPair(GRASS_LIGHT, GRASS_DARK).dark, v) };
        case 'shore': return { height: GRASS_H - 0.2, color: shade(dimPair(SAND_LIGHT, SAND_DARK).dark, v) };
        case 'bank': return { height: GRASS_H - 0.3, color: shade(dimPair(GRASS_LIGHT, GRASS_DARK).dark, v) };
        case 'lake': {
          // jade water — lighter (reflective) near the stone, deepening outward,
          // both endpoints squeezed toward the lake's mid so contrast drops too
          const d = fromShore(qCol, qRow, modules);
          const t = THREE.MathUtils.clamp(d / 16, 0, 1);
          const c = new THREE.Color(squeeze(V.lakeShallow, lakeMid)).lerp(new THREE.Color(squeeze(V.lakeDeep, lakeMid)), t);
          return { height: WATER_H, scanHeight: GRASS_H, color: `#${c.getHexString()}` };
        }
      }
      return { height: GRASS_H - 0.3, color: shade(dimPair(GRASS_LIGHT, GRASS_DARK).dark, v) };
    },

    props: (matrix: QRMatrix): PropVoxel[] => {
      const qz = matrix.quietZone, n = matrix.modules;
      const center = (n - 1) / 2;
      const ccol = Math.round(qz + center), crow = Math.round(qz + center);
      const reach = Math.round(center);
      const rng = mulberry32(hashText(matrix.text));
      const out: PropVoxel[] = [];

      out.push(...buildTower(ccol, crow, GRASS_H, rng, matrix, V));

      // floating lily pads (and, in dusk, lotus blooms) — props only, so the flat
      // scan plane stays clean.
      const scatterN = (V.padN || 0) + (V.lotusN || 0);
      let placed = 0, lotusLeft = V.lotusN || 0;
      for (let i = 0; i < scatterN * 9 && placed < scatterN; i++) {
        const ang = rng() * Math.PI * 2;
        const rr = ISLAND_R + 2.5 + rng() * (reach - ISLAND_R - 4.5);
        const x = Math.round(Math.cos(ang) * rr), z = Math.round(Math.sin(ang) * rr);
        if (Math.hypot(x, z) > reach - 2) continue;
        // keep pads on open water — skip the planted banks
        const nbx = x / LAKE_RX, nbz = z / LAKE_RZ;
        if (nbx * nbx + nbz * nbz >= 1 && Math.abs(nbz) > Math.abs(nbx)) continue;
        out.push({ col: ccol + x, row: crow + z, y: WATER_H - 0.06, size: 0.6, color: shade(V.padCol, (rng() - 0.5) * 0.08), isoOnly: true, collapseTo: GRASS_H });
        if (lotusLeft > 0 && rng() > 0.45) {
          out.push({ col: ccol + x, row: crow + z, y: WATER_H + 0.22, size: 0.32, color: V.lotus, isoOnly: true, collapseTo: GRASS_H });
          lotusLeft--;
        } else if (rng() > 0.74) {
          // a pale water-lily flower floating on the pad
          const wl = WATERLILY[Math.floor(rng() * WATERLILY.length)];
          out.push({ col: ccol + x, row: crow + z, y: WATER_H + 0.18, size: 0.26, color: wl, isoOnly: true, collapseTo: GRASS_H });
        }
        placed++;
      }


      // plant the two wooded banks (trees + flowers); keep the islet simple green
      // and the other two sides open water.
      const rOf = (r: number, c: number) => Math.hypot(c - qz - center, r - qz - center);
      for (let r = 0; r < matrix.size; r++)
        for (let c = 0; c < matrix.size; c++) {
          if (!matrix.cells[r][c]) continue;          // grass / pad cells (dark) only
          if (r - qz === 6 || c - qz === 6) continue; // never on timing patterns
          const zone = zoneOf(c - qz, r - qz, n);
          const rm = rOf(r, c);
          const rr = rand2(r, c);
          if (inFinderZone(c - qz, r - qz, n)) {
            continue; // Keep the finder patterns completely clean of props
          }
          if (zone === 'island' || zone === 'shore') {
            // the islet stays low — a green vegetated rim, nothing tall in the middle
            if (rm >= ISLAND_R - 4 && rm <= ISLAND_R - 0.4 && rr < 0.5) {
              out.push(...bush(ccol, crow, GRASS_H, c - ccol, r - crow, rr * 0.55));
            }
          } else if (zone === 'bank') {
            // the planted banks — trees, flowering shrubs and blossom trees
            if (rr < 0.4) out.push(...makeTree(c, r, GRASS_H - 0.15, rr, 0.95));
            else if (rr < 0.56) out.push(...bush(ccol, crow, GRASS_H, c - ccol, r - crow, 0.55 + rr * 0.4));
            else if (rr < 0.66) out.push(...flowerCluster(ccol, crow, GRASS_H, c - ccol, r - crow, rr));
            else if (rr > 0.93) out.push(...blossomTree(c, r, GRASS_H - 0.15, rr));
            else if (rr > 0.88) {
               // Park lamp posts along the bank
               const parkLightColor = '#ffcc88';
               out.push({ col: c, row: r, y: GRASS_H + 0.5, size: 0.15, color: '#2a3a2a', isoOnly: true }); // short pole
               const lampProps: PropVoxel = { col: c, row: r, y: GRASS_H + 1.2, size: 0.3, color: parkLightColor, glowing: true, isoOnly: true };
               // Give ~20% of lamps a real point light to light up the grass, to stay within WebGL limits
               if (rr > 0.92) {
                 lampProps.light = { color: parkLightColor, intensity: 3.0, distance: 15 };
               }
               out.push(lampProps);
            }
          }
        }

      return out;
    },
  };
}

// Drop-in default (dawn). Register in themes/index.ts to expose it in the switcher.
export const thapRuaTheme: QRTheme = makeThapRua('dawn');
export const thapRuaVerdantTheme: QRTheme = makeThapRua('verdant');
export const thapRuaDuskTheme: QRTheme = makeThapRua('dusk');
