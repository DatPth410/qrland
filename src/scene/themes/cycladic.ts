import * as THREE from 'three';
import type { PropVoxel, QRTheme } from '../theme';
import type { QRMatrix } from '../../qr/generate';

/**
 * Cycladic archipelago. Dark QR modules become raised LIGHT sand; light modules
 * become the dark blue SEA. Seen straight down, light-sand-on-dark-sea is a
 * high-contrast (inverted) QR that scanners decode — the island stays 3D and is
 * scannable from the top.
 *
 * Only the building's small sand pad overwrites the code; everything around it
 * is REAL QR data. Trees sit on real sand-module clusters (so they move with the
 * data), and the church is seeded from the payload (dome height, tower, windows)
 * so each URL renders a slightly different church. The pad/footprint stays fixed
 * so error-correction capacity — and scannability — is unchanged across inputs.
 */

// --- sizing (module/voxel units) ---
const PAD_R = 7.5; // sand pad under the church (the ONLY overwritten zone)
const PLAZA_R = 7; // round plaza radius
const BODY_R = 5; // church body half-width
const BODY_H = 6; // church body height
const DRUM_R = 4; // dome drum radius
const DOME_R = 5; // dome base radius

const SAND_H = 1.3;
const SEA_H = 0.5;
const SAND_VAR = 0.06;

// --- palette: bright sand vs a clearly-blue (but still dark enough to scan)
//     Aegean sea. Sand stays the light "ink"; sea is the dark "paper". ---
const SAND = '#ecdfbb';
const SAND_ISLAND = '#f1e7cd';
const SEA = '#144f68';
const STONE = '#e8e2d2';
const WHITE = '#eef0ec';
const WHITE_SH = '#dde0d8';
const WHITE_DK = '#cdd1c9';
const DOME = '#2f72b4';
const DOME_TOP = '#4a93cf';
const DOME_DARK = '#255f92';
const BLUE_TRIM = '#244f7a';
const CROSS = '#d8c879';
const TRUNK = '#7b5a39';
// tree foliage: the TOP voxel (what a top-down scanner sees) is a LIGHT green so
// the cell still reads "light" like the sand module it covers — so a full-cell
// tree keeps the QR bit instead of flipping it. Lower voxels are DARK green for
// depth in the isometric view.
const LEAF_LIGHT = ['#abc77f', '#b6d089', '#a1bd76'];
const LEAF_DARK = ['#5f7e40', '#6e8e4e', '#557237', '#4a6a33'];
const ROCK = '#9a937f';

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

function rand2(a: number, b: number): number {
  let h = (Math.imul(a + 7, 73856093) ^ Math.imul(b + 13, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

/** FNV-1a hash of the payload → a stable per-URL seed */
function hashText(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** small deterministic PRNG seeded from the payload */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Whitewashed church, seeded by the payload so each URL renders a slightly
 * different building (dome height, campanile corner + height, window pattern,
 * steps) — all within the fixed pad footprint, so scannability is unchanged.
 */
function buildChurch(ccol: number, crow: number, baseY: number, rng: () => number): PropVoxel[] {
  const map = new Map<string, PropVoxel>();
  const extras: PropVoxel[] = [];
  const put = (x: number, z: number, layer: number, color: string, size = 1) => {
    map.set(`${x}|${z}|${layer}`, { col: ccol + x, row: crow + z, y: baseY + layer, size, color });
  };
  const disk = (layer: number, r: number, color: string) => {
    const ri = Math.ceil(r);
    for (let x = -ri; x <= ri; x++)
      for (let z = -ri; z <= ri; z++) if (x * x + z * z <= r * r) put(x, z, layer, color);
  };

  // --- seeded variations (footprint stays inside the pad) ---
  const domeH = DOME_R + 1 + Math.floor(rng() * 3) * 0.7; // dome height: 6 / 6.7 / 7.4
  const corners = [
    [-BODY_R, BODY_R],
    [BODY_R, BODY_R],
    [-BODY_R, -BODY_R],
    [BODY_R, -BODY_R],
  ];
  const [tx, tz] = corners[Math.floor(rng() * 4)]; // campanile corner
  const towerH = BODY_H + 2 + Math.floor(rng() * 4); // campanile height
  const wphase = Math.floor(rng() * 2); // window pattern offset
  const nSteps = 2 + Math.floor(rng() * 3); // entrance steps

  // round stepped plaza (two tiers), kept inside the pad
  for (let x = -PLAZA_R; x <= PLAZA_R; x++)
    for (let z = -PLAZA_R; z <= PLAZA_R; z++) {
      const d2 = x * x + z * z;
      if (d2 > PLAZA_R * PLAZA_R) continue;
      put(x, z, 0, d2 > (PLAZA_R - 1) * (PLAZA_R - 1) ? shade(STONE, -0.05) : STONE);
      if (d2 <= (PLAZA_R - 1.5) * (PLAZA_R - 1.5)) put(x, z, 1, shade(STONE, 0.02));
    }

  // main body (shelled) + arched windows
  for (let x = -BODY_R; x <= BODY_R; x++)
    for (let z = -BODY_R; z <= BODY_R; z++) {
      const onWall = Math.abs(x) === BODY_R || Math.abs(z) === BODY_R;
      for (let l = 2; l <= BODY_H + 1; l++) {
        if (!onWall && l !== BODY_H + 1) continue;
        put(x, z, l, onWall ? ((x + z) & 1 ? WHITE_SH : WHITE) : WHITE_DK);
      }
    }
  for (let x = -BODY_R + 1 + wphase; x <= BODY_R - 1; x += 2) {
    put(x, BODY_R, 4, BLUE_TRIM);
    put(x, -BODY_R, 4, BLUE_TRIM);
    put(BODY_R, x, 4, BLUE_TRIM);
    put(-BODY_R, x, 4, BLUE_TRIM);
  }

  // front portico / colonnade
  const pz = BODY_R + 1;
  for (let x = -BODY_R; x <= BODY_R; x++) {
    const pillar = (x + BODY_R) % 2 === 0;
    for (let l = 1; l <= 4; l++) if (pillar || l === 4) put(x, pz, l, l === 4 ? WHITE : WHITE_SH);
  }
  for (let x = -BODY_R; x <= BODY_R; x++) put(x, pz, 5, STONE);

  // windowed drum
  disk(BODY_H + 2, DRUM_R, WHITE);
  disk(BODY_H + 3, DRUM_R, WHITE);
  for (const [x, z] of [
    [DRUM_R, 0],
    [-DRUM_R, 0],
    [0, DRUM_R],
    [0, -DRUM_R],
  ])
    put(x, z, BODY_H + 3, BLUE_TRIM);

  // rounded dome (seeded height)
  const domeBase = BODY_H + 4;
  let topL = domeBase;
  for (let l = 0; l <= domeH; l++) {
    const r = DOME_R * Math.sqrt(Math.max(0, 1 - (l / domeH) ** 2));
    if (r < 0.4) {
      put(0, 0, domeBase + l, DOME_TOP);
      topL = domeBase + l;
      break;
    }
    disk(domeBase + l, r, l === 0 ? DOME_DARK : l > domeH - 2 ? DOME_TOP : DOME);
    topL = domeBase + l;
  }
  // cross atop the dome
  extras.push(
    { col: ccol, row: crow, y: baseY + topL + 0.7, size: 0.45, color: CROSS },
    { col: ccol, row: crow, y: baseY + topL + 1.6, size: 0.45, color: CROSS },
    { col: ccol - 0.65, row: crow, y: baseY + topL + 1.1, size: 0.45, color: CROSS },
    { col: ccol + 0.65, row: crow, y: baseY + topL + 1.1, size: 0.45, color: CROSS },
  );

  // campanile at the seeded corner, with seeded height
  for (let l = 1; l <= towerH; l++)
    put(tx, tz, l, l === Math.round(towerH * 0.7) ? BLUE_TRIM : WHITE);
  put(tx, tz, towerH + 1, DOME, 0.9);
  extras.push(
    { col: ccol + tx, row: crow + tz, y: baseY + towerH + 2, size: 0.32, color: CROSS },
    { col: ccol + tx, row: crow + tz, y: baseY + towerH + 2.7, size: 0.32, color: CROSS },
  );

  // entrance steps (seeded count) in front of the portico
  for (let s = 1; s <= nSteps; s++) put(0, pz + s, 0, shade(STONE, -0.03 * s));

  return [...map.values(), ...extras];
}

/**
 * A tree with one of four silhouettes chosen by `rnd` — low bush, round tree,
 * tall tree, or a tall Mediterranean cypress. Canopies are kept narrow (< ~0.85)
 * so, from straight down, the sand module underneath still shows and the tree
 * doesn't flip a QR bit.
 */
function makeTree(col: number, row: number, gy: number, rnd: number): PropVoxel[] {
  const lg = LEAF_LIGHT[Math.floor(rnd * 997) % LEAF_LIGHT.length]; // light TOP (reads light)
  const dg = LEAF_DARK[Math.floor(rnd * 601) % LEAF_DARK.length]; // dark body (depth)
  const t = TRUNK;
  const W = 0.92; // canopy nearly fills the cell, so the top is a clean QR "light" cell
  if (rnd < 0.2) {
    // bush (one full light-green cell)
    return [{ col, row, y: gy, size: W, color: lg }];
  }
  if (rnd < 0.5) {
    // round tree (~1.7 tall)
    return [
      { col, row, y: gy, size: 0.42, color: t },
      { col, row, y: gy + 0.45, size: W, color: dg },
      { col, row, y: gy + 1.3, size: W, color: lg },
    ];
  }
  if (rnd < 0.78) {
    // tall tree (~2.5 tall)
    return [
      { col, row, y: gy, size: 0.42, color: t },
      { col, row, y: gy + 0.45, size: W, color: dg },
      { col, row, y: gy + 1.3, size: W, color: dg },
      { col, row, y: gy + 2.15, size: W, color: lg },
    ];
  }
  // cypress (~3.4 tall)
  return [
    { col, row, y: gy, size: 0.36, color: t },
    { col, row, y: gy + 0.45, size: 0.86, color: dg },
    { col, row, y: gy + 1.3, size: 0.86, color: dg },
    { col, row, y: gy + 2.15, size: 0.86, color: dg },
    { col, row, y: gy + 3.0, size: 0.84, color: lg },
  ];
}

export const cycladicTheme: QRTheme = {
  name: 'Cyclades',
  background: '#e3e9ec',
  background2: '#acc0c9',
  fog: '#c2d0d6',
  groundColor: '#0d394d',
  lightColor: '#ecdfbb',
  darkColor: '#144f68',
  lightSceneColor: SEA,
  lightSceneHeight: SEA_H,
  sunColor: '#fff4e2',
  ambient: 0.6,

  column: ({ qRow, qCol, modules, rand }) => {
    const center = (modules - 1) / 2;
    const rMod = Math.hypot(qCol - center, qRow - center);
    if (rMod <= PAD_R) return { height: SAND_H, color: shade(SAND_ISLAND, (rand - 0.5) * 0.03) };
    return { height: SAND_H - 0.15 + rand * SAND_VAR, color: shade(SAND, (rand - 0.5) * 0.04) };
  },

  props: (matrix: QRMatrix): PropVoxel[] => {
    const qz = matrix.quietZone;
    const n = matrix.modules;
    const center = (n - 1) / 2;
    const ccol = Math.round(qz + center);
    const crow = Math.round(qz + center);
    const rng = mulberry32(hashText(matrix.text));
    const out: PropVoxel[] = [];

    const rOf = (r: number, c: number) => Math.hypot(c - qz - center, r - qz - center);

    // fill only the small church pad solid (the church needs flat ground)
    for (let r = 0; r < matrix.size; r++)
      for (let c = 0; c < matrix.size; c++) {
        if (matrix.cells[r][c]) continue;
        if (rOf(r, c) > PAD_R) continue;
        out.push({
          col: c,
          row: r,
          y: SAND_H - 1,
          size: 1,
          color: shade(SAND_ISLAND, (rand2(r, c) - 0.5) * 0.03),
        });
      }

    // the seeded church
    out.push(...buildChurch(ccol, crow, SAND_H, rng));

    // trees on REAL sand modules, distributed AROUND the church: bucket
    // candidate sandbars into angular sectors so every side gets some (and they
    // still vary per URL because the candidate set is the data)
    const SECTORS = 26;
    const buckets: Array<Array<{ r: number; c: number }>> = Array.from(
      { length: SECTORS },
      () => [],
    );
    for (let r = 0; r < matrix.size; r++)
      for (let c = 0; c < matrix.size; c++) {
        if (!matrix.cells[r][c]) continue; // real sand only
        const rMod = rOf(r, c);
        if (rMod < PAD_R + 0.5 || rMod > PAD_R + 14) continue; // band around the church
        const sec =
          Math.floor(
            ((Math.atan2(r - qz - center, c - qz - center) + Math.PI) / (2 * Math.PI)) * SECTORS,
          ) % SECTORS;
        buckets[sec].push({ r, c });
      }

    let trees = 0;
    const MAX_TREES = 175;
    for (let s = 0; s < SECTORS; s++) {
      const cand = buckets[s];
      if (!cand.length) continue;
      cand.sort((a, b) => rand2(a.r, a.c) - rand2(b.r, b.c)); // deterministic, data-dependent
      const take = Math.min(cand.length, 5 + Math.floor(rng() * 3)); // 5-7 per sector
      for (let i = 0; i < take && trees < MAX_TREES; i++) {
        out.push(...makeTree(cand[i].c, cand[i].r, SAND_H - 0.15, rand2(cand[i].c, cand[i].r)));
        trees++;
      }
    }

    // a few sea rocks for detail
    let rocks = 0;
    for (let r = 0; r < matrix.size && rocks < 12; r++)
      for (let c = 0; c < matrix.size && rocks < 12; c++) {
        if (matrix.cells[r][c]) continue;
        const rMod = rOf(r, c);
        const rnd = rand2(r, c);
        if (rMod > PAD_R + 2 && rMod < PAD_R + 11 && rnd > 0.95) {
          out.push({ col: c, row: r, y: SEA_H, size: 0.4 + rnd * 0.3, color: shade(ROCK, (rnd - 0.5) * 0.1) });
          rocks++;
        }
      }
    return out;
  },
};
