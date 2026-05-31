import * as THREE from 'three';
import type { PropVoxel, QRTheme } from '../theme';
import type { QRMatrix } from '../../qr/generate';

/**
 * Khuê Văn Các — the "Pavilion of the Constellation of Literature" at the Temple
 * of Literature (Văn Miếu) in Hà Nội, Việt Nam. Built 1805, it is a symbol of the
 * city (it appears on the 100,000₫ note): four whitewashed brick pillars carry an
 * open red-lacquered upper pavilion pierced by four round "star" windows with
 * gilded sun-ray slats, crowned by a two-tiered tiled roof with upturned eaves.
 *
 * Same scannable trick as the Cyclades world, re-skinned:
 *  - dark QR modules become raised LIGHT pale-flagstone courtyard;
 *  - light modules become the dark JADE lotus pond (and laterite-brick joints
 *    near the pavilion). Seen straight down, light-stone-on-dark-water is a
 *    high-contrast (inverted) QR that scanners decode — the world stays 3D.
 *
 * The pavilion sits dead-centre. Its stone terrace and the surrounding courtyard
 * encode REAL QR data on their top faces, but the TWO-TIERED ROOF is left a solid
 * tiled cap (the classic silhouette). The roof drops its data dead-centre, which
 * level-H error correction (~30% budget) absorbs; only a small patch at the roof's
 * crown keeps encoding, to spare the centre alignment pattern (a function pattern
 * EC can't repair, like the corner finders). Trees sit on real flagstone-module
 * clusters (so they move with the data), and the pavilion is seeded from the
 * payload (pillar girth, roof pitch, window/lantern pattern) so each URL renders a
 * slightly different shrine — within a fixed footprint, so scannability is fixed.
 */

// --- sizing (module/voxel units): biggest pavilion that still reliably scans ---
const INNER_R = 18; // pale courtyard plateau around the pavilion (flat, calm, no pond, no trees)
const DAIS_R = 11; // raised stone terrace the pavilion stands on (encodes its lip)
const BR = 5; // upper pavilion (red body) half-width
const PR = 4; // the four pillars sit at (±PR, ±PR), each a 3×3 stone shaft
const DECK_R = 6; // balcony deck half-width (overhangs the pillars by one)
// The roof is a solid tiled cap EXCEPT a small patch at its crown that keeps
// encoding the QR. That patch preserves the centre ALIGNMENT pattern — a
// structural function pattern that error correction does NOT protect (like the
// corner finders), so it must survive for the grid to lock. EAVE_R is the widest
// eave (the square the roof "loses" to solid tile from straight down); the off-
// centre alignment patterns of this version sit well outside it.
const EAVE_R = 7; // widest roof eave half-width (its corners stay within the proven centre radius)
const ROOF_KEEP_R = 3; // Chebyshev keep-radius around dead centre → a 7×7 crown patch

const STONE_H = 1.3; // raised flagstone height (the light "ink")
const POND_H = 0.5; // jade pond height (the dark "paper")
const STONE_VAR = 0.06;

// --- palette: bright pale flagstone vs a clearly-dark jade pond. Stone stays the
//     light "ink"; water + laterite joints are the dark "paper". ---
const STONE = '#d8ccab'; // pale flagstone (clearly "light")
const POND = '#1f4a44'; // jade lotus-pond water (clearly "dark")
// courtyard near the pavilion: pale flagstone + dark laterite brick (the Temple's
// real wall material) — a clean two-tone, no pond/green here so the shrine reads.
const GROUND_LIGHT = '#ddd1b0'; // pale flagstone
const GROUND_DARK = '#6e4326'; // laterite brick-earth (clearly "dark")
const STONE_PALE = '#e7e0cd'; // whitewashed pillar / terrace stone
const STONE_SH = '#d6cdb6';
const STONE_DK = '#c7bda3';
const RED = '#9e342b'; // lacquer-red pavilion wood
const RED_SH = '#8d2f26';
const GOLD = '#e3b24c'; // gilded trim, window sun-rays, finial
const GOLD_DK = '#c2912f';
const TILE = '#6a4a3b'; // roof tile (warm dark terracotta)
const TILE_DK = '#553a2e';
const TILE_RIDGE = '#86392c'; // red-brown roof ridge
// QR-encoding tile shades for the terrace top: a LIGHT shade reads as a "dark
// module" and a DARK shade reads as a "light module", so the stonework carries
// real scannable data from straight down. Tuned to the courtyard palette (pale
// flagstone + laterite) so the light/dark pattern reads as deliberate paving.
const QR_FLOOR_LIGHT = '#e2d7b8'; // pale stone (reads "dark module")
const QR_FLOOR_DARK = '#5e3a22'; // laterite (reads "light module")
const TRUNK = '#6f4a2e';
// tree foliage: the TOP voxel (what a top-down scanner sees) is a LIGHT green so
// the cell still reads "light" like the flagstone module it covers — a full-cell
// tree keeps the QR bit instead of flipping it. Lower voxels are DARK green for
// depth in the isometric view.
const LEAF_LIGHT = ['#a9c47e', '#b6cf86', '#9eb972'];
const LEAF_DARK = ['#5c7b3e', '#6b8a4b', '#527036', '#496a31'];
const PAD = '#2f5d3e'; // lotus pad (dark green, reads "dark" so it never flips a pond cell)
// crisp corner locator squares become tiered STELE GARDENS that still scan (painted
// in column()/light() below): the finder's two light parts become a light pale-stone
// stele bed (inner square) + clipped topiary (outer ring); the gap+separator become a
// sunken dark water moat. Different heights give 3D relief in BOTH views; kept moderate
// so the corner's top-down skew can't smear a raised cell onto a darker neighbour.
const FIN_TOPIARY = '#bccb8c'; // light clipped topiary (reads "light")
const FIN_STELE = '#e4ddc9'; // pale stele stone — MUST stay light to scan
const STELE_DEEP = '#cfc6ab'; // shaded stone, iso-only depth (never scanned)
const FIN_MOAT = '#173a37'; // dark water moat (reads "dark")
const FIN_TOPIARY_H = STONE_H + 0.35; // outer ring, slightly raised
const FIN_STELE_H = STONE_H + 0.9; // inner square, a raised stele bed
const FIN_MOAT_H = STONE_H - 0.55; // gap + separator, sunken moat
// red-and-gold hanging lanterns under the eaves (placed on the vertical drop only,
// never a column top, so any colour is safe)
const LANTERN = ['#cf3b34', '#d8524a', '#bb2f29'];

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

/** true if a module sits in one of the three 8×8 corner blocks (the 7-module QR
 *  locator plus its 1-module separator) — used to give the corners crisp stone. */
function inFinderZone(qRow: number, qCol: number, modules: number): boolean {
  const lo = 7;
  const hi = modules - 8;
  const top = qRow >= 0 && qRow <= lo;
  const bottom = qRow >= hi && qRow <= modules - 1;
  const left = qCol >= 0 && qCol <= lo;
  const right = qCol >= hi && qCol <= modules - 1;
  return (top && left) || (top && right) || (bottom && left);
}

/** Chebyshev ring of a module relative to the nearest finder centre (0 = centre,
 *  1 = inner-square edge, 2 = gap, 3 = outer ring, 4 = separator). */
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
 * Khuê Văn Các, seeded by the payload so each URL renders a slightly different
 * pavilion (terrace tiers, body height, roof pitch, window orientation, lantern
 * count) — all within the fixed footprint, so scannability is unchanged.
 */
function buildPavilion(
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
  // a filled Chebyshev square ("plate") — the square footprint of Vietnamese
  // architecture; rim cells can take a darker edge colour for a tiled-eave look.
  const plate = (layer: number, hw: number, color: string, rim?: string) => {
    for (let x = -hw; x <= hw; x++)
      for (let z = -hw; z <= hw; z++)
        put(x, z, layer, rim && Math.max(Math.abs(x), Math.abs(z)) === hw ? rim : color);
  };

  // --- seeded variations (footprint stays inside the courtyard) ---
  const bodyH = 4 + Math.floor(rng() * 2); // red body height: 4 or 5
  const bodyBase = 7;
  const bodyTop = bodyBase + bodyH; // top of the red walls
  const wfacing = Math.floor(rng() * 4); // which wall faces "front" (window phase)
  const pitch = rng() > 0.5 ? 1 : 0; // a slightly taller upper roof on some payloads

  // raised stone terrace (two tiers) — the lip past the eaves encodes the QR
  plate(0, DAIS_R, STONE_PALE, STONE_SH);
  plate(1, DAIS_R - 1, shade(STONE_PALE, 0.02));
  // a low moon-stair leading up the front of the terrace
  for (let s = 1; s <= 3; s++) {
    const [sx, sz] = rot90(0, DAIS_R - 1 + s, wfacing);
    put(sx, sz, 0, shade(STONE_PALE, -0.03 * s));
  }

  // four whitewashed brick pillars (3×3 shafts) carrying the open lower level
  for (const [px, pz] of [
    [-PR, -PR],
    [PR, -PR],
    [-PR, PR],
    [PR, PR],
  ]) {
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (let l = 2; l <= bodyBase - 1; l++) {
          const edge = Math.abs(dx) === 1 || Math.abs(dz) === 1;
          put(px + dx, pz + dz, l, edge ? STONE_SH : STONE_PALE);
        }
  }
  // pillar plinths + capitals (a touch wider, gives the brick-pillar profile)
  for (const [px, pz] of [
    [-PR, -PR],
    [PR, -PR],
    [-PR, PR],
    [PR, PR],
  ]) {
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        put(px + dx, pz + dz, 2, STONE_DK); // plinth
        put(px + dx, pz + dz, bodyBase - 1, STONE_DK); // capital
      }
  }

  // balcony deck — a red lacquer floor slab on the pillars, with a low railing
  plate(bodyBase - 1, DECK_R, RED_SH);
  for (let t = -DECK_R; t <= DECK_R; t++)
    for (const [bx, bz] of [
      [t, DECK_R],
      [t, -DECK_R],
      [DECK_R, t],
      [-DECK_R, t],
    ]) {
      put(bx, bz, bodyBase, (t & 1) === 0 ? RED : GOLD_DK); // posts + gilt rail caps
    }

  // upper pavilion — red lacquered walls (shelled), open square box
  for (let x = -BR; x <= BR; x++)
    for (let z = -BR; z <= BR; z++) {
      const onWall = Math.abs(x) === BR || Math.abs(z) === BR;
      for (let l = bodyBase; l <= bodyTop; l++) {
        if (!onWall) continue;
        put(x, z, l, (x + z) & 1 ? RED_SH : RED);
      }
    }
  // gilded sills top + bottom of the body
  plate(bodyBase, BR, RED, GOLD_DK);

  // the four signature STAR windows: a round opening on each wall, dark-red recess
  // behind, with gilded sun-ray slats radiating from the centre (the "constellation
  // of literature"). On vertical faces only, below the eaves → never a column top.
  const cy = bodyBase + Math.round(bodyH / 2); // window centre layer
  const RECESS = '#241612'; // deep lacquer shadow inside the window
  const roundWindow = (nx: number, nz: number) => {
    const tx = nz; // tangent along the wall
    const tz = -nx;
    for (let a = -2; a <= 2; a++)
      for (let dy = -2; dy <= 2; dy++) {
        const r2 = a * a + dy * dy;
        if (r2 > 5) continue; // keep the window inside a tidy disc
        const x = nx * BR + tx * a;
        const z = nz * BR + tz * a;
        const ly = cy + dy;
        if (r2 <= 2) {
          // carve the round opening; set a dark recess one voxel in, then float a
          // gilded four-point star (centre + cardinal sun-rays) proud of it
          map.delete(`${x}|${z}|${ly}`);
          put(x - nx, z - nz, ly, RECESS);
          if (a === 0 || dy === 0)
            extras.push({
              col: ccol + x - nx * 0.4,
              row: crow + z - nz * 0.4,
              y: baseY + ly,
              size: a === 0 && dy === 0 ? 0.55 : 0.4,
              color: GOLD,
            });
        } else {
          put(x, z, ly, GOLD_DK); // gilded round frame hugging the opening
        }
      }
  };
  roundWindow(0, 1);
  roundWindow(0, -1);
  roundWindow(1, 0);
  roundWindow(-1, 0);

  // two-tiered upturned roof (chồng diêm) — a solid tiled cap over the centre.
  // lower eave (the dramatic wide sweep), a short red band, then the upper roof
  // tapering to a peak. Each tier is a stack of square tile plates.
  const r1 = bodyTop + 1; // lower-eave base layer
  plate(r1, EAVE_R, TILE, TILE_DK); // wide lower eave (the dramatic sweep)
  plate(r1 + 1, EAVE_R - 2, TILE);
  plate(r1 + 2, EAVE_R - 4, RED, GOLD_DK); // narrow red neck — the gap between the two roofs
  const r2 = r1 + 3; // upper-roof base layer
  const peak = 2 + pitch; // two or three tile courses up to the peak
  for (let i = 0; i <= peak; i++) {
    const hw = Math.max(1, EAVE_R - 1 - i * 2); // upper eave (6) tapering to the peak
    plate(r2 + i, hw, i === 0 ? TILE_RIDGE : TILE, TILE_DK);
  }
  const topL = r2 + peak;

  // upturned corner finials (đầu đao) at the four lower-eave corners — little gold
  // curls that sweep up, the signature of a Vietnamese temple roof.
  for (const [cx, cz] of [
    [EAVE_R, EAVE_R],
    [EAVE_R, -EAVE_R],
    [-EAVE_R, EAVE_R],
    [-EAVE_R, -EAVE_R],
  ]) {
    // a little curl sweeping UP at each lower-eave corner — kept on the eave cell
    // (inside the roof footprint) so it never pokes out into the data ring
    extras.push(
      { col: ccol + cx, row: crow + cz, y: baseY + r1 + 1.1, size: 0.6, color: TILE_RIDGE },
      { col: ccol + cx, row: crow + cz, y: baseY + r1 + 1.8, size: 0.42, color: GOLD },
    );
  }
  // gilded finial crowning the roof (a stacked jewel, like the real bầu rượu),
  // kept small so it can't smother the centre alignment pattern from straight down
  extras.push(
    { col: ccol, row: crow, y: baseY + topL + 0.7, size: 0.5, color: GOLD_DK },
    { col: ccol, row: crow, y: baseY + topL + 1.3, size: 0.38, color: GOLD },
    { col: ccol, row: crow, y: baseY + topL + 1.8, size: 0.26, color: GOLD },
  );

  // ENCODE THE QR on the pavilion: recolor each cell-column's TOP voxel to a light
  // or dark shade matching the real module below it. The pavilion is dead-centre,
  // so there is almost no top-down skew — the tiles stay on their grid cells.
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
    const isTile =
      v.color === TILE || v.color === TILE_DK || v.color === TILE_RIDGE || v.color === RED || v.color === RED_SH;
    // Leave the ROOF (and the red band/sills it caps) a solid tiled cap instead of
    // encoding QR tiles on it — the classic Khuê Văn Các silhouette. Its footprint
    // sits dead-centre (clear of the three corner finders) and reads as "damage"
    // that level-H error correction (~30% budget) absorbs. EXCEPTION: a small patch
    // at the crown keeps encoding, so the centre alignment pattern (a function
    // pattern EC does NOT protect) survives and the decoder can still lock the grid.
    const inKeepPatch = Math.max(Math.abs(x), Math.abs(z)) <= ROOF_KEEP_R;
    if (isTile && layer >= bodyTop + 1 && !inKeepPatch) continue;
    v.color = isDark ? QR_FLOOR_LIGHT : QR_FLOOR_DARK;
  }

  return [...map.values(), ...extras];
}

/**
 * A tree with one of four silhouettes chosen by `rnd` — low shrub, round tree,
 * tall tree, or a tall slender one. Canopies fill the cell so groves read solid,
 * with a LIGHT-green crown so the flagstone module underneath still reads light.
 */
function makeTree(col: number, row: number, gy: number, rnd: number, heightScale = 1): PropVoxel[] {
  const lg = LEAF_LIGHT[Math.floor(rnd * 997) % LEAF_LIGHT.length];
  const dg = LEAF_DARK[Math.floor(rnd * 601) % LEAF_DARK.length];
  const W = 0.98; // canopy FILLS the cell so groves read solid (no gappy grid)
  const base = rnd < 0.2 ? 3 : rnd < 0.5 ? 5 : rnd < 0.78 ? 7 : 9;
  const tiers = Math.max(2, Math.round(base * heightScale));
  // Every voxel is iso-only and folds down when the view flattens to scan — the
  // SAME up/down fold the finder gardens use — so each grove springs up in the
  // isometric scene and lies flat for scanning. The trunk + lower canopy shrink
  // away (collapseTo: gy); the light-green CROWN flattens into a flush green TILE
  // at flagstone height (tile), so the folded tree keeps its colour as a flat 2D
  // green square on its cell instead of vanishing into the stone.
  const fold = { isoOnly: true, collapseTo: gy };
  const out: PropVoxel[] = [{ col, row, y: gy, size: 0.5, color: TRUNK, ...fold }];
  const lightFrom = Math.ceil(tiers / 2);
  for (let i = 0; i < tiers; i++) {
    const isCrown = i === tiers - 1;
    out.push({
      col,
      row,
      y: gy + 0.7 + i * 0.9,
      size: W,
      color: i >= lightFrom ? lg : dg,
      ...(isCrown ? { isoOnly: true, tile: true, collapseTo: STONE_H } : fold),
    });
  }
  return out;
}

/**
 * Recolor the TOP voxel of every column in `vox` to match the QR module beneath it
 * (dark module → light tile, light module → dark tile) — the pavilion's trick,
 * reused so a structure standing on the data-bearing courtyard stays scannable
 * from straight down. Lower (side-face) voxels keep their decorative colour.
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

/** A row of doctoral stelae (bia tiến sĩ) — the Temple's famous stone tablets, each
 *  on a low base. The tablet cap encodes the QR (so the row may cross the terrace);
 *  the sides stay pale stone. */
function buildSteleRow(
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
    vox.push({ col, row, y: baseY + 2, size: 0.9, color: STONE_DK }); // turtle-plinth base
    vox.push({ col, row, y: baseY + 3, size: 1, color: STONE_PALE }); // tablet (encodes)
  }
  encodeTops(vox, matrix, { light: QR_FLOOR_LIGHT, dark: QR_FLOOR_DARK });
  return vox;
}

/** Hanging red-and-gold lanterns slung under the lower eaves — on the vertical drop
 *  only (below the roofline, so never a column top → never flips a bit). */
function addLanterns(ccol: number, crow: number, baseY: number, bodyTop: number, k: number): PropVoxel[] {
  const out: PropVoxel[] = [];
  const spots = [
    [EAVE_R - 1, EAVE_R - 1],
    [EAVE_R - 1, -(EAVE_R - 1)],
    [-(EAVE_R - 1), EAVE_R - 1],
    [-(EAVE_R - 1), -(EAVE_R - 1)],
  ];
  for (let s = 0; s < spots.length; s++) {
    const [lx, lz] = rot90(spots[s][0], spots[s][1], k);
    const y0 = baseY + bodyTop - 1;
    out.push(
      { col: ccol + lx, row: crow + lz, y: y0, size: 0.3, color: GOLD }, // cord knot
      { col: ccol + lx, row: crow + lz, y: y0 - 0.7, size: 0.55, color: LANTERN[s % LANTERN.length] },
      { col: ccol + lx, row: crow + lz, y: y0 - 1.4, size: 0.3, color: GOLD_DK }, // tassel
    );
  }
  return out;
}

/**
 * A small stele garden ON a corner locator square: a pale stone stele on the inner
 * square plus clipped topiary on the outer ring — all on the finder's light CENTRE
 * cells with LIGHT tops and only 1–2 voxels tall, folding flat for the scan. The
 * corners carry the most top-down skew, so staying low + light-topped is what keeps
 * the three finders scannable. (fc, fr) = grid col/row of the finder's centre.
 */
function decorateFinder(fc: number, fr: number, baseY: number): PropVoxel[] {
  const out: PropVoxel[] = [];
  const TOPIARY = LEAF_LIGHT[0]; // light green, reads "light" so the outer ring holds
  for (let dx = -3; dx <= 3; dx++)
    for (let dy = -3; dy <= 3; dy++) {
      const ring = Math.max(Math.abs(dx), Math.abs(dy));
      const col = fc + dx;
      const row = fr + dy;
      if (ring <= 1) {
        // inner square → a pale stone stele standing on the raised bed. iso-only,
        // folding down to the flat square (collapseTo: baseY) as the view flattens.
        out.push({ col, row, y: baseY + 0.9, size: 0.6, color: STELE_DEEP, isoOnly: true, collapseTo: baseY });
        out.push({ col, row, y: baseY + 1.5, size: 0.8, color: FIN_STELE, isoOnly: true, collapseTo: baseY });
      } else if (ring === 3) {
        // outer ring → clipped topiary that likewise folds down to the flat square
        out.push({ col, row, y: baseY + 0.35, size: 0.55, color: LEAF_DARK[1], isoOnly: true, collapseTo: baseY });
        out.push({ col, row, y: baseY + 0.85, size: 0.85, color: TOPIARY, isoOnly: true, collapseTo: baseY });
      }
    }
  return out;
}

export const khueVanCacTheme: QRTheme = {
  name: 'Khuê Văn Các',
  sampleText: 'https://en.wikipedia.org/wiki/Temple_of_Literature,_Hanoi',
  background: '#eae3d2',
  background2: '#bcae93',
  fog: '#d2c7ad',
  groundColor: '#123c39',
  lightColor: '#d8ccab',
  darkColor: '#1f4a44',
  lightSceneColor: POND,
  lightSceneHeight: POND_H,
  sunColor: '#fff2da',
  ambient: 0.6,

  // dark modules: flat pale FLAGSTONE across the courtyard (rMod <= INNER_R),
  // raised flagstone banks further out around the pond
  column: ({ qRow, qCol, modules, rand }) => {
    // corner stele garden: a raised pale STELE bed on the inner square + TOPIARY on
    // the outer ring. Both are light-reading, and both fold flat to STONE_H in scan
    // view (scanHeight) so the finder reads as a clean flat square from straight down.
    if (inFinderZone(qRow, qCol, modules)) {
      return finderRing(qRow, qCol, modules) <= 1
        ? { height: FIN_STELE_H, scanHeight: STONE_H, color: FIN_STELE }
        : { height: FIN_TOPIARY_H, scanHeight: STONE_H, color: FIN_TOPIARY };
    }
    const center = (modules - 1) / 2;
    const rMod = Math.hypot(qCol - center, qRow - center);
    if (rMod <= INNER_R) return { height: STONE_H, color: shade(GROUND_LIGHT, (rand - 0.5) * 0.05) };
    return { height: STONE_H - 0.15 + rand * STONE_VAR, color: shade(STONE, (rand - 0.5) * 0.04) };
  },

  // light modules: flat dark LATERITE across the courtyard (so no pond near the
  // pavilion), deep jade POND further out
  light: ({ qRow, qCol, modules, rand }) => {
    // finder gap + separator: a sunken dark water "moat" in 3D that rises flush to
    // STONE_H when scanning, so the whole corner flattens into one clean square
    if (inFinderZone(qRow, qCol, modules))
      return { height: FIN_MOAT_H, scanHeight: STONE_H, color: FIN_MOAT };
    const center = (modules - 1) / 2;
    const rMod = Math.hypot(qCol - center, qRow - center);
    if (rMod <= INNER_R) return { height: STONE_H, color: shade(GROUND_DARK, (rand - 0.5) * 0.06) };
    return { height: POND_H, color: POND };
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

    // the seeded pavilion — its top surfaces encode the QR (light/dark tiles)
    out.push(...buildPavilion(ccol, crow, STONE_H, rng, matrix));

    // courtyard furniture around the pavilion (seeded orientation, kept on the
    // terrace/courtyard so their encoded tops keep the centre scannable): two rows
    // of doctoral stelae and lanterns slung under the eaves.
    const courtK = Math.floor(rng() * 4);
    out.push(...addLanterns(ccol, crow, STONE_H, 12, courtK));
    {
      const [ox, oz] = rot90(-(DAIS_R + 2), -3, courtK);
      const [dx, dz] = rot90(0, 1, courtK);
      out.push(...buildSteleRow(ccol, crow, STONE_H, ox, oz, dx, dz, 7, matrix));
    }
    {
      const [ox, oz] = rot90(DAIS_R + 2, -3, courtK);
      const [dx, dz] = rot90(0, 1, courtK);
      out.push(...buildSteleRow(ccol, crow, STONE_H, ox, oz, dx, dz, 7, matrix));
    }

    // stele gardens ON the three corner locator squares — kept on each finder's
    // light centre cells with low, light-reading tops so the corners still scan
    for (const [fc, fr] of [
      [qz + 3, qz + 3],
      [qz + n - 4, qz + 3],
      [qz + 3, qz + n - 4],
    ]) {
      out.push(...decorateFinder(fc, fr, STONE_H));
    }

    // ancient courtyard trees grouped into CLUMPS (small groves) on the flagstone
    // banks around the pond — two concentric rounds: full-height inner groves
    // hugging the courtyard, then a lower distant tree-line further out, with a
    // gap between so they read as two tree lines (same recipe as the island world).
    const SECTORS = 14;
    const CR = 2;
    const placed = new Set<number>();

    const growRound = (
      anchorMin: number,
      anchorMax: number,
      growMin: number,
      maxTrees: number,
      scaleMin: number,
      scaleRange: number,
    ) => {
      const buckets: Array<Array<{ r: number; c: number }>> = Array.from(
        { length: SECTORS },
        () => [],
      );
      for (let r = 0; r < matrix.size; r++)
        for (let c = 0; c < matrix.size; c++) {
          if (!matrix.cells[r][c]) continue; // real flagstone banks only
          const rMod = rOf(r, c);
          if (rMod < anchorMin || rMod > anchorMax) continue;
          const sec =
            Math.floor(
              ((Math.atan2(r - qz - center, c - qz - center) + Math.PI) / (2 * Math.PI)) * SECTORS,
            ) % SECTORS;
          buckets[sec].push({ r, c });
        }

      const anchors: Array<{ r: number; c: number }> = [];
      for (let s = 0; s < SECTORS; s++) {
        const cand = buckets[s];
        if (!cand.length) continue;
        cand.sort((a, b) => rand2(a.r, a.c) - rand2(b.r, b.c));
        const cnt = 1 + (rng() > 0.35 ? 1 : 0);
        for (let a = 0; a < cnt && a < cand.length; a++)
          anchors.push(cand[Math.min(cand.length - 1, Math.floor(((a + 0.5) / cnt) * cand.length))]);
      }

      let trees = 0;
      for (const anc of anchors)
        for (let dr = -CR; dr <= CR; dr++)
          for (let dc = -CR; dc <= CR; dc++) {
            const edge = Math.abs(dr) + Math.abs(dc);
            if (edge > CR) continue;
            const r = anc.r + dr;
            const c = anc.c + dc;
            if (r < 0 || r >= matrix.size || c < 0 || c >= matrix.size) continue;
            if (!matrix.cells[r][c]) continue; // flagstone banks only
            const rm = rOf(r, c);
            if (rm <= growMin || rm > anchorMax) continue;
            const key = r * 10000 + c;
            if (placed.has(key)) continue;
            const rnd = rand2(r, c);
            const thresh = edge <= 2 ? -1 : 0.3;
            if (rnd > thresh && trees < maxTrees) {
              placed.add(key);
              const scale = scaleMin + rand2(c, r) * scaleRange;
              out.push(...makeTree(c, r, STONE_H - 0.15, rnd, scale));
              trees++;
            }
          }
    };

    // inner round — full-height groves hugging the courtyard (radius 19–23)
    growRound(INNER_R + 1, INNER_R + 5, INNER_R, 150, 1, 0);
    // outer round — a lower, distant tree line further out across the pond
    growRound(INNER_R + 8, INNER_R + 11, INNER_R + 7, 140, 0.5, 0.25);

    // a scatter of lotus pads on the pond for detail (dark-green so they never flip
    // a pond cell), with the odd pale stepping stone
    let pads = 0;
    for (let r = 0; r < matrix.size && pads < 16; r++)
      for (let c = 0; c < matrix.size && pads < 16; c++) {
        if (matrix.cells[r][c]) continue; // pond cells only
        const rMod = rOf(r, c);
        const rnd = rand2(r, c);
        if (rMod > INNER_R + 1 && rMod < INNER_R + 9 && rnd > 0.93) {
          out.push({ col: c, row: r, y: POND_H, size: 0.6 + rnd * 0.3, color: shade(PAD, (rnd - 0.5) * 0.12) });
          pads++;
        }
      }
    return out;
  },
};
