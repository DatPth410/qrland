import * as THREE from 'three';
import type { PropVoxel, QRTheme } from '../theme';
import type { QRMatrix } from '../../qr/generate';
import { makeDimmer } from '../scanContrast';

/**
 * Cycladic archipelago. Dark QR modules become raised LIGHT sand; light modules
 * become the dark blue SEA. Seen straight down, light-sand-on-dark-sea is a
 * high-contrast (inverted) QR that scanners decode — the island stays 3D and is
 * scannable from the top.
 *
 * The church's walls, plaza and courtyard encode REAL QR data on their top faces,
 * but its DOME is left a solid Aegean-blue roof — the classic Cycladic look. The
 * blue roof drops its data dead-centre, which level-H error correction (~30%
 * budget) absorbs; only a small patch at the dome's crown keeps encoding, to spare
 * the centre alignment pattern (a function pattern EC can't repair, like the corner
 * finders). Trees sit on real sand-module clusters (so they move with the data),
 * and the church is seeded from the payload (dome height, tower, windows) so each
 * URL renders a slightly different church — within a fixed footprint, so
 * scannability is unchanged across inputs.
 */

// --- sizing (module/voxel units): biggest church that still reliably scans
//     (the data-bearing dome smears past this in the top-down perspective) ---
const INNER_R = 17; // brown "grounds" plateau around the church (flat, calm, no trees, no sea)
const PLAZA_R = 16; // round plaza covers the whole pad (so every cell is tiled = data)
const BODY_R = 10; // church body half-width
const BODY_H = 9; // church body height (modest so the dome doesn't smear in top-down)
const DRUM_R = 10; // dome drum radius (matches the dome so the windowed drum shows)
const DOME_R = 10; // dome base radius
// The dome is a solid blue roof EXCEPT a small patch at its crown that keeps
// encoding the QR. That patch preserves the centre ALIGNMENT pattern — a
// structural function pattern that error correction does NOT protect (like the
// corner finders), so it must survive for the grid to lock. Chebyshev keep-radius
// in module units around the dead centre; 3 → a 7×7 patch covering the 5×5 marker.
const DOME_KEEP_R = 3;

const SAND_H = 1.3;
const SEA_H = 0.5;
const SAND_VAR = 0.06;

// --- palette: bright sand vs a clearly-blue (but still dark enough to scan)
//     Aegean sea. Sand stays the light "ink"; sea is the dark "paper". ---
const SAND = '#ecdfbb';
const SEA = '#144f68';
// brown "grounds" around the church: light tan + dark earth (clean two-tone, no
// blue/green here so the church reads clearly). Light reads "light", dark reads
// "dark", so the QR still encodes & scans.
const GROUND_LIGHT = '#e6d5a8'; // light tan (clearly "light")
const GROUND_DARK = '#4a3526'; // dark chocolate earth (clearly "dark", like the sea's darkness)
const STONE = '#e8e2d2';
const WHITE = '#eef0ec';
const WHITE_SH = '#dde0d8';
const WHITE_DK = '#cdd1c9';
const DOME = '#2f72b4';
const DOME_TOP = '#4a93cf';
const DOME_DARK = '#255f92';
const BLUE_TRIM = '#244f7a';
const CROSS = '#d8c879';
// QR-encoding tile shades for the church top: a LIGHT shade reads as a "dark
// module" and a DARK shade reads as a "light module", so the building carries
// real scannable data from straight down. Tuned to a cohesive Cyclades palette
// (whitewash + Aegean blue + sand) so the light/dark pattern reads as intentional
// tilework, not noise — while keeping a strong light/dark luminance gap to scan.
const QR_WALL_LIGHT = '#f3efe5'; // warm whitewash
const QR_WALL_DARK = '#235f87'; // Aegean blue (blue-shuttered look)
const QR_PLAZA_LIGHT = GROUND_LIGHT; // brown grounds — light tan
const QR_PLAZA_DARK = GROUND_DARK; // brown grounds — dark earth
const TRUNK = '#7b5a39';
// tree foliage: the TOP voxel (what a top-down scanner sees) is a LIGHT green so
// the cell still reads "light" like the sand module it covers — so a full-cell
// tree keeps the QR bit instead of flipping it. Lower voxels are DARK green for
// depth in the isometric view.
const LEAF_LIGHT = ['#abc77f', '#b6d089', '#a1bd76'];
const LEAF_DARK = ['#5f7e40', '#6e8e4e', '#557237', '#4a6a33'];
const ROCK = '#9a937f';
// crisp stone for the three QR locator squares at the corners: clean limestone
// (dark modules) vs deep Aegean slate (light modules), so each corner reads as a
// deliberate flat platform — kept flat at sand height (no smear) because the
// corners carry the most top-down perspective skew and must still scan.
// corner locator squares are a tiered voxel GARDEN that still scans (painted in
// column()/light() below): the finder's two light parts become light-reading
// plants (GRASS on the outer ring, a FLOWER bed on the inner square) and the
// gap+separator become a sunken dark SLATE moat. Different heights give real 3D
// relief in BOTH views; kept moderate so the corner's top-down skew can't smear
// a raised cell onto its darker neighbour and break the finder.
const FINDER_GRASS = '#aecb80'; // light green (reads "light")
const FINDER_FLOWER = '#ec9ec9'; // rose pink — MUST stay light (luma ~186) to scan
const FLOWER_DEEP = '#d27fb2'; // richer pink, iso-only bloom depth (never scanned)
const FINDER_SLATE = '#1c3a4e'; // deep slate (reads "dark")
const FIN_GRASS_H = SAND_H + 0.35; // outer ring, slightly raised
const FIN_FLOWER_H = SAND_H + 0.9; // inner square, a raised flower bed
const FIN_MOAT_H = SAND_H - 0.55; // gap + separator, sunken moat
// bougainvillea — magenta-pink blooms that climb the whitewashed walls (placed as
// EXTRAS on vertical faces only, never a column top, so any color is safe)
const BOUGAIN = ['#c83a73', '#d8568a', '#b73168'];
// pergola posts / garden-wall trim — Aegean blue against the whitewash
const PERGOLA_POST = '#2f6090';

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
// terrain. Measured clean-decode floor is ~0.37 top-down (this theme's tighter
// whitewash/Aegean palette + data-dense church need more gap than the others); 0.55
// keeps a ~1.5× real-world margin. See ../scanContrast (globalThis.__scanC tunes live).
const SCAN_CONTRAST = 0.55;
const { pair: dimPair, scanC } = makeDimmer(SCAN_CONTRAST);

function rand2(a: number, b: number): number {
  let h = (Math.imul(a + 7, 73856093) ^ Math.imul(b + 13, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

/** MUST match QRField.moduleRand: it drives each sand module's height jitter, so a
 *  folded tree's flat green tile can land at the EXACT height of the sand cell it
 *  stands on (flush with its neighbours, not a raised bump). */
function moduleRand(a: number, b: number): number {
  let h = (Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

/** true if a module sits in one of the three 8×8 corner blocks (the 7-module QR
 *  locator plus its 1-module separator) — used to give the corners crisp stone. */
function inFinderZone(qRow: number, qCol: number, modules: number): boolean {
  const lo = 7; // rows/cols 0..7
  const hi = modules - 8; // rows/cols (n-8)..(n-1)
  const top = qRow >= 0 && qRow <= lo;
  const bottom = qRow >= hi && qRow <= modules - 1;
  const left = qCol >= 0 && qCol <= lo;
  const right = qCol >= hi && qCol <= modules - 1;
  return (top && left) || (top && right) || (bottom && left);
}

/** Chebyshev ring of a module relative to the nearest finder centre (0 = centre,
 *  1 = inner-square edge, 2 = gap, 3 = outer ring, 4 = separator) — lets the
 *  theme paint the corner garden ring by ring. */
function finderRing(qRow: number, qCol: number, modules: number): number {
  const centres: Array<[number, number]> = [
    [3, 3],
    [3, modules - 4],
    [modules - 4, 3],
  ];
  let best = 99;
  for (const [cr, cc] of centres)
    best = Math.min(best, Math.max(Math.abs(qRow - cr), Math.abs(qCol - cc)));
  return best;
}

/** rotate an integer (x,z) offset by k×90° (stays axis-aligned) so the courtyard
 *  furniture faces a different way per payload while remaining scannable */
function rot90(x: number, z: number, k: number): [number, number] {
  let a = x;
  let b = z;
  for (let i = 0; i < (k & 3); i++) {
    const t = a;
    a = -b;
    b = t;
  }
  return [a, b];
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
function buildChurch(
  ccol: number,
  crow: number,
  baseY: number,
  rng: () => number,
  matrix: QRMatrix,
): PropVoxel[] {
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
  const [tx, tz] = corners[Math.floor(rng() * 2)]; // campanile on a FRONT corner
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
  // façade detail — on the vertical faces only, so it never affects the
  // top-down QR: two tiers of tall arched windows + a grand door.
  // A window/door is a real OPENING: we hollow out the wall cell (empty recess)
  // and set a blue pane one voxel further IN, so it reads with depth instead of
  // a blue panel flush on the façade. The pane lands on an interior column whose
  // top voxel is the roof, so the top-down QR is unchanged.
  const windowAt = (x: number, z: number, base: number, h: number) => {
    const ix = x === BODY_R ? -1 : x === -BODY_R ? 1 : 0; // step toward the interior
    const iz = z === BODY_R ? -1 : z === -BODY_R ? 1 : 0;
    for (let l = base; l < base + h; l++) {
      map.delete(`${x}|${z}|${l}`); // open the hole in the wall face
      put(x + ix, z + iz, l, BLUE_TRIM); // recessed blue pane behind it
    }
  };
  for (let t = -BODY_R + 2 + wphase; t <= BODY_R - 2; t += 3) {
    const spots: Array<[number, number]> = [
      [t, BODY_R],
      [t, -BODY_R],
      [BODY_R, t],
      [-BODY_R, t],
    ];
    for (const [x, z] of spots) {
      if (!(x === 0 && z === BODY_R)) windowAt(x, z, 3, 3); // lower tier (leave the door slot)
      windowAt(x, z, 7, 2); // clerestory tier
    }
  }
  windowAt(0, BODY_R, 1, 4); // grand arched door, front centre

  // front portico / colonnade
  const pz = BODY_R + 1;
  for (let x = -BODY_R; x <= BODY_R; x++) {
    const pillar = (x + BODY_R) % 2 === 0;
    for (let l = 1; l <= 4; l++) if (pillar || l === 4) put(x, pz, l, l === 4 ? WHITE : WHITE_SH);
  }
  for (let x = -BODY_R; x <= BODY_R; x++) put(x, pz, 5, STONE);

  // windowed drum — tall arched windows around the cylinder under the dome
  disk(BODY_H + 2, DRUM_R, WHITE);
  disk(BODY_H + 3, DRUM_R, WHITE);
  const d1 = DRUM_R - 2;
  for (const [x, z] of [
    [DRUM_R, 0],
    [-DRUM_R, 0],
    [0, DRUM_R],
    [0, -DRUM_R],
    [d1, d1],
    [-d1, d1],
    [d1, -d1],
    [-d1, -d1],
  ]) {
    put(x, z, BODY_H + 2, BLUE_TRIM);
    put(x, z, BODY_H + 3, BLUE_TRIM);
  }

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

  // campanile (bell tower) — white shaft with two arched bell openings + cap
  for (let l = 1; l <= towerH; l++) {
    const bell = l === towerH - 1 || l === towerH - 3; // two stacked bell openings
    put(tx, tz, l, bell ? BLUE_TRIM : WHITE);
  }
  put(tx, tz, towerH + 1, DOME, 0.9); // little domed cap (stays solid blue, like the dome)
  extras.push(
    { col: ccol + tx, row: crow + tz, y: baseY + towerH + 2, size: 0.32, color: CROSS },
    { col: ccol + tx, row: crow + tz, y: baseY + towerH + 2.7, size: 0.32, color: CROSS },
  );

  // entrance steps (seeded count) in front of the portico
  for (let s = 1; s <= nSteps; s++) put(0, pz + s, 0, shade(STONE, -0.03 * s));

  // ENCODE THE QR on the church: recolor each cell-column's TOP voxel to a light
  // or dark shade matching the real module below it (the church is dead-center,
  // so there's almost no perspective skew — the tiles stay on their grid cells).
  const top = new Map<string, { layer: number; key: string; x: number; z: number }>();
  for (const key of map.keys()) {
    const [x, z, layer] = key.split('|').map(Number);
    const ck = `${x}|${z}`;
    const cur = top.get(ck);
    if (!cur || layer > cur.layer) top.set(ck, { layer, key, x, z });
  }
  for (const { key, x, z, layer } of top.values()) {
    const v = map.get(key)!;
    const gr = crow + z;
    const gc = ccol + x;
    const isDark = !!(matrix.cells[gr] && matrix.cells[gr][gc]); // dark module → light tile
    const isDome = v.color === DOME || v.color === DOME_TOP || v.color === DOME_DARK;
    // Leave the DOME a solid Aegean blue (its natural base→apex shading) instead of
    // encoding QR tiles on it — the classic Cycladic blue roof. Its footprint sits
    // dead-centre (clear of the three corner finders) and reads as "damage" that
    // level-H error correction (~30% budget) absorbs. EXCEPTION: a small patch at
    // the crown keeps encoding, so the centre alignment pattern (a function pattern
    // EC does NOT protect) survives and the decoder can still lock onto the grid.
    const inKeepPatch = Math.max(Math.abs(x), Math.abs(z)) <= DOME_KEEP_R;
    if (isDome && !inKeepPatch) continue;
    if (layer <= 1) {
      const p = dimPair(QR_PLAZA_LIGHT, QR_PLAZA_DARK); // plaza floor
      v.color = isDark ? p.light : p.dark;
    } else {
      const p = dimPair(QR_WALL_LIGHT, QR_WALL_DARK);
      v.color = isDark ? p.light : p.dark;
    }
  }

  // Warm streetlamps / projectors for the plaza at night
  const lampColor = '#ffcc88';
  for (const [lx, lz] of [[BODY_R + 3, BODY_R + 3], [-BODY_R - 3, BODY_R + 3], [BODY_R + 3, -BODY_R - 3], [-BODY_R - 3, -BODY_R - 3]]) {
    extras.push({
      col: ccol + lx,
      row: crow + lz,
      y: baseY + 2.5,
      size: 0.3,
      color: lampColor,
      glowing: true,
      isoOnly: true,
      light: { color: lampColor, intensity: 3.0, distance: 16 },
    });
  }
  // Internal glow for the church
  extras.push({
    col: ccol, row: crow, y: baseY + 4, size: 0.1, color: '#ffcc88', glowing: true, isoOnly: true,
    light: { color: '#ffcc88', intensity: 4.5, distance: 18 }
  });

  return [...map.values(), ...extras];
}

/**
 * A tree with one of four silhouettes chosen by `rnd` — low bush, round tree,
 * tall tree, or a tall Mediterranean cypress. Canopies are kept narrow (< ~0.85)
 * so, from straight down, the sand module underneath still shows and the tree
 * doesn't flip a QR bit.
 */
function makeTree(
  col: number,
  row: number,
  gy: number,
  rnd: number,
  heightScale = 1,
  sandTop = gy,
): PropVoxel[] {
  const lg = LEAF_LIGHT[Math.floor(rnd * 997) % LEAF_LIGHT.length]; // light crown (reads light)
  const dg = LEAF_DARK[Math.floor(rnd * 601) % LEAF_DARK.length]; // dark body (depth)
  // ~2x taller: a trunk + a tall stack of dark-green body voxels with a light
  // crown on top (only the crown matters for the top-down read). Crown kept a
  // bit narrower (W) so the taller trees don't overhang neighbours from above.
  const W = 0.98; // canopy FILLS the cell so the groves read solid (no gappy grid)
  const base = rnd < 0.2 ? 3 : rnd < 0.5 ? 5 : rnd < 0.78 ? 7 : 9; // small → round → tall → cypress
  const tiers = Math.max(2, Math.round(base * heightScale)); // scaled down for a lower outer ring
  // Every voxel is iso-only and folds down when the view flattens to scan — the
  // SAME up/down fold the finder-square gardens use — so each grove springs up in
  // the isometric scene and lies flat for scanning. The trunk + lower canopy sink
  // fully into the ground (collapseTo: 0) and shrink to nothing, so they never peek
  // out from under the tile; the light-green CROWN flattens into a flat green TILE
  // (tile) that sits FLUSH with the surrounding sand, so the folded tree keeps its
  // colour as a flat 2D green square on its cell instead of vanishing into the sand.
  const fold = { isoOnly: true, collapseTo: 0 };
  // crown tile lands a hair above THIS cell's own sand top, so it's flush with its
  // sandbar neighbours (which jitter in height) instead of a lone raised bump.
  const tileTop = sandTop + 0.02;
  const out: PropVoxel[] = [{ col, row, y: gy, size: 0.5, color: TRUNK, ...fold }];
  // top HALF of the canopy is light green so that — even when a taller tree
  // leans in the top-down perspective — whatever is visible at the top stays
  // "light" and never flips the cell; lower half is dark green for depth in iso
  const lightFrom = Math.ceil(tiers / 2);
  for (let i = 0; i < tiers; i++) {
    const isCrown = i === tiers - 1; // top voxel → the flat green scan tile
    out.push({
      col,
      row,
      y: gy + 0.7 + i * 0.9,
      size: W,
      color: i >= lightFrom ? lg : dg,
      ...(isCrown ? { isoOnly: true, tile: true, collapseTo: tileTop } : fold),
    });
  }
  return out;
}

/**
 * Recolor the TOP voxel of every column in `vox` to match the QR module beneath
 * it (dark module → light tile, light module → dark tile) — the church's trick,
 * reused so a structure standing on the data-bearing plaza stays scannable from
 * straight down. Lower (side-face) voxels keep their decorative color.
 */
function encodeTops(vox: PropVoxel[], matrix: QRMatrix, pal: { light: string; dark: string }) {
  const top = new Map<string, PropVoxel>();
  for (const v of vox) {
    const k = `${Math.round(v.col)}|${Math.round(v.row)}`;
    const cur = top.get(k);
    if (!cur || v.y > cur.y) top.set(k, v);
  }
  for (const v of top.values()) {
    const gr = Math.round(v.row);
    const gc = Math.round(v.col);
    const isDark = !!(matrix.cells[gr] && matrix.cells[gr][gc]);
    v.color = isDark ? pal.light : pal.dark;
  }
}

/** A low whitewashed garden wall: a run of `len` cells, two voxels tall. The cap
 *  voxel encodes the QR (so the wall may cross the plaza); the side is whitewash. */
function buildWall(
  ccol: number,
  crow: number,
  baseY: number,
  ox: number,
  oz: number,
  dx: number,
  dz: number,
  len: number,
  matrix: QRMatrix,
): PropVoxel[] {
  const vox: PropVoxel[] = [];
  for (let i = 0; i < len; i++) {
    const col = ccol + ox + dx * i;
    const row = crow + oz + dz * i;
    vox.push({ col, row, y: baseY + 2, size: 1, color: WHITE }); // whitewashed side
    vox.push({ col, row, y: baseY + 3, size: 1, color: WHITE_SH }); // cap (encodes)
  }
  encodeTops(vox, matrix, dimPair(QR_WALL_LIGHT, QR_WALL_DARK));
  return vox;
}

/** A shaded pergola: four blue posts on a 3×3 footprint beneath a flat slatted
 *  roof. The roof tiles encode the QR; the posts stay Aegean blue in iso view. */
function buildPergola(
  ccol: number,
  crow: number,
  baseY: number,
  ox: number,
  oz: number,
  matrix: QRMatrix,
): PropVoxel[] {
  const vox: PropVoxel[] = [];
  const postH = 3;
  for (const [px, pz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    for (let l = 0; l < postH; l++)
      vox.push({ col: ccol + ox + px, row: crow + oz + pz, y: baseY + 2 + l, size: 1, color: PERGOLA_POST });
  }
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++)
      vox.push({ col: ccol + ox + x, row: crow + oz + z, y: baseY + 2 + postH, size: 1, color: PERGOLA_POST });
  encodeTops(vox, matrix, dimPair(QR_WALL_LIGHT, QR_WALL_DARK));
  return vox;
}

/** Bougainvillea climbing the church's outer walls — pink blooms on the vertical
 *  faces only (below the roofline, so never a column top → never flips a bit). */
function addBougainvillea(ccol: number, crow: number, baseY: number, k: number): PropVoxel[] {
  const out: PropVoxel[] = [];
  const spots = [
    { x: BODY_R, z: -4, dx: 1, dz: 0 },
    { x: BODY_R, z: 3, dx: 1, dz: 0 },
    { x: -BODY_R, z: -2, dx: -1, dz: 0 },
    { x: -BODY_R, z: 4, dx: -1, dz: 0 },
  ];
  for (const s of spots) {
    const [sx, sz] = rot90(s.x, s.z, k);
    const [dx, dz] = rot90(s.dx, s.dz, k);
    for (let l = 3; l <= 6; l++)
      out.push({
        col: ccol + sx + dx * 0.32,
        row: crow + sz + dz * 0.32,
        y: baseY + l,
        size: 0.5,
        color: BOUGAIN[(l + Math.abs(s.z)) % BOUGAIN.length],
      });
  }
  return out;
}

/**
 * A small low garden ON a corner locator square: a flowering centrepiece plus
 * light-green foliage, all kept on the finder's light CENTRE cells with LIGHT
 * tops and only 1–2 voxels tall. The corners carry the most top-down skew, so
 * staying low + light-topped is what keeps the three finders scannable.
 * (fc, fr) = grid col/row of the finder's centre module.
 */
function decorateFinder(fc: number, fr: number, baseY: number): PropVoxel[] {
  const out: PropVoxel[] = [];
  const GRASS = LEAF_LIGHT[0]; // light green, reads "light" so the outer ring holds
  // Walk the 7x7 finder by Chebyshev ring from its centre cell. The outer ring
  // and the inner square are both LIGHT cells, so light-topped grass/flowers keep
  // the finder's light/dark/light pattern; the gap ring stays a dark slate moat.
  for (let dx = -3; dx <= 3; dx++)
    for (let dy = -3; dy <= 3; dy++) {
      const ring = Math.max(Math.abs(dx), Math.abs(dy));
      const col = fc + dx;
      const row = fr + dy;
      if (ring <= 1) {
        // inner square -> blooms standing ON the raised flower bed. iso-only, and
        // they FOLD DOWN to the flat square (collapseTo: baseY) as the view
        // flattens, so the corner ends up flat + scannable but the colour stays.
        out.push({ col, row, y: baseY + 0.9, size: 0.6, color: FLOWER_DEEP, isoOnly: true, collapseTo: baseY });
        out.push({ col, row, y: baseY + 1.5, size: 0.85, color: FINDER_FLOWER, isoOnly: true, collapseTo: baseY });
      } else if (ring === 3) {
        // outer ring -> grass blades that likewise fold down to the flat square
        out.push({ col, row, y: baseY + 0.35, size: 0.55, color: LEAF_DARK[1], isoOnly: true, collapseTo: baseY });
        out.push({ col, row, y: baseY + 0.85, size: 0.85, color: GRASS, isoOnly: true, collapseTo: baseY });
      }
    }
  return out;
}

export const cycladicTheme: QRTheme = {
  name: 'Cyclades',
  sampleText: 'https://reactiive.io/demos/cherry-blossom-qrcode',
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

  // dark modules: flat LIGHT-BROWN tile across the church grounds (rMod <=
  // INNER_R), raised SAND sandbars further out
  column: ({ qRow, qCol, modules, rand }) => {
    // corner garden: a raised FLOWER bed on the inner square + GRASS on the outer
    // ring. Both are light-reading, and both fold flat to SAND_H in scan view
    // (scanHeight) so the finder reads as a clean flat square from straight down.
    if (inFinderZone(qRow, qCol, modules)) {
      return finderRing(qRow, qCol, modules) <= 1
        ? { height: FIN_FLOWER_H, scanHeight: SAND_H, color: FINDER_FLOWER }
        : { height: FIN_GRASS_H, scanHeight: SAND_H, color: FINDER_GRASS };
    }
    const center = (modules - 1) / 2;
    const rMod = Math.hypot(qCol - center, qRow - center);
    if (rMod <= INNER_R) return { height: SAND_H, color: shade(dimPair(GROUND_LIGHT, GROUND_DARK).light, (rand - 0.5) * 0.05 * scanC()) };
    return { height: SAND_H - 0.15 + rand * SAND_VAR, color: shade(dimPair(SAND, SEA).light, (rand - 0.5) * 0.04 * scanC()) };
  },

  // light modules: flat DARK-BROWN tile across the church grounds (so no blue sea
  // near the church), deep blue SEA further out
  light: ({ qRow, qCol, modules, rand }) => {
    // finder gap + separator: a sunken dark slate "moat" in 3D that rises flush to
    // SAND_H when scanning, so the whole corner flattens into one clean square
    if (inFinderZone(qRow, qCol, modules))
      return { height: FIN_MOAT_H, scanHeight: SAND_H, color: FINDER_SLATE };
    const center = (modules - 1) / 2;
    const rMod = Math.hypot(qCol - center, qRow - center);
    if (rMod <= INNER_R) return { height: SAND_H, color: shade(dimPair(GROUND_LIGHT, GROUND_DARK).dark, (rand - 0.5) * 0.06 * scanC()) };
    return { height: SEA_H, color: dimPair(SAND, SEA).dark };
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

    // the seeded church — its top surfaces encode the QR (light/dark tiles)
    out.push(...buildChurch(ccol, crow, SAND_H, rng, matrix));

    // courtyard furniture around the church (seeded orientation, kept on the
    // plaza so their encoded tops keep the centre scannable): bougainvillea on
    // the church walls, two garden walls, and a pergola — each its own
    // component, auto-placed.
    const courtK = Math.floor(rng() * 4);
    out.push(...addBougainvillea(ccol, crow, SAND_H, courtK));
    {
      const [ox, oz] = rot90(-14, -3, courtK);
      const [dx, dz] = rot90(0, 1, courtK);
      out.push(...buildWall(ccol, crow, SAND_H, ox, oz, dx, dz, 7, matrix));
    }
    {
      const [ox, oz] = rot90(-3, -13, courtK);
      const [dx, dz] = rot90(1, 0, courtK);
      out.push(...buildWall(ccol, crow, SAND_H, ox, oz, dx, dz, 6, matrix));
    }
    {
      const [ox, oz] = rot90(13, 0, courtK);
      out.push(...buildPergola(ccol, crow, SAND_H, ox, oz, matrix));
    }

    // flower gardens ON the three corner locator squares — kept on each finder's
    // light centre cells with low, light-reading tops so the corners still scan
    for (const [fc, fr] of [
      [qz + 3, qz + 3],
      [qz + n - 4, qz + 3],
      [qz + 3, qz + n - 4],
    ]) {
      out.push(...decorateFinder(fc, fr, SAND_H));
    }

    // trees grouped into CLUMPS (small groves), not scattered singles: pick a
    // few anchor cells spread around the church, then grow a tight grove of
    // trees on the sand right around each anchor (open sand between clumps).
    // Grown as two concentric "rounds": a full-height inner ring hugging the
    // grounds, then a lower (½–¾ height) outer ring set further out in the sea,
    // with a sand gap between them so they read as two distinct tree lines.
    const SECTORS = 14;
    const CR = 2; // grove radius (kept tight to stay in its ring, off the timing pattern)
    const placed = new Set<number>();

    const growRound = (
      anchorMin: number, // radial band (module units) where grove anchors are seeded
      anchorMax: number,
      growMin: number, // trees never grow at/inside this radius (keeps the inter-ring gap)
      maxTrees: number,
      scaleMin: number, // tree-height scale: 1 = full, lower = shorter
      scaleRange: number,
    ) => {
      const buckets: Array<Array<{ r: number; c: number }>> = Array.from(
        { length: SECTORS },
        () => [],
      );
      for (let r = 0; r < matrix.size; r++)
        for (let c = 0; c < matrix.size; c++) {
          if (!matrix.cells[r][c]) continue; // real sand only (sandbars beyond the grounds)
          const rMod = rOf(r, c);
          if (rMod < anchorMin || rMod > anchorMax) continue;
          const sec =
            Math.floor(
              ((Math.atan2(r - qz - center, c - qz - center) + Math.PI) / (2 * Math.PI)) * SECTORS,
            ) % SECTORS;
          buckets[sec].push({ r, c });
        }

      // 1-2 clump anchors per sector
      const anchors: Array<{ r: number; c: number }> = [];
      for (let s = 0; s < SECTORS; s++) {
        const cand = buckets[s];
        if (!cand.length) continue;
        cand.sort((a, b) => rand2(a.r, a.c) - rand2(b.r, b.c));
        const n = 1 + (rng() > 0.35 ? 1 : 0);
        for (let a = 0; a < n && a < cand.length; a++)
          anchors.push(cand[Math.min(cand.length - 1, Math.floor(((a + 0.5) / n) * cand.length))]);
      }

      // grow a diamond-shaped grove on the sand around each anchor (dense centre,
      // thinning at the edges) — every tree sits on a real sand module, light crown
      let trees = 0;
      for (const anc of anchors)
        for (let dr = -CR; dr <= CR; dr++)
          for (let dc = -CR; dc <= CR; dc++) {
            const edge = Math.abs(dr) + Math.abs(dc);
            if (edge > CR) continue; // diamond clump
            const r = anc.r + dr;
            const c = anc.c + dc;
            if (r < 0 || r >= matrix.size || c < 0 || c >= matrix.size) continue;
            if (!matrix.cells[r][c]) continue; // sand only
            const rm = rOf(r, c);
            if (rm <= growMin || rm > anchorMax) continue; // stay in this round's sea band
            const key = r * 10000 + c;
            if (placed.has(key)) continue;
            const rnd = rand2(r, c);
            const thresh = edge <= 2 ? -1 : 0.3; // fill the grove densely
            if (rnd > thresh && trees < maxTrees) {
              placed.add(key);
              const scale = scaleMin + rand2(c, r) * scaleRange; // decorrelated from rnd
              // this cell's own sand height (same formula as column()), so the
              // folded tree's green tile lands flush on it rather than poking up
              const sandTop = SAND_H - 0.15 + moduleRand(r - qz, c - qz) * SAND_VAR;
              out.push(...makeTree(c, r, SAND_H - 0.15, rnd, scale, sandTop));
              trees++;
            }
          }
    };

    // inner round — full-height groves hugging the church grounds (radius 17–22)
    growRound(INNER_R + 1, INNER_R + 5, INNER_R, 150, 1, 0);
    // outer round — a lower, distant tree line further out in the sea (radius
    // 24–28), each tree ½–¾ the inner height, with a ~2-module sand gap between
    growRound(INNER_R + 8, INNER_R + 11, INNER_R + 7, 140, 0.5, 0.25);

    // a few sea rocks for detail
    let rocks = 0;
    for (let r = 0; r < matrix.size && rocks < 12; r++)
      for (let c = 0; c < matrix.size && rocks < 12; c++) {
        if (matrix.cells[r][c]) continue;
        const rMod = rOf(r, c);
        const rnd = rand2(r, c);
        if (rMod > INNER_R + 1 && rMod < INNER_R + 9 && rnd > 0.95) {
          out.push({ col: c, row: r, y: SEA_H, size: 0.4 + rnd * 0.3, color: shade(ROCK, (rnd - 0.5) * 0.1) });
          rocks++;
        }
      }
    return out;
  },
};
