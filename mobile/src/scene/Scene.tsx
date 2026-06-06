import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useView } from '../state/useView';
import { QRField } from './QRField';
import { CameraRig } from './CameraRig';
import type { QRMatrix } from '../qr/generate';
import type { QRTheme } from './theme';

/** Soft shadow maps. WebGPU's shadow pass on Three.js silently breaks the render
 *  on this version; keep off until a future r-revision restores it. */
const SHADOWS = false;

/** Sun + ambient that flatten toward even lighting in scan view (clean decode). */
function Lighting({
  sun,
  ground,
  ambient,
  lightDist,
  fitRadius,
}: {
  sun: string;
  ground: string;
  ambient: number;
  lightDist: number;
  fitRadius: number;
}) {
  const view = useView((s) => s.view);
  const dir = useRef<THREE.DirectionalLight>(null!);
  const amb = useRef<THREE.AmbientLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const k = useRef(view === 'scan' ? 1 : 0);

  // Scan view flattens to near-shadowless lighting that PRESERVES material
  // contrast (so dark/light modules stay readable) — total intensity stays ~1.
  useFrame((_, delta) => {
    const target = view === 'scan' ? 1 : 0;
    k.current = THREE.MathUtils.damp(k.current, target, 5, delta);
    const t = k.current;
    if (dir.current) dir.current.intensity = THREE.MathUtils.lerp(1.3, 0.0, t);
    if (amb.current) amb.current.intensity = THREE.MathUtils.lerp(ambient, 0.98, t);
    if (hemi.current) hemi.current.intensity = THREE.MathUtils.lerp(0.35, 0.04, t);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[sun, ground, 0.35]} />
      <ambientLight ref={amb} intensity={ambient} />
      <directionalLight
        ref={dir}
        color={sun}
        intensity={1.3}
        position={[-lightDist * 0.5, lightDist * 1.2, lightDist * 0.65]}
        castShadow={SHADOWS}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={lightDist * 4}
        shadow-camera-left={-fitRadius}
        shadow-camera-right={fitRadius}
        shadow-camera-top={fitRadius}
        shadow-camera-bottom={-fitRadius}
        shadow-bias={-0.0004}
      />
    </>
  );
}

/** The full QR world: themed background, light rig, the voxel field, and the camera. */
export function Scene({ matrix, theme }: { matrix: QRMatrix; theme: QRTheme }) {
  const fitRadius = matrix.size * 0.72; // iso bounding sphere
  const qrHalf = matrix.size * 0.5; // full QR half-width (for the scan-view fit)
  const lightDist = matrix.size;

  return (
    <>
      <color attach="background" args={[theme.background]} />
      {/* Fog disabled on mobile: ACES+sRGB pushes the scene toward the fog
       *  colour quickly on phones, washing the saturation out. The background
       *  gradient alone reads fine in the smaller frame. */}
      <Lighting
        sun={theme.sunColor ?? '#ffffff'}
        ground={theme.groundColor}
        ambient={theme.ambient ?? 0.5}
        lightDist={lightDist}
        fitRadius={fitRadius}
      />
      <QRField matrix={matrix} theme={theme} />
      <CameraRig qrHalf={qrHalf} fitRadius={fitRadius} />
    </>
  );
}
