import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import TowerModel from './TowerModel';

export default function BuildingScene({ selectedZone, onSelect }) {
  return (
    <div className="w-full h-full absolute inset-0">
      <Canvas
        orthographic
        camera={{ position: [20, 20, 20], zoom: 45, near: 0.1, far: 1000 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#f8fafc']} />
        <ambientLight intensity={1.2} />
        <directionalLight
          position={[15, 25, 15]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <pointLight position={[-10, 10, -10]} intensity={0.5} />
        
        <TowerModel selectedZone={selectedZone} onSelect={onSelect} />
        
        <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
        <OrbitControls enableZoom enablePan minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
}
