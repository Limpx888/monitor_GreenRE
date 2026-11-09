import React, { Component, Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import LightCityScene from './LightCityScene';
import CameraRig from './CameraRig';

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) {
    console.error('[3D] scene failed, falling back to poster:', err);
    this.props.onFail?.();
  }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Fires once after the first rendered frame, so the poster can fade out. */
function ReadySignal({ onReady }) {
  const done = useRef(false);
  useFrame(() => {
    if (!done.current) {
      done.current = true;
      requestAnimationFrame(() => onReady?.());
    }
  });
  return null;
}

/** `?fps` in the URL shows a frame-rate readout (1 s rolling average). */
function FpsMeter() {
  const acc = useRef({ frames: 0, t: 0 });
  useFrame((_, dt) => {
    acc.current.frames += 1;
    acc.current.t += dt;
    if (acc.current.t >= 1) {
      const el = document.getElementById('gg-fps');
      if (el) el.textContent = `${Math.round(acc.current.frames / acc.current.t)} FPS`;
      acc.current = { frames: 0, t: 0 };
    }
  });
  return null;
}

const SHOW_FPS = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('fps');

/**
 * Landing-page canvas (lazy-loaded chunk: three, drei, postprocessing).
 * Quality adapts at runtime: if FPS drops, PerformanceMonitor lowers DPR and
 * switches off AO and planar reflections.
 */
export default function LightCityCanvas({ tier = 'high', progressRef, phaseRef, reducedMotion, onReady, onFail }) {
  const [degraded, setDegraded] = useState(false);
  const [dpr, setDpr] = useState(tier === 'high' ? Math.min(window.devicePixelRatio, 2) : 1);

  return (
    <SceneBoundary onFail={onFail}>
      <Canvas
        flat
        shadows
        dpr={dpr}
        camera={{ fov: 34, near: 0.5, far: 1200, position: [-34, 30, 78] }}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0 }}
      >
        <PerformanceMonitor
          onDecline={() => { setDegraded(true); setDpr(1); }}
          onIncline={() => setDpr(tier === 'high' ? Math.min(window.devicePixelRatio, 2) : 1)}
          flipflops={3}
        />
        <Suspense fallback={null}>
          <LightCityScene tier={tier} degraded={degraded} />
          <CameraRig progressRef={progressRef} phaseRef={phaseRef} reducedMotion={reducedMotion} />
          <ReadySignal onReady={onReady} />
          {SHOW_FPS && <FpsMeter />}
        </Suspense>
      </Canvas>
      {SHOW_FPS && (
        <div id="gg-fps" className="fixed bottom-3 left-3 z-[80] rounded-md bg-black/70 px-2.5 py-1 font-mono text-xs font-bold text-brand-300">
          … FPS
        </div>
      )}
    </SceneBoundary>
  );
}
