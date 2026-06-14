import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useView } from '../state/useView';
import type { QRMatrix } from '../qr/generate';
import type { ColumnSpec, PropVoxel, QRTheme } from './theme';

const GAP_3D = 0; // no inter-voxel gap — flush voxels (the seam "grid" looked noisy)
const SCAN_LAMBDA = 5; // gap-close damping speed

/** deterministic pseudo-random in [0,1) per module */
function moduleRand(a: number, b: number): number {
  let h = (Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

interface Cell {
  r: number;
  c: number;
  h: number;
  /** height to ease toward in scan view (== h when the cell doesn't fold flat) */
  hScan: number;
  color: THREE.Color;
}

export function QRField({ matrix, theme }: { matrix: QRMatrix; theme: QRTheme }) {
  const view = useView((s) => s.view);
  // 0 = scene (isometric, gaps), 1 = scan (top-down, solid). Heights never change.
  const gap = useRef(view === 'scan' ? 1 : 0);
  const lastGap = useRef(-1);

  const darkRef = useRef<THREE.InstancedMesh>(null!);
  const lightRef = useRef<THREE.InstancedMesh>(null!);
  const propRef = useRef<THREE.InstancedMesh>(null!);
  const glowingPropRef = useRef<THREE.InstancedMesh>(null!);
  const isoPropRef = useRef<THREE.InstancedMesh>(null!);
  const glowIsoPropRef = useRef<THREE.InstancedMesh>(null!);

  const time = useView((s) => s.time);
  const isNight = time < 6 || time >= 18;

  const { darkCells, lightCells, standardProps, glowingProps, isoProps, glowIsoProps, lightSources } = useMemo(() => {
    const qz = matrix.quietZone;
    const n = matrix.modules;
    const center = (n - 1) / 2 || 1;
    const seaColor = theme.lightSceneColor ?? theme.lightColor;
    const seaH = theme.lightSceneHeight ?? 0.5;

    const dark: Cell[] = [];
    const light: Cell[] = [];
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) {
        const qRow = r - qz;
        const qCol = c - qz;
        const nx = (qCol - center) / center;
        const ny = (qRow - center) / center;
        const dist = Math.min(1, Math.hypot(nx, ny) / Math.SQRT2);
        const input = { qRow, qCol, modules: n, nx, ny, dist, rand: moduleRand(qRow, qCol) };
        if (!matrix.cells[r][c]) {
          // light module — theme decides (defaults to sea), with a little variation
          const spec: ColumnSpec = theme.light
            ? theme.light(input)
            : { height: seaH, color: seaColor };
          const v = (moduleRand(r, c) - 0.5) * 0.05;
          light.push({
            r,
            c,
            h: spec.height,
            hScan: spec.scanHeight ?? spec.height,
            color: new THREE.Color(spec.color).offsetHSL(0, 0, v),
          });
          continue;
        }
        const spec: ColumnSpec = theme.column(input);
        dark.push({
          r,
          c,
          h: spec.height,
          hScan: spec.scanHeight ?? spec.height,
          color: new THREE.Color(spec.color),
        });
      }
    }
    const propList: PropVoxel[] = theme.props ? theme.props(matrix) : [];
    return {
      darkCells: dark,
      lightCells: light,
      standardProps: propList.filter((p) => !p.isoOnly && !p.glowing),
      glowingProps: propList.filter((p) => p.glowing && !p.isoOnly),
      isoProps: propList.filter((p) => p.isoOnly && !p.glowing), // finder gardens + grove trees — fold flat in scan
      glowIsoProps: propList.filter((p) => p.glowing && p.isoOnly), // lanterns/glows — fold away in scan
      lightSources: propList.filter((p) => p.light),
    };
  }, [matrix, theme]);

  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.85 }), []);
  const lightMat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.15 }), // water-ish
    [],
  );
  const propMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.72 }), []);
  const glowingMat = useMemo(() => new THREE.MeshBasicMaterial(), []);

  const half = matrix.size / 2 - 0.5;
  const tmp = useMemo(() => new THREE.Object3D(), []);

  // t = 0 in scene (3D) view, 1 in scan (flat) view — cells with a distinct
  // scanHeight ease their height between the two as the transition plays.
  const writeCells = (
    mesh: THREE.InstancedMesh | null,
    cells: Cell[],
    footprint: number,
    t: number,
  ) => {
    if (!mesh || mesh.count < cells.length) return; // mesh may be remounting (count change)
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const h = cell.h === cell.hScan ? cell.h : THREE.MathUtils.lerp(cell.h, cell.hScan, t);
      tmp.position.set(cell.c - half, h / 2, cell.r - half);
      tmp.scale.set(footprint, h, footprint);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  // iso-only props (finder-square plants + grove trees): fold down as the view
  // flattens — squash vertically toward `collapseTo` and sink, so they tuck into
  // the sand instead of popping out. At t≈1 they're scaled to ~0 (invisible, and
  // out of the scanner's way so the corners + data cells still decode).
  const writeIsoProps = (mesh: THREE.InstancedMesh | null, list: PropVoxel[], t: number) => {
    if (!mesh || mesh.count < list.length) return;
    const e = 1 - t; // 1 in scene, 0 in scan
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const floor = p.collapseTo ?? p.y;
      if (p.tile) {
        // grove-tree crown → a flat green cap FLUSH with the surrounding sand: a
        // solid column from the ground up to `floor`, which is the local sand height
        // (not SAND_H) so the green sits level with its sandbar neighbours instead of
        // poking up as a lone raised bump. Kept at crown width (a hair under a cell)
        // so the wider sand column beneath shows tan on the canyon walls — exactly
        // like a normal sand cell — and hides the collapsing voxels within it.
        const top = THREE.MathUtils.lerp(p.y + p.size, floor, t); // crown top → sand height
        const bot = THREE.MathUtils.lerp(p.y, 0, t); // crown bottom → ground
        const sy = Math.max(top - bot, 0.0001);
        tmp.position.set(p.col - half, (top + bot) / 2, p.row - half);
        tmp.scale.set(p.size, sy, p.size);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
        continue;
      }
      const y = THREE.MathUtils.lerp(p.y, floor, t);
      const sx = p.size * (0.25 + 0.75 * e); // keep a little footprint, collapse height
      const sy = p.size * e;
      tmp.position.set(p.col - half, y + sy / 2, p.row - half);
      tmp.scale.set(sx, Math.max(sy, 0.0001), sx);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  // colors + prop transforms are constant — set once (after any keyed remount)
  useLayoutEffect(() => {
    const dark = darkRef.current;
    const light = lightRef.current;
    if (!dark || !light || dark.count < darkCells.length || light.count < lightCells.length) return;
    darkCells.forEach((cell, i) => dark.setColorAt(i, cell.color));
    lightCells.forEach((cell, i) => light.setColorAt(i, cell.color));
    if (dark.instanceColor) dark.instanceColor.needsUpdate = true;
    if (light.instanceColor) light.instanceColor.needsUpdate = true;

    // static props: transform + color set once here
    if (propRef.current && propRef.current.count >= standardProps.length) {
      const col = new THREE.Color();
      standardProps.forEach((p, i) => {
        tmp.position.set(p.col - half, p.y + p.size / 2, p.row - half);
        tmp.scale.set(p.size, p.size, p.size);
        tmp.updateMatrix();
        propRef.current.setMatrixAt(i, tmp.matrix);
        propRef.current.setColorAt(i, col.set(p.color));
      });
      propRef.current.instanceMatrix.needsUpdate = true;
      if (propRef.current.instanceColor) propRef.current.instanceColor.needsUpdate = true;
    }
    // glowing props: similar but unlit material
    if (glowingPropRef.current && glowingPropRef.current.count >= glowingProps.length) {
      const col = new THREE.Color();
      glowingProps.forEach((p, i) => {
        tmp.position.set(p.col - half, p.y + p.size / 2, p.row - half);
        tmp.scale.set(p.size, p.size, p.size);
        tmp.updateMatrix();
        glowingPropRef.current.setMatrixAt(i, tmp.matrix);
        glowingPropRef.current.setColorAt(i, col.set(p.color));
      });
      glowingPropRef.current.instanceMatrix.needsUpdate = true;
      if (glowingPropRef.current.instanceColor) glowingPropRef.current.instanceColor.needsUpdate = true;
    }
    // iso-only props: colors set once here, transforms animated each frame
    if (isoPropRef.current && isoPropRef.current.count >= isoProps.length) {
      const col = new THREE.Color();
      isoProps.forEach((p, i) => isoPropRef.current.setColorAt(i, col.set(p.color)));
      if (isoPropRef.current.instanceColor) isoPropRef.current.instanceColor.needsUpdate = true;
    }
    // glowing iso props (lantern flames, window glows): same — fold animated per frame
    if (glowIsoPropRef.current && glowIsoPropRef.current.count >= glowIsoProps.length) {
      const col = new THREE.Color();
      glowIsoProps.forEach((p, i) => glowIsoPropRef.current.setColorAt(i, col.set(p.color)));
      if (glowIsoPropRef.current.instanceColor) glowIsoPropRef.current.instanceColor.needsUpdate = true;
    }
    lastGap.current = -1; // force a cell + iso-prop rewrite on next frame
  }, [darkCells, lightCells, standardProps, glowingProps, isoProps, glowIsoProps, half, tmp]);

  useFrame((_, delta) => {
    const target = view === 'scan' ? 1 : 0;
    const next = THREE.MathUtils.damp(gap.current, target, SCAN_LAMBDA, delta);
    gap.current = Math.abs(next - target) < 0.0008 ? target : next;
    if (gap.current === lastGap.current) return; // only rewrite during the transition
    lastGap.current = gap.current;

    const footprint = 1 - GAP_3D * (1 - gap.current);
    const t = gap.current; // 0 scene → 1 scan, eased by the same damping
    writeCells(darkRef.current, darkCells, footprint, t);
    writeCells(lightRef.current, lightCells, footprint, t);
    writeIsoProps(isoPropRef.current, isoProps, t);
    writeIsoProps(glowIsoPropRef.current, glowIsoProps, t);
  });

  return (
    <group>
      {/* key by instance count so a count change (new URL) remounts the mesh
          cleanly instead of writing to a stale, wrong-sized instance buffer */}
      <instancedMesh
        key={`light-${lightCells.length}`}
        ref={lightRef}
        args={[geo, lightMat, lightCells.length]}
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        key={`dark-${darkCells.length}`}
        ref={darkRef}
        args={[geo, darkMat, darkCells.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      {standardProps.length > 0 && (
        <instancedMesh
          key={`prop-${standardProps.length}`}
          ref={propRef}
          args={[geo, propMat, standardProps.length]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      )}
      {glowingProps.length > 0 && (
        <instancedMesh
          key={`glowing-${glowingProps.length}`}
          ref={glowingPropRef}
          args={[geo, glowingMat, glowingProps.length]}
          frustumCulled={false}
        />
      )}
      {/* finder-square gardens + grove trees: stand up in 3D, then smoothly fold
          down flat as the view flattens (scaled to ~0 at full scan), so the island
          lies flat and the QR keeps decoding from straight down */}
      {isoProps.length > 0 && (
        <instancedMesh
          key={`isoprop-${isoProps.length}`}
          ref={isoPropRef}
          args={[geo, propMat, isoProps.length]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      )}
      {/* glowing iso props (lantern flames, interior window glow): unlit material,
          and they fold away with the same scan transition so no bright voxel is
          left floating over the modules when reading from straight down */}
      {glowIsoProps.length > 0 && (
        <instancedMesh
          key={`glowiso-${glowIsoProps.length}`}
          ref={glowIsoPropRef}
          args={[geo, glowingMat, glowIsoProps.length]}
          frustumCulled={false}
        />
      )}

      {/* pedestal — the sea block beneath */}
      <mesh position={[0, -1.3, 0]} receiveShadow>
        <boxGeometry args={[matrix.size + 1.2, 2.6, matrix.size + 1.2]} />
        <meshStandardMaterial color={theme.groundColor} roughness={0.9} />
      </mesh>

      {/* Dynamic Point Lights for night time */}
      {isNight && view === 'scene' &&
        lightSources.map((p, i) => (
          <pointLight
            key={`light-${i}`}
            position={[p.col - half, p.y + p.size / 2, p.row - half]}
            color={p.light!.color}
            intensity={p.light!.intensity}
            distance={p.light!.distance}
            decay={2}
          />
        ))}
    </group>
  );
}
