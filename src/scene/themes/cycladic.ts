import * as THREE from 'three';
import type { PropVoxel, QRTheme } from '../theme';
import type { QRMatrix } from '../../qr/generate';

/**
 * Cycladic archipelago. Dark QR modules become raised LIGHT sand; light modules
 * become the dark blue SEA. Seen straight down, light-sand-on-dark-sea is a
 * high-contrast (inverted) QR that scanners decode — so the island stays fully
 * 3D, with its big church and trees, and is scannable from the top.
 *
 * What "damages" the code is the solid central island disc under the church.
 * Keep ISLAND_R and the forced QR version balanced: bigger church ⇒ bigger
 * island ⇒ more center overwrite ⇒ needs a higher version (more error-correction
 * blocks) to still decode.
 */

// --- sizing (module/voxel units) ---
const ISLAND_R = 10; // solid central island radius (this is the QR "damage")
const PLAZA_R = 9; // church plaza radius (round, fits inside the island)
const BODY_R = 6; // church body half-width
const BODY_H = 6; // church body height
const DRUM_R = 5; // dome drum radius
const DOME_R = 6; // dome base radius

const SAND_H = 1.3;
const SEA_H = 0.5;
const SAND_VAR = 0.06;

// --- palette ---
const SAND = '#e7d3a0';
const SAND_ISLAND = '#ecdcad';
const SEA = '#16596c';
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
const GREENS = ['#6f9050', '#5e7d3f', '#7fa45c', '#557237'];
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

/**
 * A grand whitewashed church: stepped plaza, an arched portico, a body with
 * arched windows, a windowed drum, a big rounded blue dome, a campanile, and a
 * cross — proportioned to dominate its island like the reference.
 */
function buildChurch(ccol: number, crow: number, baseY: number): PropVoxel[] {
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

  // stepped round plaza (two tiers) — kept inside the island so nothing pokes
  // over the sea (which would corrupt the QR)
  for (let x = -PLAZA_R; x <= PLAZA_R; x++)
    for (let z = -PLAZA_R; z <= PLAZA_R; z++) {
      const d2 = x * x + z * z;
      if (d2 > PLAZA_R * PLAZA_R) continue;
      put(x, z, 0, d2 > (PLAZA_R - 1) * (PLAZA_R - 1) ? shade(STONE, -0.05) : STONE);
      if (d2 <= (PLAZA_R - 1.5) * (PLAZA_R - 1.5)) put(x, z, 1, shade(STONE, 0.02));
    }

  // main body (shelled) with arched windows
  for (let x = -BODY_R; x <= BODY_R; x++)
    for (let z = -BODY_R; z <= BODY_R; z++) {
      const onWall = Math.abs(x) === BODY_R || Math.abs(z) === BODY_R;
      for (let l = 2; l <= BODY_H + 1; l++) {
        if (!onWall && l !== BODY_H + 1) continue; // shell: walls + roof only
        put(x, z, l, onWall ? ((x + z) & 1 ? WHITE_SH : WHITE) : WHITE_DK);
      }
    }
  // arched windows (blue niches) around the body
  for (let x = -BODY_R + 1; x <= BODY_R - 1; x += 2) {
    put(x, BODY_R, 4, BLUE_TRIM);
    put(x, -BODY_R, 4, BLUE_TRIM);
    put(BODY_R, x, 4, BLUE_TRIM);
    put(-BODY_R, x, 4, BLUE_TRIM);
  }

  // front portico / colonnade (an arcade of pillars in front of the body)
  const pz = BODY_R + 1;
  for (let x = -BODY_R; x <= BODY_R; x++) {
    const pillar = (x + BODY_R) % 2 === 0;
    for (let l = 1; l <= 4; l++) {
      if (pillar || l === 4) put(x, pz, l, l === 4 ? WHITE : WHITE_SH); // gaps = arches, lintel on top
    }
  }
  for (let x = -BODY_R; x <= BODY_R; x++) put(x, pz, 5, shade(STONE, 0.0)); // portico roof

  // windowed drum
  disk(BODY_H + 2, DRUM_R, WHITE);
  disk(BODY_H + 3, DRUM_R, WHITE);
  const dwin = Math.round(DRUM_R);
  for (const [x, z] of [
    [dwin, 0],
    [-dwin, 0],
    [0, dwin],
    [0, -dwin],
    [dwin - 1, dwin - 1],
    [-(dwin - 1), -(dwin - 1)],
    [dwin - 1, -(dwin - 1)],
    [-(dwin - 1), dwin - 1],
  ])
    put(x, z, BODY_H + 3, BLUE_TRIM);

  // big rounded dome (hemisphere of stacked disks)
  const domeBase = BODY_H + 4;
  const H = DOME_R + 1.5;
  for (let l = 0; l <= H; l++) {
    const r = DOME_R * Math.sqrt(Math.max(0, 1 - (l / H) ** 2));
    if (r < 0.4) {
      put(0, 0, domeBase + l, DOME_TOP);
      break;
    }
    const col = l === 0 ? DOME_DARK : l > H - 2 ? DOME_TOP : DOME;
    disk(domeBase + l, r, col);
  }
  const domeTopL = domeBase + Math.ceil(H);
  // cross atop the dome
  extras.push(
    { col: ccol, row: crow, y: baseY + domeTopL + 0.6, size: 0.5, color: CROSS },
    { col: ccol, row: crow, y: baseY + domeTopL + 1.5, size: 0.5, color: CROSS },
    { col: ccol - 0.7, row: crow, y: baseY + domeTopL + 1.0, size: 0.5, color: CROSS },
    { col: ccol + 0.7, row: crow, y: baseY + domeTopL + 1.0, size: 0.5, color: CROSS },
  );

  // campanile (bell tower) on the front-left corner of the plaza
  const tx = -BODY_R - 1;
  const tz = BODY_R + 1;
  for (let l = 1; l <= BODY_H + 4; l++) put(tx, tz, l, l === 5 || l === 8 ? BLUE_TRIM : WHITE);
  put(tx, tz, BODY_H + 5, DOME, 0.9);
  extras.push(
    { col: ccol + tx, row: crow + tz, y: baseY + BODY_H + 6, size: 0.34, color: CROSS },
    { col: ccol + tx, row: crow + tz, y: baseY + BODY_H + 6.8, size: 0.34, color: CROSS },
  );

  // entrance steps in front of the portico
  for (let s = 1; s <= 3; s++) put(0, pz + s, 0, shade(STONE, -0.03 * s));

  return [...map.values(), ...extras];
}

function makeTree(col: number, row: number, groundY: number, rnd: number): PropVoxel[] {
  const green = GREENS[Math.floor(rnd * GREENS.length) % GREENS.length];
  const tall = rnd > 0.55;
  const out: PropVoxel[] = [
    { col, row, y: groundY, size: 0.5, color: TRUNK },
    { col, row, y: groundY + 0.4, size: 1.0 + rnd * 0.5, color: green },
  ];
  if (tall) out.push({ col, row, y: groundY + 1.15, size: 0.75, color: shade(green, -0.05) });
  return out;
}

export const cycladicTheme: QRTheme = {
  name: 'Cyclades',
  background: '#e3e9ec',
  background2: '#acc0c9',
  fog: '#c2d0d6',
  groundColor: '#0e4555',
  lightColor: '#e7d3a0',
  darkColor: '#16596c',
  lightSceneColor: SEA,
  lightSceneHeight: SEA_H,
  sunColor: '#fff4e2',
  ambient: 0.6,

  column: ({ qRow, qCol, modules, rand }) => {
    const center = (modules - 1) / 2;
    const rMod = Math.hypot(qCol - center, qRow - center);
    if (rMod <= ISLAND_R) return { height: SAND_H, color: shade(SAND_ISLAND, (rand - 0.5) * 0.03) };
    return { height: SAND_H - 0.15 + rand * SAND_VAR, color: shade(SAND, (rand - 0.5) * 0.04) };
  },

  props: (matrix: QRMatrix): PropVoxel[] => {
    const qz = matrix.quietZone;
    const n = matrix.modules;
    const center = (n - 1) / 2;
    const ccol = Math.round(qz + center);
    const crow = Math.round(qz + center);
    const out: PropVoxel[] = [];

    // fill the central island solid: any SEA cell within ISLAND_R becomes sand
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) {
        if (matrix.cells[r][c]) continue;
        const rMod = Math.hypot(c - qz - center, r - qz - center);
        if (rMod > ISLAND_R) continue;
        out.push({
          col: c,
          row: r,
          y: SAND_H - 1,
          size: 1,
          color: shade(SAND_ISLAND, (rand2(r, c) - 0.5) * 0.03),
        });
      }
    }

    // the grand church
    out.push(...buildChurch(ccol, crow, SAND_H));

    // trees ringing the church (on the sandy shore), plus a few sea rocks
    let trees = 0;
    let rocks = 0;
    const churchHalf = PLAZA_R + 0.5;
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) {
        const dx = c - qz - center;
        const dz = r - qz - center;
        const rMod = Math.hypot(dx, dz);
        const rnd = rand2(r, c);
        const onChurch = Math.abs(dx) <= churchHalf && Math.abs(dz) <= churchHalf;
        // shore ring around the church, plus a little onto the closest sandbars
        if (!onChurch && rMod > churchHalf && rMod <= ISLAND_R + 1.6 && trees < 30 && rnd > 0.4) {
          out.push(...makeTree(c, r, rMod <= ISLAND_R ? SAND_H : SAND_H - 0.15, rand2(c, r)));
          trees++;
        } else if (
          !matrix.cells[r][c] &&
          rMod > ISLAND_R + 2 &&
          rMod < ISLAND_R + 9 &&
          rocks < 14 &&
          rnd > 0.93
        ) {
          out.push({
            col: c,
            row: r,
            y: SEA_H,
            size: 0.4 + rnd * 0.3,
            color: shade(ROCK, (rnd - 0.5) * 0.1),
          });
          rocks++;
        }
      }
    }
    return out;
  },
};
