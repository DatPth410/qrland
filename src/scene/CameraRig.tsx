import { useEffect, useMemo, useRef } from 'react';
import { CameraControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { useView } from '../state/useView';

const ISO_AZIMUTH = Math.PI / 4; // 45° corner-on
const ISO_POLAR = 0.92; // ~53° elevation
const TOP_POLAR = 0.0001; // straight down (not exactly 0 → avoids up-vector flip)

/** Frames the field and animates between isometric (scene) and top-down (flat). */
export function CameraRig({ fitRadius }: { fitRadius: number }) {
  const controls = useThree((s) => s.controls) as CameraControlsImpl | null;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const view = useView((s) => s.view);

  const center = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const didInit = useRef(false);
  const interacting = useRef(false);
  const lastInteract = useRef(0);

  useEffect(() => {
    if (!controls) return;
    controls.smoothTime = 0.55;
    controls.draggingSmoothTime = 0.18;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = 1.05;
    controls.minZoom = 0.5;
    controls.maxZoom = 6;
    controls.mouseButtons.wheel = CameraControlsImpl.ACTION.ZOOM;
    controls.mouseButtons.right = CameraControlsImpl.ACTION.TRUCK;
    const onStart = () => {
      interacting.current = true;
    };
    const onEnd = () => {
      interacting.current = false;
      lastInteract.current = performance.now();
    };
    controls.addEventListener('controlstart', onStart);
    controls.addEventListener('controlend', onEnd);
    return () => {
      controls.removeEventListener('controlstart', onStart);
      controls.removeEventListener('controlend', onEnd);
    };
  }, [controls]);

  useEffect(() => {
    if (!controls) return;
    const animate = didInit.current;
    didInit.current = true;
    const targetAz0 = view === 'scan' ? 0 : ISO_AZIMUTH;
    const currentAz = controls.azimuthAngle;
    
    let diff = (targetAz0 - currentAz) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    
    const az = currentAz + diff;
    const pol = view === 'scan' ? TOP_POLAR : ISO_POLAR;
    // scan view shows the axis-aligned QR square, which fits far tighter than the
    // circumscribed sphere (fitRadius), so the code fills the frame instead of
    // floating in a sea of margin; scene view keeps the full radius so the
    // 45°-rotated island isn't clipped. Portrait viewports zoom in a touch more
    // to spend the extra vertical room on the island.
    const aspect = size.width / size.height;
    let radius = fitRadius;
    if (view === 'scan') {
      radius = fitRadius * 0.76; // QR fills the frame, keeping ~9% margin so the
      // quiet zone never touches the edge (stays scannable)
    } else if (aspect < 1) {
      radius = fitRadius * 0.92; // portrait: spend the spare vertical room on the island
    }
    controls.setOrbitPoint(0, 0, 0);
    controls.fitToSphere(new THREE.Sphere(center, radius), false);
    controls.rotateTo(az, pol, animate);
    if (!animate) {
      controls.update(0);
      gl.render(scene, camera);
    }
    invalidate();
  }, [controls, view, size.width, size.height, fitRadius, center, gl, scene, camera, invalidate]);

  // gentle idle turntable in scene view
  useFrame((_, delta) => {
    if (!controls || view !== 'scene') return;
    if (!interacting.current && performance.now() - lastInteract.current > 2500) {
      controls.rotate(delta * 0.045, 0, false);
    }
  });

  return <CameraControls makeDefault />;
}
