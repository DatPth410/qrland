import * as THREE from 'three';
import type { PropVoxel, QRTheme } from '../theme';
import type { QRMatrix } from '../../qr/generate';
import { makeDimmer } from '../scanContrast';

// --- Traditional Vietnamese Architecture Palette ---
const STONE_PALE = '#e8e5dc'; // Whitewashed brick (pillars)
const STONE_SH = '#c2bea8';
const STONE_DK = '#96917e';
const WOOD_RED = '#8b231c'; // Deep lacquer red
const WOOD_RED_SH = '#661a15';
const ROOF_TILE = '#9e4635'; // Terracotta
const ROOF_EDGE = '#6e2b1f';
const DRAGON_STONE = '#b3afa1';
const GOLD = '#d4af37';
const GOLD_DK = '#a88622';

const BRICK_WALL = '#a64a35';
const BRICK_SH = '#823725';

// Each zone is a DARK/LIGHT material pair (dark module → light material, light
// module → dark material). The pairs below keep a strong luma gap (~3:1) so every
// zone decodes from straight down — the same discipline Tháp Rùa / Cyclades use.
const PARK_L = '#a8c96a'; // sunlit grass — light module material (brightened to scan)
const PARK_D = '#324818'; // shaded earth — dark module material (deepened to scan)
const ROAD_L = '#d99268'; // sunlit terracotta brick paving (light)
const ROAD_D = '#52201a'; // deep brick joints (dark)
const LAKE_W = '#678263'; // murky jade — 3D water surface only (props), not a scan cell
const POND_DARK = '#2f4a3a'; // jade water reading as a DARK module (scan contrast vs lily)
const LAKE_LILY = '#a8c7a3'; // pale jade reflections/lilypads — reads as a LIGHT module
const FIN_REED = '#cdd9a0'; // light reed ring for the finder's outer border (reads light)
const LEAF_L = '#73993d';
const LEAF_D = '#355214';
const LEAF_CROWN = '#b0d17d'; // sunlit crown — reads "light" and stays visible as a flat
// grove TILE when the trees fold for scanning (so groves don't vanish into the park)
const TRUNK = '#5e402b';

const QR_LIGHT = '#e8e6dc';
const QR_DARK = '#55544d';

const GLOW_WARM = '#ffc66e'; // warm lantern/window glow (unlit material)

const DAIS_R = 14;
const PR = 6;
const EAVE_R = 8; // roof half-width — kept tight so the decorative (unencoded) roof
// patch stays ~6% of the grid (well inside the level-H error-correction budget)
const SCAN_H = 1.0; // single flat height every cell eases to in the top-down scan view
// The pavilion STANDS and encodes its own top faces (like the Tháp Rùa tower /
// Cyclades church). Its tall two-tiered roof is the one part that smears in the
// top-down perspective, so it keeps its terracotta tiles (≈10% of the grid, which
// level-H error correction absorbs) — EXCEPT this central keep-patch at the apex,
// which still encodes so the centre alignment pattern survives and the grid locks.
const PAVILION_KEEP_R = 3;

function inFinderZone(qRow: number, qCol: number, modules: number): boolean {
  const lo = 7;
  const hi = modules - 8;
  const top = qRow >= 0 && qRow <= lo;
  const bottom = qRow >= hi && qRow <= modules - 1;
  const left = qCol >= 0 && qCol <= lo;
  const right = qCol >= hi && qCol <= modules - 1;
  return (top && left) || (top && right) || (bottom && left);
}

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
// terrain. Floor for a clean decode is ~0.30; 0.45 keeps a ~1.5× real-world margin.
// See ../scanContrast for the mechanism (and globalThis.__scanC for live tuning).
const SCAN_CONTRAST = 0.45;
const { pair: dimPair, scanC } = makeDimmer(SCAN_CONTRAST);

/** Fold a structure flat for scanning into a VISIBLE encoded tile (the wall and
 *  the lake railing): each column's TOP voxel becomes a QR tile recoloured to the
 *  module beneath it, sitting just above the SCAN_H cell plane so the structure
 *  keeps its footprint + data when read from straight down. Lower voxels sink away. */
function applyFlattening(voxels: PropVoxel[], matrix: QRMatrix, baseY: number) {
  const top = new Map<string, PropVoxel>();
  for (const v of voxels) {
    const k = `${Math.round(v.col)}|${Math.round(v.row)}`;
    const cur = top.get(k);
    if (!cur || v.y > cur.y) top.set(k, v);
  }
  for (const v of voxels) {
    const k = `${Math.round(v.col)}|${Math.round(v.row)}`;
    if (top.get(k) !== v) {
      v.isoOnly = true;
      v.collapseTo = 0;
    }
  }
  for (const v of top.values()) {
    const isDark = !!(matrix.cells[Math.round(v.row)] && matrix.cells[Math.round(v.row)][Math.round(v.col)]);
    const tile = dimPair(QR_LIGHT, QR_DARK);
    v.color = isDark ? tile.light : tile.dark;
    v.isoOnly = true;
    v.tile = true;
    v.size = 1.0;
    v.collapseTo = baseY + 0.15; // just above the SCAN_H cell plane → visible, no z-fight
  }
}



/**
 * Procedurally generates the Traditional Gemini Pavilion
 */
function buildPavilion(
  ccol: number,
  crow: number,
  baseY: number,
  matrix: QRMatrix,
): PropVoxel[] {
  const map = new Map<string, PropVoxel>();
  const extras: PropVoxel[] = [];
  const put = (x: number, z: number, layer: number, color: string, size = 1) => {
    map.set(`${x}|${z}|${layer}`, { col: ccol + x, row: crow + z, y: baseY + layer, size, color });
  };

  const plate = (layer: number, hw: number, color: string, rim?: string) => {
    for (let x = -hw; x <= hw; x++)
      for (let z = -hw; z <= hw; z++)
        put(x, z, layer, rim && Math.max(Math.abs(x), Math.abs(z)) === hw ? rim : color);
  };

  // Raised stone terrace (paved with red brick)
  plate(0, DAIS_R, ROAD_L, ROAD_D);
  plate(1, DAIS_R - 1, ROAD_L, ROAD_D);

  const bodyBase = 12;
  const bodyTop = 22; // taller chamber → room for a larger round window

  // Four massive whitewashed stone pillars. Only the four TRUE corners are shaded
  // (STONE_SH); every broad face is bright limewash (STONE_PALE) so the shafts read
  // clean white instead of the flat muddy grey they had before — and the dark
  // grey plinth/capital are gone (the column rises straight into the red deck).
  for (const [px, pz] of [[-PR, -PR], [PR, -PR], [-PR, PR], [PR, PR]]) {
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const corner = Math.abs(dx) === 1 && Math.abs(dz) === 1;
        for (let l = 2; l <= bodyBase - 1; l++) {
          put(px + dx, pz + dz, l, corner ? STONE_SH : STONE_PALE);
        }
        put(px + dx, pz + dz, 2, STONE_SH); // a subtle stone base course
      }
  }

  // Wooden Balcony Deck
  const BR = 7; // wall radius
  const DECK_R = 8;
  plate(bodyBase - 1, DECK_R, WOOD_RED_SH);
  // Balustrade
  for (let t = -DECK_R; t <= DECK_R; t++) {
    for (const [bx, bz] of [[t, DECK_R], [t, -DECK_R], [DECK_R, t], [-DECK_R, t]]) {
      if ((t & 1) === 0 || Math.abs(t) === DECK_R) put(bx, bz, bodyBase, WOOD_RED); // balusters
      put(bx, bz, bodyBase + 1, WOOD_RED_SH); // rail
    }
  }

  // Red Lacquer Walls
  for (let x = -BR; x <= BR; x++) {
    for (let z = -BR; z <= BR; z++) {
      const onWall = Math.abs(x) === BR || Math.abs(z) === BR;
      for (let l = bodyBase; l <= bodyTop; l++) {
        if (onWall) put(x, z, l, (x + z) & 1 ? WOOD_RED_SH : WOOD_RED);
      }
    }
  }
  plate(bodyBase, BR, WOOD_RED, GOLD_DK);

  // Iconic Circular Window (Khuê Văn Các "Constellation of Literature" star).
  // The coarse integer module grid (only ±4 cells across) cannot express a real
  // circle — its rim collapses to a few disconnected dots and the rays read as a
  // chunky plus-sign, which is what made the old window look lopsided. Instead we
  // build it from FINE sub-voxel props (fractional positions + sizes are fully
  // supported), so the rim is a perfectly round, evenly-spaced sunburst.
  //
  // Each window sits at radius BR on a wall face, fully under the EAVE_R roof
  // overhang, so the whole lattice is occluded straight-down and never touches the
  // scan (these are decorative extras, excluded from the top-face encoding pass).
  const cy = bodyBase + 5; // window centre height (within the 12..22 wall band)
  const WIN = {
    rHole: 4.0, // blocky wall opening punched behind the lattice
    rGold: 3.9, // inner gold trim ring
    rRim: 4.3, // main lacquer rim ring
    rEdge: 4.62, // outer dark edge ring
    rayIn: 2.0, // rays form a band near the rim, leaving a big OPEN centre…
    rayOut: 3.7, // …and stop where they meet the gold trim
    rays: 16, // evenly spaced radial bars (every 22.5°)
    out: 0.22, // lattice stands proud of the wall face (toward the viewer)
  };

  const roundWindow = (nx: number, nz: number) => {
    const tx = nz; // in-plane horizontal axis (tangent to the wall)
    const tz = -nx;
    const ccx = ccol + nx * BR; // window centre, absolute grid coords
    const ccz = crow + nz * BR;
    const ccyW = baseY + cy;
    // place a voxel at in-plane offset (u = horizontal, v = vertical), pushed `o`
    // out along the wall normal (+ = outward, toward the viewer)
    const at = (u: number, v: number, o: number, size: number, color: string, glow = false) => {
      const vox: PropVoxel = {
        col: ccx + tx * u + nx * o,
        row: ccz + tz * u + nz * o,
        y: ccyW + v,
        size,
        color,
      };
      if (glow) vox.glowing = true;
      extras.push(vox);
    };

    // 1) punch a clean round opening in the solid wall behind the lattice
    for (let t = -7; t <= 7; t++)
      for (let l = bodyBase; l <= bodyTop; l++)
        if (Math.hypot(t, l - cy) <= WIN.rHole)
          map.delete(`${nx * BR + tx * t}|${nz * BR + tz * t}|${l}`);

    // 2) the centre is left OPEN — you look straight through the lattice into the
    //    empty chamber. There is no lit pane by day; at night the chamber's interior
    //    point light spills a soft warm glow through the opening (a gentle "bubble").

    // 3) the round rim — three concentric bands of fine voxels (true circles)
    const ring = (radius: number, count: number, size: number, color: string, o: number) => {
      for (let i = 0; i < count; i++) {
        const th = (i / count) * Math.PI * 2;
        at(Math.cos(th) * radius, Math.sin(th) * radius, o, size, color);
      }
    };
    ring(WIN.rEdge, 84, 0.4, ROOF_EDGE, WIN.out - 0.04); // dark outer edge
    ring(WIN.rRim, 76, 0.56, WOOD_RED, WIN.out); // lacquer rim
    ring(WIN.rGold, 76, 0.34, GOLD, WIN.out + 0.04); // gold inner trim
    ring(WIN.rayIn, 60, 0.3, GOLD_DK, WIN.out + 0.02); // inner ring framing the open eye

    // 4) radial rays as a band near the rim — they stop at the inner ring, so the
    //    centre stays a big clean open circle (no central hub)
    for (let i = 0; i < WIN.rays; i++) {
      const th = (i / WIN.rays) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      for (let r = WIN.rayIn; r <= WIN.rayOut + 1e-6; r += 0.3)
        at(c * r, s * r, WIN.out, 0.36, WOOD_RED_SH);
    }
  };
  roundWindow(0, 1);
  roundWindow(0, -1);
  roundWindow(1, 0);
  roundWindow(-1, 0);

  // Two-tiered Terracotta Roof
  const r1 = bodyTop + 1;
  plate(r1, EAVE_R, ROOF_TILE, ROOF_EDGE);
  plate(r1 + 1, EAVE_R - 1, ROOF_TILE, ROOF_EDGE);
  plate(r1 + 2, EAVE_R - 3, WOOD_RED, GOLD_DK); // Neck (chồng diêm)
  
  const r2 = r1 + 3;
  plate(r2, EAVE_R - 4, ROOF_TILE, ROOF_EDGE);
  plate(r2 + 1, EAVE_R - 5, ROOF_TILE, ROOF_EDGE);
  plate(r2 + 2, EAVE_R - 6, ROOF_TILE, ROOF_EDGE);
  plate(r2 + 3, EAVE_R - 7, ROOF_TILE, ROOF_EDGE);

  // Upturned Dragon Corners (Đầu đao)
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const lx = sx * EAVE_R;
    const lz = sz * EAVE_R;
    extras.push(
      { col: ccol + lx, row: crow + lz, y: baseY + r1 + 0.8, size: 0.9, color: DRAGON_STONE },
      { col: ccol + lx + sx * 0.5, row: crow + lz + sz * 0.5, y: baseY + r1 + 1.4, size: 0.6, color: DRAGON_STONE },
      { col: ccol + lx + sx * 1.5, row: crow + lz + sz * 1.5, y: baseY + r1 + 3.0, size: 0.4, color: GOLD_DK }
    );
    const ux = sx * (EAVE_R - 4);
    const uz = sz * (EAVE_R - 4);
    extras.push(
      { col: ccol + ux, row: crow + uz, y: baseY + r2 + 0.8, size: 0.7, color: DRAGON_STONE },
      { col: ccol + ux + sx * 0.8, row: crow + uz + sz * 0.8, y: baseY + r2 + 1.5, size: 0.4, color: GOLD_DK }
    );
  }

  extras.push(
    { col: ccol, row: crow, y: baseY + r2 + 4, size: 0.8, color: GOLD_DK },
    { col: ccol, row: crow, y: baseY + r2 + 5, size: 0.5, color: GOLD }
  );

  // Encode the QR onto the pavilion's flat tops — the same trick the Cyclades
  // church and Tháp Rùa tower use, so the building stays fully 3D yet carries the
  // code when read from straight down. Each column's TOP voxel is recoloured to a
  // light/dark tile matching the module beneath it: the raised brick TERRACE keeps
  // its red-brick palette (ROAD pair) while encoding, and the tall ROOF keeps its
  // terracotta tiles (left as ECC-absorbed "damage") except the central keep-patch.
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
    const isDark = !!(matrix.cells[gr] && matrix.cells[gr][gc]);
    const isRoof = layer >= r1;
    const inKeep = Math.max(Math.abs(x), Math.abs(z)) <= PAVILION_KEEP_R;
    if (isRoof && !inKeep) continue; // tall roof stays terracotta — ECC absorbs it
    const roofTile = dimPair(QR_LIGHT, QR_DARK);
    const terraceTile = dimPair(ROAD_L, ROAD_D);
    v.color = isRoof
      ? (isDark ? roofTile.light : roofTile.dark) // apex keep-patch: tiles → centre alignment locks
      : (isDark ? terraceTile.light : terraceTile.dark); // terrace ring: brick tiles that still encode
  }

  // Lanterns hanging on the balcony corners (glow at night; isoOnly so they fold
  // away with the scan transition and never float over the modules).
  const L_R = DECK_R;
  const lanternColor = '#ff5522'; // Warm reddish orange
  for (const [lx, lz] of [[L_R, L_R], [-L_R, L_R], [L_R, -L_R], [-L_R, -L_R]]) {
    extras.push({
      col: ccol + lx,
      row: crow + lz,
      y: baseY + bodyBase + 2,
      size: 0.3,
      color: lanternColor,
      glowing: true,
      isoOnly: true,
      light: { color: lanternColor, intensity: 3.5, distance: 15 },
    });
  }

  // Heart of the chamber — a SOFT point light only. It is night-gated (renders
  // just at night, in scene view), so by day the open round windows read as empty
  // see-through holes, and at night a gentle warm glow spills through them like a
  // bubble — never a hard bright pane. The emitter itself is a tiny invisible voxel
  // (no glowing cube to show through the window by day); it folds away for scanning.
  extras.push({
    col: ccol,
    row: crow,
    y: baseY + cy - 1.5,
    size: 0.2,
    color: GLOW_WARM,
    isoOnly: true,
    collapseTo: 0,
    light: { color: '#ffb050', intensity: 6, distance: 22 },
  });

  // Four stone lanterns (đèn đá) on the terrace corners ring the pavilion with
  // warm pools of light. Stone parts + flame are all isoOnly → they sink away in
  // scan view, leaving the encoded terrace tiles beneath them untouched.
  const SL = DAIS_R - 2;
  for (const [sx, sz] of [[SL, SL], [-SL, SL], [SL, -SL], [-SL, -SL]]) {
    const lcol = ccol + sx;
    const lrow = crow + sz;
    const gy = baseY + 2; // top of the upper terrace plate
    extras.push(
      { col: lcol, row: lrow, y: gy, size: 0.5, color: STONE_DK, isoOnly: true, collapseTo: 0 },
      { col: lcol, row: lrow, y: gy + 0.5, size: 0.32, color: STONE_SH, isoOnly: true, collapseTo: 0 },
      {
        col: lcol,
        row: lrow,
        y: gy + 0.82,
        size: 0.55,
        color: GLOW_WARM,
        glowing: true,
        isoOnly: true,
        collapseTo: 0,
        light: { color: '#ffbb55', intensity: 2.5, distance: 10 },
      },
      { col: lcol, row: lrow, y: gy + 1.37, size: 0.7, color: STONE_DK, isoOnly: true, collapseTo: 0 },
    );
  }

  // The pavilion and its ornaments STAND in both views (only decorative greenery
  // folds for scanning) — so the building is never flattened, exactly like the
  // tower and the church.
  return [...map.values(), ...extras];
}

function buildWall(ccol: number, crow: number, baseY: number, n: number, matrix: QRMatrix): PropVoxel[] {
  const vox: PropVoxel[] = [];
  const extras: PropVoxel[] = [];
  const qz = matrix.quietZone;
  const h = 5;
  const center = (n - 1) / 2;
  const gateCenter = Math.floor((DAIS_R + center) / 2);

  const addSegment = (dir: 1 | -1) => {
    let dx = DAIS_R - 1;
    while (true) {
      const col = ccol + dx * dir;
      const qCol = col - qz;
      if (qCol < 0 || qCol >= n) break;
      
      for (let w = -1; w <= 1; w++) {
        const qRow = crow + w - qz;
        if (qRow < 0 || qRow >= n) continue;

        // Make circular cutouts in the wall
        const distFromPavilion = Math.abs(dx) - DAIS_R;
        const inCutout = distFromPavilion % 12 >= 3 && distFromPavilion % 12 <= 7 && w === 0;

        // Side gates (Bi Văn Môn & Súc Văn Môn)
        const isGate = Math.abs(dx) >= gateCenter - 3 && Math.abs(dx) <= gateCenter + 3;

        for (let y = 1; y <= h; y++) {
          if (isGate) {
            // Opening for the gate
            if (y <= 4 && Math.abs(Math.abs(dx) - gateCenter) <= 2) continue;
            
            // Stone pillars for the gate frame
            if (y <= 4 && Math.abs(Math.abs(dx) - gateCenter) === 3) {
              vox.push({ col, row: crow + w, y: baseY + y, size: 1, color: STONE_PALE });
              continue;
            }
          }
          
          if (inCutout && y >= 2 && y <= 4) continue; // window hole in the regular wall
          vox.push({ col, row: crow + w, y: baseY + y, size: 1, color: (dx + y) % 2 === 0 ? BRICK_WALL : BRICK_SH });
        }
        
        // Roof over the wall
        if (isGate) {
           vox.push({ col, row: crow + w, y: baseY + h + 1, size: 1, color: ROOF_TILE });
           vox.push({ col, row: crow + w, y: baseY + h + 2, size: 1, color: ROOF_TILE }); // taller roof for the gate
        } else {
           vox.push({ col, row: crow + w, y: baseY + h + 1, size: 1, color: ROOF_TILE });
        }
      }
      dx++;
    }
  };

  addSegment(-1);
  addSegment(1);

  // fold the wall flat instead of sinking it away: each column's top voxel
  // becomes a visible QR tile matching the module beneath, so the wall keeps
  // its footprint AND the encoded values when read from straight down.
  applyFlattening(vox, matrix, baseY);

  // A warm lantern hangs in each side-gate archway (Bi Văn Môn / Súc Văn Môn).
  // Added AFTER flattening: glowing+isoOnly props fold away on their own in scan
  // view, and they must not take part in the wall's top-tile pass.
  for (const dir of [-1, 1] as const) {
    extras.push({
      col: ccol + gateCenter * dir,
      row: crow,
      y: baseY + 4.0,
      size: 0.45,
      color: GLOW_WARM,
      glowing: true,
      isoOnly: true,
      light: { color: '#ffae58', intensity: 3, distance: 12 },
    });
  }
  return [...vox, ...extras];
}

function buildLake(ccol: number, crow: number, baseY: number, n: number, matrix: QRMatrix): PropVoxel[] {
  const vox: PropVoxel[] = [];
  const qz = matrix.quietZone;
  const center = (n - 1) / 2;
  
  const sqOuterZ = center - 2;
  const sqInnerZ = sqOuterZ - 4;
  const gateCenter = Math.floor((DAIS_R + center) / 2);
  const sqInnerX = gateCenter - 3;
  
  const zStart = DAIS_R + 1;
  const zEnd = sqInnerZ - 2;
  const xRad = sqInnerX - 2;

  for (let z = zStart; z <= zEnd; z++) {
    for (let x = -xRad; x <= xRad; x++) {
      const qCol = ccol + x - qz;
      const qRow = crow + z - qz;
      if (qCol < 0 || qCol >= n || qRow < 0 || qRow >= n) continue;

      const isBorder = z === zStart || z === zEnd || x === -xRad || x === xRad;
      if (isBorder) {
        for (let y = 0; y < 2; y++) {
          const color = ((x + z + y) % 2 === 0) ? '#5c8a6b' : STONE_DK;
          const gy = baseY + 0.5 + y * 1.0;
          vox.push({ col: ccol + x, row: crow + z, y: gy, size: 1, color });
        }
      }
    }
  }

  applyFlattening(vox, matrix, baseY);
  return vox;
}

function decorateFinder(fc: number, fr: number, baseY: number): PropVoxel[] {
  const out: PropVoxel[] = [];
  for (let dx = -3; dx <= 3; dx++)
    for (let dy = -3; dy <= 3; dy++) {
      const ring = Math.max(Math.abs(dx), Math.abs(dy));
      const col = fc + dx;
      const row = fr + dy;
      // these plants sit ON the finder in 3D, then sink fully away for scanning so
      // the clean finder CELLS (light centre + ring, dark moat) read undisturbed.
      if (ring <= 1) {
        out.push({ col, row, y: baseY + 0.9, size: 0.6, color: STONE_SH, isoOnly: true, collapseTo: 0 });
        out.push({ col, row, y: baseY + 1.5, size: 0.8, color: STONE_PALE, isoOnly: true, collapseTo: 0 });
      } else if (ring === 3) {
        out.push({ col, row, y: baseY + 0.35, size: 0.55, color: LEAF_D, isoOnly: true, collapseTo: 0 });
        out.push({ col, row, y: baseY + 0.85, size: 0.85, color: LEAF_L, isoOnly: true, collapseTo: 0 });
      }
    }
  return out;
}

function makeTree(col: number, row: number, gy: number, rnd: number): PropVoxel[] {
  const W = 0.98;
  const tiers = rnd < 0.2 ? 3 : rnd < 0.7 ? 4 : 5;
  // In 3D the tree stands; for scanning it folds like Tháp Rùa's groves — the light
  // CROWN flattens into a flush green TILE that stays VISIBLE from top-down (and
  // reads "light", matching the dark module it sits on), while the trunk and lower
  // canopy sink away. The tile lands a hair above the cell plane to avoid z-fighting.
  const out: PropVoxel[] = [{ col, row, y: gy, size: 0.5, color: TRUNK, isoOnly: true, collapseTo: 0 }];

  for (let i = 0; i < tiers; i++) {
    const isCrown = i === tiers - 1;
    out.push({
      col,
      row,
      y: gy + 0.7 + i * 0.9,
      size: W,
      color: isCrown ? LEAF_CROWN : i >= tiers - 2 ? LEAF_L : LEAF_D,
      ...(isCrown
        ? { isoOnly: true, tile: true, collapseTo: SCAN_H }
        : { isoOnly: true, collapseTo: 0 }),
    });
  }
  return out;
}

type Zone = 'road' | 'park' | 'pond' | 'wall';
function zoneOf(qCol: number, qRow: number, modules: number): Zone {
  const center = (modules - 1) / 2;
  const dz = qRow - center;
  const dx = qCol - center;

  if (Math.abs(dz) <= 2 && Math.abs(dx) > DAIS_R - 2) return 'wall';
  
  const gateCenter = Math.floor((DAIS_R + center) / 2);
  const sqOuterZ = center - 2;
  const sqInnerZ = sqOuterZ - 4;
  const sqInnerX = gateCenter - 3;
  const sqOuterX = gateCenter + 2;
  
  // The square lake (Thiền Quang well) sits in front of the terrace
  if (dz >= DAIS_R + 1 && dz <= sqInnerZ - 2 && Math.abs(dx) <= sqInnerX - 2) return 'pond';

  const isSquarePath = 
    (Math.abs(dz) >= sqInnerZ && Math.abs(dz) <= sqOuterZ && Math.abs(dx) <= sqOuterX) ||
    (Math.abs(dx) >= sqInnerX && Math.abs(dx) <= sqOuterX && Math.abs(dz) <= sqOuterZ);
    
  if (isSquarePath) return 'road';

  // Front central road
  if (Math.abs(dx) <= 5 && dz >= -sqInnerZ && dz <= 0) return 'road';

  // Paved area right in front of the wall
  if (dz >= -3 && dz <= 0 && Math.abs(dx) <= sqOuterX) return 'road';

  return 'park';
}

export const khueVanCacTheme: QRTheme = {
  name: 'Khue Van Cac Gemini',
  sampleText: 'https://en.wikipedia.org/wiki/Temple_of_Literature,_Hanoi',
  background: '#d4e6e8',
  background2: '#a8c6c9',
  fog: '#c0d6d8',
  groundColor: '#364a39',
  lightColor: '#e8e5dc',
  darkColor: '#425921',
  lightSceneColor: LAKE_W,
  lightSceneHeight: 0.8,
  sunColor: '#fff8eb',
  ambient: 0.65,

  column: ({ qRow, qCol, modules, rand }) => {
    if (inFinderZone(qRow, qCol, modules)) {
      // finder must read as a clean square: centre + outer ring are LIGHT (dark
      // modules → light material), with the gap ring a dark moat (in light()).
      // The outer ring was LEAF_L — the SAME green as the park, which erased the
      // finder boundary; a light reed restores the high-contrast border.
      return finderRing(qRow, qCol, modules) <= 1
        ? { height: 1.9, scanHeight: SCAN_H, color: STONE_PALE }
        : { height: 1.35, scanHeight: SCAN_H, color: FIN_REED };
    }
    // Every cell eases to ONE flat height (SCAN_H) for scanning, so the top-down
    // view is a single smooth plane of coloured tiles. Leaving per-zone height
    // steps (the dominant park was 1.0 vs 0.7) puts a vertical edge between every
    // module — that sub-module relief is what broke jsQR's binarisation at full
    // resolution, even though the pattern was correct.
    const zone = zoneOf(qCol, qRow, modules);
    if (zone === 'wall') return { height: 1.0, scanHeight: SCAN_H, color: dimPair(QR_LIGHT, QR_DARK).light };
    if (zone === 'pond') return { height: 1.1, scanHeight: SCAN_H, color: dimPair(LAKE_LILY, POND_DARK).light }; // jade reflections
    const v = rand * 0.05 * scanC(); // jitter shrinks with contrast so it can't flip a low-contrast bit
    return zone === 'road'
      ? { height: 1.0, scanHeight: SCAN_H, color: shade(dimPair(ROAD_L, ROAD_D).light, v) }
      : { height: 1.0, scanHeight: SCAN_H, color: shade(dimPair(PARK_L, PARK_D).light, v) };
  },

  light: ({ qRow, qCol, modules, rand }) => {
    if (inFinderZone(qRow, qCol, modules))
      return { height: 0.45, scanHeight: SCAN_H, color: '#142e29' };
    const zone = zoneOf(qCol, qRow, modules);
    if (zone === 'wall') return { height: 1.0, scanHeight: SCAN_H, color: dimPair(QR_LIGHT, QR_DARK).dark };
    if (zone === 'pond') return { height: 0.8, scanHeight: SCAN_H, color: dimPair(LAKE_LILY, POND_DARK).dark };
    const v = rand * 0.05 * scanC();
    return zone === 'road'
      ? { height: 1.0, scanHeight: SCAN_H, color: shade(dimPair(ROAD_L, ROAD_D).dark, v) }
      : { height: 0.7, scanHeight: SCAN_H, color: shade(dimPair(PARK_L, PARK_D).dark, v) };
  },

  props: (matrix: QRMatrix): PropVoxel[] => {
    const qz = matrix.quietZone;
    const n = matrix.modules;
    const center = (n - 1) / 2;
    const ccol = Math.round(qz + center);
    const crow = Math.round(qz + center);
    const rawOut: PropVoxel[] = [];

    rawOut.push(...buildPavilion(ccol, crow, 1.0, matrix));
    rawOut.push(...buildWall(ccol, crow, 1.0, n, matrix));
    rawOut.push(...buildLake(ccol, crow, 1.0, n, matrix));

    const out: PropVoxel[] = [];
    for (const v of rawOut) {
      if (inFinderZone(v.row - qz, v.col - qz, n)) continue;
      out.push(v);
    }

    for (const [fc, fr] of [[qz + 3, qz + 3], [qz + n - 4, qz + 3], [qz + 3, qz + n - 4]]) {
      out.push(...decorateFinder(fc, fr, 1.0));
    }

    const placed = new Set<number>();
    const rOf = (r: number, c: number) => Math.hypot(c - qz - center, r - qz - center);

    const scatterTrees = (anchorMin: number, anchorMax: number, maxNodes: number) => {
      let nodes = 0;
      for (let r = 0; r < matrix.size; r++) {
        for (let c = 0; c < matrix.size; c++) {
          if (!matrix.cells[r][c]) continue; 
          if (r - qz === 6 || c - qz === 6) continue;
          if (zoneOf(c - qz, r - qz, n) !== 'park') continue;
          
          const dx = c - qz - center;
          const dz = r - qz - center;

          // Protect the outer edge where stelae are placed
          if (Math.abs(dx) >= center - 2) continue;
          
          // Protect the central terrace and pavilion
          if (Math.max(Math.abs(dx), Math.abs(dz)) <= DAIS_R + 1) continue;
          
          // Protect the finder corners
          if (inFinderZone(r - qz, c - qz, n)) continue;
          
          const rm = rOf(r, c);
          if (rm < anchorMin || rm > anchorMax) continue;
          
          const key = r * 10000 + c;
          if (placed.has(key)) continue;

          let rnd = (Math.imul(r + 7, 73856093) ^ Math.imul(c + 13, 19349663)) >>> 0;
          rnd = Math.imul(rnd ^ (rnd >>> 13), 0x85ebca6b) >>> 0;
          const r01 = ((rnd ^ (rnd >>> 16)) >>> 0) / 0xffffffff;

          if (r01 > 0.85 && nodes < maxNodes) {
            placed.add(key);
            out.push(...makeTree(c, r, 0.85, r01));
            nodes++;
          }
        }
      }
    };

    scatterTrees(15, 25, 200);
    scatterTrees(27, 40, 300);

    return out;
  },
};
