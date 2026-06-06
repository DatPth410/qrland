/**
 * Headless sanity check for the QR + theme data pipeline (no GPU needed).
 * Replicates what QRField does — calls column()/light() per cell and props() —
 * and asserts every height is finite, every colour is a valid hex, and reports
 * the total instance count per world (a rough perf indicator).
 *
 *   npx tsx scripts/check-themes.ts
 */
import { generateQR } from '../src/qr/generate';
import { themes } from '../src/scene/themes';

const QR_OPTS = { errorCorrectionLevel: 'H', quietZone: 4, minVersion: 11 } as const;

function moduleRand(a: number, b: number): number {
  let h = (Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

const isHex = (c: unknown): boolean => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

let failures = 0;
for (const theme of themes) {
  const text = theme.sampleText ?? 'https://anthropic.com';
  const m = generateQR(text, QR_OPTS);
  const qz = m.quietZone;
  const n = m.modules;
  const center = (n - 1) / 2 || 1;
  let dark = 0;
  let light = 0;
  let badHeight = 0;
  let badColor = 0;

  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      const qRow = r - qz;
      const qCol = c - qz;
      const nx = (qCol - center) / center;
      const ny = (qRow - center) / center;
      const dist = Math.min(1, Math.hypot(nx, ny) / Math.SQRT2);
      const input = { qRow, qCol, modules: n, nx, ny, dist, rand: moduleRand(qRow, qCol) };
      const spec = m.cells[r][c]
        ? theme.column(input)
        : theme.light
          ? theme.light(input)
          : { height: 0.5, color: theme.lightColor };
      if (m.cells[r][c]) dark++;
      else light++;
      if (!Number.isFinite(spec.height)) badHeight++;
      if (!isHex(spec.color)) badColor++;
      if (spec.scanHeight !== undefined && !Number.isFinite(spec.scanHeight)) badHeight++;
    }
  }

  const props = theme.props ? theme.props(m) : [];
  let badProp = 0;
  for (const p of props) {
    if (
      !Number.isFinite(p.col) ||
      !Number.isFinite(p.row) ||
      !Number.isFinite(p.y) ||
      !Number.isFinite(p.size) ||
      !isHex(p.color)
    ) {
      badProp++;
    }
  }

  const total = dark + light + props.length;
  const ok = badHeight === 0 && badColor === 0 && badProp === 0;
  if (!ok) failures++;
  console.log(
    `${ok ? '✓' : '✗'} ${theme.name.padEnd(16)} grid=${m.size} modules=${n} ` +
      `dark=${dark} light=${light} props=${props.length} total=${total} ` +
      `badHeight=${badHeight} badColor=${badColor} badProp=${badProp}`,
  );
}

console.log(failures === 0 ? '\nAll worlds generated clean data.' : `\n${failures} world(s) had bad data.`);
process.exit(failures === 0 ? 0 : 1);
