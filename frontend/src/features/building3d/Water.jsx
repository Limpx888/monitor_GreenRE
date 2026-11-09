import React, { useEffect, useMemo } from 'react';
import { MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { makeNoise } from './textures';

/**
 * Calm harbour water: blurred planar reflection of the lit towers, distorted
 * by a stretched noise map for gentle horizontal ripples. Deep teal tint.
 * Low tier uses a cheap glossy material (reflects the env map only).
 */
export default function Water({ detail = 'high' }) {
  const noise = useMemo(() => {
    const t = makeNoise(256, 3);
    t.repeat.set(6, 6);
    return t;
  }, []);
  useEffect(() => () => noise.dispose(), [noise]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[700, 700]} />
      {detail === 'high' ? (
        <MeshReflectorMaterial
          resolution={1024}
          blur={[40, 220]} /* taller than wide = vertical light streaks, like real water */
          mixBlur={0.55}
          /* drei multiplies the reflection into the (dark) diffuse colour, so it needs a high gain */
          mixStrength={34}
          mixContrast={1.2}
          mirror={0}
          depthScale={0}
          distortionMap={noise}
          distortion={0.3}
          color="#1d282c"
          metalness={0.15}
          roughness={1}
          envMapIntensity={0.25}
        />
      ) : (
        <meshStandardMaterial color="#0d3036" metalness={0.85} roughness={0.22} envMapIntensity={1.1} normalScale={new THREE.Vector2(0.2, 0.2)} />
      )}
    </mesh>
  );
}
