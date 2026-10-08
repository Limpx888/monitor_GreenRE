import React, { Component, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import TowerModel from './TowerModel';

class WebGLBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err) {
    console.error('WebGL scene failed:', err);
    this.props.onFail?.();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export default function BuildingScene({ selectedZone, onSelect, onFail, onHover, anomalyFloor, anomalyZone }) {
  return (
    <WebGLBoundary onFail={onFail}>
      <div
        className="webgl-scene"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      >
        <Canvas
          camera={{ position: [10, 6.5, 10], fov: 40, near: 0.1, far: 500 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          style={{ width: '100%', height: '100%', display: 'block', background: 'transparent' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <ambientLight intensity={1.15} />
          <directionalLight position={[12, 18, 8]} intensity={1.7} castShadow />
          <directionalLight position={[-8, 6, -6]} intensity={0.4} color="#93c5fd" />
          <hemisphereLight intensity={0.35} groundColor="#e2e8f0" />

          <Suspense fallback={null}>
            <TowerModel
              selectedZone={selectedZone}
              onSelect={onSelect}
              onHover={onHover}
              anomalyFloor={anomalyFloor}
              anomalyZone={anomalyZone}
            />
            <ContactShadows
              position={[0, -2.6, 0]}
              opacity={0.35}
              scale={16}
              blur={2.4}
              far={8}
            />
          </Suspense>

          <OrbitControls
            makeDefault
            enableDamping
            target={[0, 1.4, 0]}
            minDistance={4}
            maxDistance={28}
            minPolarAngle={0.15}
            maxPolarAngle={Math.PI / 2.05}
          />
        </Canvas>
      </div>
    </WebGLBoundary>
  );
}
