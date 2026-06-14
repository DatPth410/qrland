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

  const sphere = useMemo(
    () => new THREE.Sphere(new THREE.Vector3(0, 0, 0), fitRadius),
    [fitRadius],
  );
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
    controls.setOrbitPoint(0, 0, 0);
    controls.fitToSphere(sphere, false);
    controls.rotateTo(az, pol, animate);
    if (!animate) {
      controls.update(0);
      gl.render(scene, camera);
    }
    invalidate();
  }, [controls, view, size.width, size.height, sphere, gl, scene, camera, invalidate]);

  // gentle idle turntable in scene view
  useFrame((_, delta) => {
    if (!controls || view !== 'scene') return;
    if (!interacting.current && performance.now() - lastInteract.current > 2500) {
      controls.rotate(delta * 0.045, 0, false);
    }
  });

  return <CameraControls makeDefault />;
}
