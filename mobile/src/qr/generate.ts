import QRCode from 'qrcode';

export interface QRMatrix {
  /** grid dimension including the quiet-zone border */
  size: number;
  /** number of QR modules along one side (without quiet zone) */
  modules: number;
  /** [row][col] over the full grid, true = dark module */
  cells: boolean[][];
  /** width of the light quiet zone, in cells */
  quietZone: number;
  /** the encoded payload */
  text: string;
  /** count of dark modules */
  darkCount: number;
}

export interface GenerateOptions {
  quietZone?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  /** force a QR version (1-40) for a stable layout; omit to auto-fit */
  version?: number;
  /** floor the auto-fit version (so short payloads still get enough modules
   *  for the centerpiece to stay within error-correction); ignored if `version`
   *  is set */
  minVersion?: number;
}

/**
 * Encode `text` into a QR module bitmap, padded with a light quiet zone.
 * The full grid drives the 3D field: dark modules rise into themed columns,
 * light modules stay as flat "paper". Flat (top-down) view renders a standard,
 * high-contrast, scannable QR.
 */
export function generateQR(text: string, opts: GenerateOptions = {}): QRMatrix {
  const { quietZone = 4, errorCorrectionLevel = 'M', version, minVersion } = opts;

  let qr = QRCode.create(text, { errorCorrectionLevel, version });
  if (version === undefined && minVersion !== undefined && qr.version < minVersion) {
    qr = QRCode.create(text, { errorCorrectionLevel, version: minVersion });
  }
  const n = qr.modules.size;
  const data = qr.modules.data;
  const size = n + quietZone * 2;

  const cells: boolean[][] = [];
  let darkCount = 0;
  for (let r = 0; r < size; r++) {
    const row: boolean[] = new Array(size);
    for (let c = 0; c < size; c++) {
      const mr = r - quietZone;
      const mc = c - quietZone;
      const dark = mr >= 0 && mr < n && mc >= 0 && mc < n && data[mr * n + mc] === 1;
      row[c] = dark;
      if (dark) darkCount++;
    }
    cells.push(row);
  }

  return { size, modules: n, cells, quietZone, text, darkCount };
}
