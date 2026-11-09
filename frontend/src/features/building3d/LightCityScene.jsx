import React from 'react';
import { Environment, Lightformer } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import Sky, { DUSK, SUN_DIR } from './Sky';
import Landscape from './Landscape';
import Water from './Water';
import { Podium, Tower, TOWERS, useTrimMaterials } from './Towers';

/** Lighting rig for a dusk scene: low warm sun, teal sky fill, warm bounce. */
function Lights({ shadowSize }) {
  const sun = SUN_DIR.clone().multiplyScalar(80);
  return (
    <>
      <hemisphereLight args={['#86b9b2', '#18262a', 0.55]} />
      <ambientLight intensity={0.12} />
      <directionalLight
        position={[sun.x, Math.max(sun.y, 10), sun.z]}
        color="#ffb489"
        intensity={1.6}
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-34}
        shadow-camera-right={30}
        shadow-camera-top={24}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />
      {/* Cool rim from the sky behind the towers */}
      <directionalLight position={[-30, 25, -40]} color="#6fb7b0" intensity={0.35} />
    </>
  );
}

/**
 * The waterfront development, modelled on the reference render, in GoGreen's
 * teal/emerald dusk palette. `children` lets callers add interaction layers or
 * camera rigs.
 */
export default function LightCityScene({ tier = 'high', degraded = false, towerProps, children }) {
  const trim = useTrimMaterials();
  const high = tier === 'high' && !degraded;

  return (
    <>
      <color attach="background" args={[DUSK.below]} />
      <fogExp2 attach="fog" args={[DUSK.fog, 0.0048]} />

      {/* Environment map rendered from our own sky dome + soft light cards: glass reflects the dusk */}
      <Environment resolution={high ? 256 : 128} frames={1}>
        <Sky />
        <Lightformer form="rect" intensity={2.2} color="#ffbe94" position={[60, 4, -40]} scale={[60, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.8} color="#7fd3c0" position={[-40, 30, 20]} scale={[40, 20, 1]} target={[0, 0, 0]} />
      </Environment>

      <Sky />
      <Lights shadowSize={high ? 2048 : 1024} />

      <Landscape detail={high ? 'high' : 'low'} />
      <Podium trim={trim} />
      {TOWERS.map((t) => (
        <Tower key={t.id} tower={t} trim={trim} {...(towerProps?.(t) || {})} />
      ))}
      <Water detail={high ? 'high' : 'low'} />

      {children}

      {/* Separate stacks: EffectComposer doesn't tolerate conditional (null) children */}
      {high ? (
        <EffectComposer multisampling={4} enableNormalPass={false}>
          <N8AO halfRes aoRadius={1.6} intensity={1.6} distanceFalloff={0.8} color="#06110e" />
          <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.18} intensity={0.85} radius={0.72} />
          <Vignette offset={0.28} darkness={0.55} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      ) : (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.18} intensity={0.6} radius={0.6} />
          <Vignette offset={0.28} darkness={0.55} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </>
  );
}
