import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** Scroll story shots: hero, problem, how it works, features, live demo. */
export const SHOTS = [
  // Hero: wide view from over the water, like the reference render (towers sit right of centre)
  { p: [-11, 7.2, 58], t: [-4.5, 6.2, -3] },
  // Problem: low, from the right across the harbour
  { p: [31, 3.6, 27], t: [3, 6, -3] },
  // How it works: aerial over the podium and promenade
  { p: [12, 34, 36], t: [-2, 2, -3] },
  // Features: close on the left towers
  { p: [-27, 11, 19], t: [10, 8.5, -4] },
  // Live demo: pulled back, towers right of the panel
  { p: [1, 8.5, 64], t: [-10, 7, -3] },
];
const INTRO = { p: new THREE.Vector3(-34, 30, 78), t: new THREE.Vector3(2, 4, -4) };
const ENTER = { p: new THREE.Vector3(4.4, 9.5, 2.2), t: new THREE.Vector3(4.4, 9.5, -6) };

const posCurve = new THREE.CatmullRomCurve3(SHOTS.map((s) => new THREE.Vector3(...s.p)), false, 'centripetal');
const tgtCurve = new THREE.CatmullRomCurve3(SHOTS.map((s) => new THREE.Vector3(...s.t)), false, 'centripetal');
const easeOutCubic = (x) => 1 - (1 - x) ** 3;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/**
 * Drives the camera from refs (no React re-renders per frame):
 *   progressRef.current  0..1 scroll progress
 *   phaseRef.current     'intro' | 'scroll' | 'enter'
 */
export default function CameraRig({ progressRef, phaseRef, reducedMotion = false, introDuration = 2.8 }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(...SHOTS[0].t));
  const clock = useRef({ start: null, enterStart: null });
  const desiredP = useRef(new THREE.Vector3());
  const desiredT = useRef(new THREE.Vector3());
  const initialised = useRef(false);

  useFrame((state, dt) => {
    const now = state.clock.elapsedTime;
    if (clock.current.start === null) clock.current.start = now;
    const phase = phaseRef?.current ?? 'scroll';
    const k = reducedMotion ? 0 : THREE.MathUtils.clamp(progressRef?.current ?? 0, 0, 1);

    posCurve.getPoint(k, desiredP.current);
    tgtCurve.getPoint(k, desiredT.current);

    // Portrait screens: pull the camera back so the composition still fits horizontally
    const pullBack = Math.max(1, 0.85 / camera.aspect);
    if (pullBack > 1) desiredP.current.sub(desiredT.current).multiplyScalar(Math.min(pullBack, 1.9)).add(desiredT.current);

    if (!reducedMotion) {
      // Idle drift and subtle pointer parallax keep the scene alive
      desiredP.current.x += Math.sin(now * 0.12) * 0.8 + state.pointer.x * 0.9;
      desiredP.current.y += Math.sin(now * 0.09) * 0.25 + state.pointer.y * 0.4;
    }

    if (!initialised.current) {
      initialised.current = true;
      if (reducedMotion || phase !== 'intro') {
        camera.position.copy(desiredP.current);
        target.current.copy(desiredT.current);
      } else {
        camera.position.copy(INTRO.p);
        target.current.copy(INTRO.t);
      }
    }

    if (phase === 'intro' && !reducedMotion) {
      const x = easeOutCubic(Math.min((now - clock.current.start) / introDuration, 1));
      camera.position.lerpVectors(INTRO.p, desiredP.current, x);
      target.current.lerpVectors(INTRO.t, desiredT.current, x);
      if (x >= 1 && phaseRef) phaseRef.current = 'scroll';
    } else if (phase === 'enter' && !reducedMotion) {
      if (clock.current.enterStart === null) {
        clock.current.enterStart = now;
        clock.current.fromP = camera.position.clone();
        clock.current.fromT = target.current.clone();
      }
      const x = easeInOut(Math.min((now - clock.current.enterStart) / 1.1, 1));
      camera.position.lerpVectors(clock.current.fromP, ENTER.p, x);
      target.current.lerpVectors(clock.current.fromT, ENTER.t, x);
    } else {
      const damp = 1 - Math.exp(-dt * 2.6);
      camera.position.lerp(desiredP.current, damp);
      target.current.lerp(desiredT.current, damp);
    }
    camera.lookAt(target.current);
  });

  return null;
}
