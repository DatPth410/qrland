// gen-icons.mjs — generates the QR Land favicon / app-icon set from the
// "Land Block" logo concept (design handoff: QR Land - Logo Explorations.html,
// concept 01 in logo-marks.jsx). The isometric voxel engine below is a faithful
// port of that file so the exported assets match the design pixel-for-pixel.
//
// Run:  node scripts/gen-icons.mjs
// Out:  public/favicon.svg, public/favicon.ico, public/*.png,
//       public/site.webmanifest, src/ui/landBlockSvg.ts
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
mkdirSync(PUBLIC, { recursive: true });

/* ── isometric voxel engine (ported from logo-marks.jsx) ───────────────── */
const A = 10, B = 8;                       // x/y spread, height
const f = (n) => Math.round(n * 100) / 100;
const proj = (wx, wy, wz) => [(wx - wy) * A, (wx + wy) * (A / 2) - wz * B];
const poly = (pts, fill) =>
  `<polygon points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')}" fill="${fill}"/>`;

function boxFrag(b) {
  const { x0, y0, x1, y1, z0 = 0, z1, top, sideS, sideE, qr } = b;
  const P = (x, y, z) => proj(x, y, z);
  const all = [];
  let s = '';
  const e = [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)];   // east wall
  s += poly(e, sideE); all.push(...e);
  const so = [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)];  // south wall
  s += poly(so, sideS); all.push(...so);
  if (qr) {
    const n = qr.n, sx = (x1 - x0) / n, sy = (y1 - y0) / n;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const cc = [P(x0 + c * sx, y0 + r * sy, z1), P(x0 + (c + 1) * sx, y0 + r * sy, z1),
                  P(x0 + (c + 1) * sx, y0 + (r + 1) * sy, z1), P(x0 + c * sx, y0 + (r + 1) * sy, z1)];
      s += poly(cc, qr.cells[r * n + c]);
    }
    const tc = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
    all.push(...tc);
  } else {
    const t = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
    s += poly(t, top); all.push(...t);
  }
  return { s, pts: all };
}

// returns { body, viewBox:{minX,minY,w,h} } — body is raw polygons in iso space
function isoBody(boxes, pad = 6) {
  const sorted = [...boxes].sort((a, b) => (a.x0 + a.y0 + (a.z0 || 0)) - (b.x0 + b.y0 + (b.z0 || 0)));
  let body = '', pts = [];
  for (const b of sorted) { const r = boxFrag(b); body += r.s; pts.push(...r.pts); }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  return { body, viewBox: { minX: f(minX), minY: f(minY), w: f(w), h: f(h) } };
}

/* ── palette + Land Block pattern (concept 01) ─────────────────────────── */
const GRASS = ['#86ad5a', '#7ea64f', '#8fb15c', '#79a049'];
const grassAt = (i) => GRASS[i % GRASS.length];
const SOIL_S = '#7a5436', SOIL_E = '#5b3d27';
const qrCells = (n, pat, accents = {}) => ({
  n,
  cells: pat.map((v, i) => accents[i] || (v ? '#41612f' : grassAt(i))),
});

const LAND_PATTERN = [
  1, 1, 1, 0, 1, 0, 1,
  1, 0, 1, 0, 0, 1, 1,
  1, 1, 1, 0, 1, 0, 0,
  0, 0, 0, 1, 0, 1, 1,
  1, 0, 1, 1, 1, 0, 1,
  0, 1, 0, 0, 1, 1, 0,
  1, 1, 0, 1, 0, 0, 1,
];
const LAND_QR = qrCells(7, LAND_PATTERN, { 23: '#c8503a', 38: '#d99b32', 45: '#c8503a' });
const landBlock = isoBody([{ x0: 0, y0: 0, x1: 7, y1: 7, z1: 4.4, sideS: SOIL_S, sideE: SOIL_E, qr: LAND_QR }]);

/* ── compose a square icon: gradient tile + centered land block ────────── */
// Fit the land-block bbox into a centred box (xMidYMid meet) and bake the
// transform so the output is a single flat SVG (robust across rasterizers).
function compose({ size = 512, rx = 0.22, inner = 0.8, idSuffix = '' }) {
  const { body, viewBox: vb } = landBlock;
  const box = size * inner;
  const off = (size - box) / 2;
  const s = box / Math.max(vb.w, vb.h);
  const tx = off + (box - vb.w * s) / 2 - vb.minX * s;
  const ty = off + (box - vb.h * s) / 2 - vb.minY * s;
  const r = f(size * rx);
  const gid = `g${idSuffix}`;
  // linear-gradient(158deg, #f1f3ec, #e3e5da) → top-left light, bottom-right shade
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="${gid}" x1="0.31" y1="0.04" x2="0.69" y2="0.96">
    <stop offset="0" stop-color="#f1f3ec"/><stop offset="1" stop-color="#e3e5da"/>
  </linearGradient></defs>
  <rect width="${size}" height="${size}"${r ? ` rx="${r}" ry="${r}"` : ''} fill="url(#${gid})"/>
  <g transform="translate(${f(tx)},${f(ty)}) scale(${f(s)})" shape-rendering="geometricPrecision">${body}</g>
</svg>`;
}

const rasterize = (svg, size) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' })
    .render().asPng();

/* ── build a PNG-in-ICO container (16/32/48) ───────────────────────────── */
function buildIco(entries) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach((e, i) => {
    const o = i * 16;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o);
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(e.png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += e.png.length;
  });
  return Buffer.concat([head, dir, ...entries.map((e) => e.png)]);
}

/* ── emit ──────────────────────────────────────────────────────────────── */
const master = compose({ size: 512, rx: 0.22, inner: 0.8 });            // rounded tile
const fullBleed = compose({ size: 512, rx: 0, inner: 0.8 });            // apple-touch (iOS rounds)
const maskable = compose({ size: 512, rx: 0, inner: 0.66 });            // Android maskable safe-zone

writeFileSync(join(PUBLIC, 'favicon.svg'), master);

const out = [
  ['favicon-16.png', rasterize(master, 16)],
  ['favicon-32.png', rasterize(master, 32)],
  ['favicon-48.png', rasterize(master, 48)],
  ['favicon-96.png', rasterize(master, 96)],
  ['apple-touch-icon.png', rasterize(fullBleed, 180)],
  ['web-app-manifest-192x192.png', rasterize(master, 192)],
  ['web-app-manifest-512x512.png', rasterize(master, 512)],
  ['icon-maskable-512.png', rasterize(maskable, 512)],
];
for (const [name, png] of out) writeFileSync(join(PUBLIC, name), png);

const ico = buildIco([16, 32, 48].map((size) => ({ size, png: rasterize(master, size) })));
writeFileSync(join(PUBLIC, 'favicon.ico'), ico);

const manifest = {
  name: 'QR Land',
  short_name: 'QR Land',
  description: 'Turn any link into a scannable 3D voxel landmark.',
  start_url: '/',
  display: 'standalone',
  background_color: '#0e0f13',
  theme_color: '#0e0f13',
  icons: [
    { src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync(join(PUBLIC, 'site.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

// inline copy of the master mark for the in-app header (single source of truth)
const ts = `// AUTO-GENERATED by scripts/gen-icons.mjs — do not edit by hand.
// The "Land Block" logo mark (design concept 01), inlined for crisp in-app use.
export const LAND_BLOCK_SVG = ${JSON.stringify(master)};
`;
writeFileSync(join(ROOT, 'src', 'ui', 'landBlockSvg.ts'), ts);

console.log('icons written to public/ :');
console.log(['favicon.svg', 'favicon.ico', ...out.map((o) => o[0]), 'site.webmanifest'].map((n) => '  • ' + n).join('\n'));
console.log('  • src/ui/landBlockSvg.ts');
