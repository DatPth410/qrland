import * as THREE from 'three';
import type { PropVoxel, QRTheme } from '../theme';
import type { QRMatrix } from '../../qr/generate';

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

const PARK_L = '#88a356'; // grass
const PARK_D = '#425921';
const ROAD_L = '#c4604d'; // bright terracotta red brick paving
const ROAD_D = '#80382a'; // darker red brick joints
const LAKE_W = '#678263'; // murky jade water (dark enough to scan as a light module)
const LAKE_LILY = '#a8c7a3'; // pale green water reflections/lilypads (reads as dark module)
const LEAF_L = '#73993d';
const LEAF_D = '#355214';
const TRUNK = '#5e402b';

const QR_LIGHT = '#e8e6dc';
const QR_DARK = '#55544d';

const DAIS_R = 14;
const PR = 6;
const EAVE_R = 10;
const ROOF_KEEP_R = 4;

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

function applyFlattening(voxels: PropVoxel[], _matrix: QRMatrix, baseY: number) {
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
      v.collapseTo = 0.0;
    }
  }

  for (const v of top.values()) {
    const isDark = !!(_matrix.cells[Math.round(v.row)] && _matrix.cells[Math.round(v.row)][Math.round(v.col)]);
    v.color = isDark ? QR_LIGHT : QR_DARK;
    v.isoOnly = true;
    v.tile = true;
    v.size = 1.0;
    v.collapseTo = baseY + 0.15; // Above pond base (1.1) to avoid z-fighting
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
  const bodyTop = 20;

  // Four massive whitewashed brick pillars
  for (const [px, pz] of [[-PR, -PR], [PR, -PR], [-PR, PR], [PR, PR]]) {
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        for (let l = 2; l <= bodyBase - 1; l++) {
          const edge = Math.abs(dx) === 1 || Math.abs(dz) === 1;
          put(px + dx, pz + dz, l, edge ? STONE_SH : STONE_PALE);
        }
        // Plinth & Capital
        put(px + dx, pz + dz, 2, STONE_DK);
        put(px + dx, pz + dz, bodyBase - 1, STONE_DK);
      }
  }

  // Wooden Balcony Deck
  const BR = 7; // wall radius
  const DECK_R = 9;
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

  // Iconic Circular Windows (Constellation of Literature)
  const cy = bodyBase + 4;
  const roundWindow = (nx: number, nz: number) => {
    const tx = nz;
    const tz = -nx;
    for (let a = -4; a <= 4; a++) {
      for (let dy = -4; dy <= 4; dy++) {
        const r2 = a * a + dy * dy;
        if (r2 > 15) continue;
        const x = nx * BR + tx * a;
        const z = nz * BR + tz * a;
        const ly = cy + dy;
        
        if (r2 > 10) {
           put(x, z, ly, WOOD_RED); // Outer circular frame
        } else if (a === 0 || dy === 0 || Math.abs(a) === Math.abs(dy)) {
           put(x, z, ly, WOOD_RED_SH); // Wooden sun-rays
        } else {
           map.delete(`${x}|${z}|${ly}`); // Open hole
        }
      }
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

  // QR Encoding top faces
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
    
    if (!isRoof) continue; // Do not encode QR on the red terrace!
    
    const inKeepPatch = Math.max(Math.abs(x), Math.abs(z)) <= ROOF_KEEP_R;
    if (isRoof && !inKeepPatch) continue; // Keep the traditional roof tiles!
    
    v.color = isDark ? QR_LIGHT : QR_DARK;
  }

  return [...map.values(), ...extras];
}

function buildWall(ccol: number, crow: number, baseY: number, n: number, matrix: QRMatrix): PropVoxel[] {
  const vox: PropVoxel[] = [];
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

  applyFlattening(vox, matrix, baseY);
  return vox;
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
      if (ring <= 1) {
        out.push({ col, row, y: baseY + 0.9, size: 0.6, color: STONE_SH, isoOnly: true, collapseTo: baseY + 0.17 });
        out.push({ col, row, y: baseY + 1.5, size: 0.8, color: STONE_PALE, isoOnly: true, collapseTo: baseY + 0.16 });
      } else if (ring === 3) {
        out.push({ col, row, y: baseY + 0.35, size: 0.55, color: LEAF_D, isoOnly: true, collapseTo: baseY + 0.17 });
        out.push({ col, row, y: baseY + 0.85, size: 0.85, color: LEAF_L, isoOnly: true, collapseTo: baseY + 0.16 });
      }
    }
  return out;
}

function makeTree(col: number, row: number, gy: number, rnd: number): PropVoxel[] {
  const W = 0.98;
  const tiers = rnd < 0.2 ? 3 : rnd < 0.7 ? 4 : 5;
  const out: PropVoxel[] = [{ col, row, y: gy, size: 0.5, color: TRUNK, isoOnly: true, collapseTo: 1.18 }];
  
  for (let i = 0; i < tiers; i++) {
    const isCrown = i === tiers - 1;
    out.push({
      col,
      row,
      y: gy + 0.7 + i * 0.9,
      size: W,
      color: i >= tiers - 2 ? LEAF_L : LEAF_D,
      ...(isCrown ? { isoOnly: true, tile: true, collapseTo: 1.19 } : { isoOnly: true, collapseTo: 0.0 }),
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
      return finderRing(qRow, qCol, modules) <= 1
        ? { height: 1.9, scanHeight: 1.0, color: STONE_PALE }
        : { height: 1.35, scanHeight: 1.0, color: LEAF_L };
    }
    const zone = zoneOf(qCol, qRow, modules);
    if (zone === 'wall') return { height: 1.0, color: QR_LIGHT };
    if (zone === 'pond') return { height: 1.1, color: LAKE_LILY }; // jade water reflections
    const v = rand * 0.05;
    return zone === 'road'
      ? { height: 1.0, color: shade(ROAD_L, v) }
      : { height: 1.0, color: shade(PARK_L, v) };
  },

  light: ({ qRow, qCol, modules, rand }) => {
    if (inFinderZone(qRow, qCol, modules))
      return { height: 0.45, scanHeight: 1.0, color: '#142e29' };
    const zone = zoneOf(qCol, qRow, modules);
    if (zone === 'wall') return { height: 1.0, color: QR_DARK };
    if (zone === 'pond') return { height: 0.8, color: LAKE_W };
    const v = rand * 0.05;
    return zone === 'road'
      ? { height: 1.0, color: shade(ROAD_D, v) }
      : { height: 0.7, color: shade(PARK_D, v) };
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
