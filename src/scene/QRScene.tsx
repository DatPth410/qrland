import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useView } from '../state/useView';
import { QRField } from './QRField';
import { CameraRig } from './CameraRig';
import type { QRMatrix } from '../qr/generate';
import type { QRTheme } from './theme';

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
  // contrast (sand light, sea dark) — total intensity stays ~1 so nothing clips.
  useFrame((_, delta) => {
    const target = view === 'scan' ? 1 : 0;
    k.current = THREE.MathUtils.damp(k.current, target, 5, delta);
    const t = k.current;
    if (dir.current) dir.current.intensity = THREE.MathUtils.lerp(1.3, 0.12, t);
    if (amb.current) amb.current.intensity = THREE.MathUtils.lerp(ambient, 0.82, t);
    if (hemi.current) hemi.current.intensity = THREE.MathUtils.lerp(0.35, 0.05, t);
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
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={lightDist * 4}
        shadow-camera-left={-fitRadius}
        shadow-camera-right={fitRadius}
        shadow-camera-top={fitRadius}
        shadow-camera-bottom={-fitRadius}
        shadow-bias={-0.0002}
      />
    </>
  );
}

export function QRScene({ matrix, theme }: { matrix: QRMatrix; theme: QRTheme }) {
  const toggle = useView((s) => s.toggle);
  const fitRadius = matrix.size * 0.72;
  const down = useRef<{ x: number; y: number; t: number } | null>(null);

  // tap-to-toggle that doesn't fight camera drags
  const onPointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved < 6 && performance.now() - d.t < 300) toggle();
  };

  const sun = theme.sunColor ?? '#ffffff';
  const lightDist = matrix.size;
  const sky = `linear-gradient(180deg, ${theme.background} 0%, ${
    theme.background2 ?? theme.background
  } 100%)`;

  return (
    <div
      style={{ position: 'absolute', inset: 0, background: sky }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (down.current = null)}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
        camera={{ fov: 16, near: 0.1, far: 500, position: [lightDist, lightDist, lightDist] }}
      >
        <Lighting
          sun={sun}
          ground={theme.groundColor}
          ambient={theme.ambient ?? 0.5}
          lightDist={lightDist}
          fitRadius={fitRadius}
        />

        <QRField matrix={matrix} theme={theme} />
        <CameraRig fitRadius={fitRadius} />
      </Canvas>
    </div>
  );
}
