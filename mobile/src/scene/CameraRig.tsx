import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useView } from '../state/useView';

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const ISO_EL = 34 * DEG; // elevation above the horizon in the isometric scene view
const TOP_EL = 89.5 * DEG; // ~straight down for the flat scan view (not exactly 90° → no up-vector flip)
const ISO_AZ = 45 * DEG; // corner-on
const FOV = 22; // narrow → near-orthographic, so the flat view stays a clean, scannable QR
const SCENE_MARGIN = 0.92; // tight fit on the bounding sphere for the isometric look
const SCAN_MARGIN = 1.08; // a hair of breathing room around the full QR square when scanning

/**
 * Frames the field and eases the camera between the isometric ("scene") and
 * top-down ("scan") poses as the view toggles — the mobile stand-in for the web
 * app's drei CameraControls. A gentle idle turntable spins the scene view.
 *
 * `qrHalf` is half the QR's full side length (in voxel units, including the
 * quiet zone). Scan distance is computed so the whole QR fits the SHORTER
 * canvas dimension — usually width on portrait phones — so a real scanner can
 * frame all three finder squares.
 */
export function CameraRig({ qrHalf, fitRadius }: { qrHalf: number; fitRadius: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const view = useView((s) => s.view);
  const progress = useRef(view === 'scan' ? 1 : 0);
  const spin = useRef(0);

  useEffect(() => {
    camera.near = 1;
    camera.far = 6000;
    if (camera.isPerspectiveCamera) {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  useFrame((_, delta) => {
    const target = view === 'scan' ? 1 : 0;
    progress.current = THREE.MathUtils.damp(progress.current, target, 4, delta);
    if (view === 'scene') {
      spin.current += delta * 0.05; // slow turntable, scene view only
      // Once the world has fully stood up, wrap the accrued turntable angle back
      // into a single turn. Azimuth is periodic so this is seamless here, and it
      // caps the next flatten/stand-up at ~one rotation no matter how long the
      // idle spin ran — otherwise it unwinds every accumulated turn at once.
      if (progress.current < 1e-3) spin.current %= TWO_PI;
    }

    const t = progress.current;
    const el = THREE.MathUtils.lerp(ISO_EL, TOP_EL, t);
    const az = THREE.MathUtils.lerp(ISO_AZ + spin.current, 0, t); // unwind to axis-aligned when flat

    // Scene distance: tight fit on the iso bounding sphere.
    const sceneDist = (fitRadius / Math.sin((FOV / 2) * DEG)) * SCENE_MARGIN;
    // Scan distance: fit the FULL QR square in the narrower screen dimension.
    // three.js's PerspectiveCamera.fov is vertical; horizontal FOV scales by aspect.
    const aspect = size.width / Math.max(1, size.height);
    const halfVFov = (FOV / 2) * DEG;
    const halfHFov = Math.atan(Math.tan(halfVFov) * aspect);
    // distance needed to fit qrHalf into the smaller of width / height
    const scanDist = Math.max(qrHalf / Math.tan(halfHFov), qrHalf / Math.tan(halfVFov)) * SCAN_MARGIN;
    const dist = THREE.MathUtils.lerp(sceneDist, scanDist, t);
    const ce = Math.cos(el);

    camera.position.set(dist * ce * Math.sin(az), dist * Math.sin(el), dist * ce * Math.cos(az));
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  });

  return null;
}
