// Based on the react-native-webgpu + R3F harness from the Expo `with-webgpu` template:
// https://github.com/wcandillon/react-native-webgpu/blob/main/apps/example/src/ThreeJS/components/FiberCanvas.tsx
import * as THREE from "three/webgpu";
import React, { useEffect, useRef } from "react";
import type { ReconcilerRoot, RootState } from "@react-three/fiber";
import {
  extend,
  createRoot,
  unmountComponentAtNode,
  events,
} from "@react-three/fiber";
import type { ViewProps } from "react-native";
import { PixelRatio } from "react-native";
import { Canvas, type CanvasRef } from "react-native-webgpu";

import { makeWebGPURenderer, ReactNativeCanvas } from "@/lib/make-webgpu-renderer";

interface FiberCanvasProps {
  children: React.ReactNode;
  style?: ViewProps["style"];
  camera?: THREE.PerspectiveCamera;
  scene?: THREE.Scene;
}

export const FiberCanvas = ({
  children,
  style,
  scene,
  camera,
}: FiberCanvasProps) => {
  const root = useRef<ReconcilerRoot<OffscreenCanvas>>(null!);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  React.useMemo(() => extend(THREE), []);
  const canvasRef = useRef<CanvasRef>(null);

  // Build the WebGPU renderer + R3F root ONCE. On later renders (new world / new
  // URL) we only push the updated element tree, so the GPU renderer is reused and
  // R3F just reconciles the scene graph. View toggles don't re-render this at all —
  // the in-scene useFrame hooks read the toggle straight from the store.
  useEffect(() => {
    if (!root.current) {
      const context = canvasRef.current!.getContext("webgpu")!;
      const renderer = makeWebGPURenderer(context);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const canvas = new ReactNativeCanvas(context.canvas) as HTMLCanvasElement;
      canvas.width = canvas.clientWidth * PixelRatio.get();
      canvas.height = canvas.clientHeight * PixelRatio.get();
      canvasEl.current = canvas;
      const size = {
        top: 0,
        left: 0,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      };

      root.current = createRoot(canvas);
      root.current.configure({
        size,
        events,
        scene,
        camera,
        gl: renderer,
        frameloop: "always",
        dpr: 1, //PixelRatio.get(),
        onCreated: async (state: RootState) => {
          // R3F types state.gl as WebGLRenderer, but on this harness it's a WebGPURenderer.
          const gl = state.gl as unknown as THREE.WebGPURenderer & {
            outputColorSpace?: string;
            toneMapping?: number;
            toneMappingExposure?: number;
          };
          await gl.init();
          // Pin sRGB output + ACES Filmic tonemap. The themes' light rig (ambient
          // 0.6 + hemi 0.35 + directional 1.3) is the web app's recipe; without
          // tonemapping that pushes WebGPU's linear output past white and the
          // colour clips to cream. ACES rolls bright values back into range while
          // preserving saturation; a touch under 1.0 exposure brings out the
          // canopy/trunk details.
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          // qrland's worlds lean on soft shadows for depth — the harness leaves
          // them off, so enable them here.
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          const renderFrame = gl.render.bind(gl);
          gl.render = (s: THREE.Scene, c: THREE.Camera) => {
            renderFrame(s, c);
            context?.present();
          };
        },
      });
    }
    root.current.render(children);
  }, [children, scene, camera]);

  // Tear down the R3F root only when the canvas truly unmounts.
  useEffect(
    () => () => {
      if (canvasEl.current) unmountComponentAtNode(canvasEl.current);
    },
    [],
  );

  return <Canvas ref={canvasRef} style={style} />;
};
