import type { QRMatrix } from '../qr/generate';

/**
 * A QRTheme turns the QR matrix into a 3D scene. The scannable foundation never
 * changes — only these palette fields and the `column()` function do. To make a
 * new world (island, forest, city, …) you write one theme object.
 *
 *  - Flat view always renders a standard high-contrast QR (darkColor on
 *    lightColor), so scannability is independent of the theme.
 *  - Scene view raises each module into a voxel. Dark modules use `column()`
 *    for height + color; light modules use `lightSceneColor`/`lightSceneHeight`.
 *  - Optional `props` add decorative voxels that only appear in 3D, so they
 *    never affect the flat QR.
 */

export interface ColumnInput {
  /** module coordinates within the QR (0..modules-1), excluding quiet zone */
  qRow: number;
  qCol: number;
  /** number of modules along one side */
  modules: number;
  /** normalized offset from center, each in [-1, 1] */
  nx: number;
  ny: number;
  /** radial distance from center, 0 at center → ~1 at the edge mid-points */
  dist: number;
  /** deterministic pseudo-random value in [0, 1) for this module */
  rand: number;
}

export interface ColumnSpec {
  /** column height in voxel units at full 3D (>= ~0.15) */
  height: number;
  /** hex color of the column in 3D view */
  color: string;
}

/** A decorative voxel placed in 3D view only (scales in with the raise factor). */
export interface PropVoxel {
  /** grid position: x = col, z = row (same coordinate space as modules) */
  col: number;
  row: number;
  /** vertical units above the ground */
  y: number;
  /** size in voxel units */
  size: number;
  color: string;
}

export interface QRTheme {
  name: string;
  /** sky gradient top color */
  background: string;
  /** sky gradient bottom color (defaults to background) */
  background2?: string;
  /** fog color (defaults to background2/background) */
  fog?: string;
  /** pedestal color beneath the field */
  groundColor: string;
  /** flat-QR "paper" (light modules at rest) */
  lightColor: string;
  /** flat-QR "ink" (dark modules at rest) */
  darkColor: string;
  /** 3D color of light modules (defaults to lightColor) */
  lightSceneColor?: string;
  /** 3D height of light modules (defaults to a thin tile) */
  lightSceneHeight?: number;
  /** sun (directional light) color */
  sunColor?: string;
  /** ambient light intensity 0..1 */
  ambient?: number;
  /** per dark-module column shape + color in 3D */
  column: (i: ColumnInput) => ColumnSpec;
  /** optional decorative voxels for 3D view, given the full matrix */
  props?: (matrix: QRMatrix) => PropVoxel[];
}

/**
 * Default placeholder theme: a clean dark extruded QR on a slate pedestal.
 * Looks intentional on its own and is fully scannable in flat view.
 */
export const defaultTheme: QRTheme = {
  name: 'Monochrome',
  background: '#15171d',
  background2: '#0c0d11',
  fog: '#0e0f13',
  groundColor: '#23262e',
  lightColor: '#f5f5f6',
  darkColor: '#14161c',
  sunColor: '#ffffff',
  ambient: 0.55,
  column: ({ rand, dist }) => ({
    height: 0.7 + (1 - dist) * 0.5 + rand * 0.25,
    color: '#1b1e26',
  }),
};
