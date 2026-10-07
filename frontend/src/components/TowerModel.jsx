import React, { useState, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

function BuildingZone({ id, name, position, args, color, selectedZone, onSelect, metrics }) {
  const [hovered, setHovered] = useState(false);
  const isSelected = selectedZone === id;

  const geometry = useMemo(() => new THREE.BoxGeometry(args[0], args[1], args[2]), [args[0], args[1], args[2]]);

  return (
    <group position={position}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); onSelect(id); }}
      >
        <primitive object={geometry} attach="geometry" />
        <meshPhysicalMaterial
          color={isSelected ? '#0f766e' : hovered ? '#14b8a6' : color}
          transparent
          opacity={hovered || isSelected ? 0.9 : 0.8}
          roughness={0.1}
          metalness={0.1}
          clearcoat={1.0}
        />
        
        {/* Wireframe overlay to look more like a blueprint/tech model */}
        <lineSegments>
          <edgesGeometry args={[geometry]} />
          <lineBasicMaterial color={isSelected ? '#ffffff' : '#94a3b8'} opacity={isSelected ? 0.5 : 0.2} transparent />
        </lineSegments>
      </mesh>

      {/* Floating 3D HTML Label */}
      <Html position={[args[0] / 2 + 1.2, 0, 0]} distanceFactor={15} center zIndexRange={[100, 0]}>
        <div style={{ display: hovered || isSelected ? 'block' : 'none' }}>
          <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-teal-100/50 w-56 text-xs font-sans pointer-events-none transition-all duration-300 transform scale-100 origin-left">
            <div className="flex justify-between items-center mb-2">
              <span className="font-extrabold text-slate-800 text-sm">{name}</span>
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-wider ${
                metrics.status === 'warning' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-teal-50 text-teal-600 border border-teal-200'
              }`}>
                {metrics.status.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between items-end">
               <span className="text-slate-500 font-medium">Energy Load</span>
               <span className="font-black text-slate-800 text-lg">{metrics.energy}</span>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}

export default function TowerModel({ selectedZone, onSelect }) {
  return (
    <group position={[0, -2, 0]}>
      <BuildingZone
        id="zone-a"
        name="M&E (B2-LG)"
        position={[0, 0.4, 0]}
        args={[4.5, 0.8, 3.5]}
        color="#f8fafc"
        selectedZone={selectedZone}
        onSelect={onSelect}
        metrics={{ energy: '92 kWh', status: 'normal' }}
      />
      <BuildingZone
        id="zone-b"
        name="Podium (GF-L3)"
        position={[0, 1.5, 0]}
        args={[4.2, 1.2, 3.2]}
        color="#f1f5f9"
        selectedZone={selectedZone}
        onSelect={onSelect}
        metrics={{ energy: '185 kWh', status: 'normal' }}
      />
      <BuildingZone
        id="zone-c"
        name="Offices (L4-L12)"
        position={[0, 3.2, 0]}
        args={[3.2, 2.0, 2.4]}
        color="#ccfbf1"
        selectedZone={selectedZone}
        onSelect={onSelect}
        metrics={{ energy: '310 kWh', status: 'warning' }}
      />
      <BuildingZone
        id="zone-d"
        name="Hyatt (L14-L28)"
        position={[0, 5.8, 0]}
        args={[3.0, 3.0, 2.2]}
        color="#f8fafc"
        selectedZone={selectedZone}
        onSelect={onSelect}
        metrics={{ energy: '420 kWh', status: 'normal' }}
      />
      <BuildingZone
        id="zone-e"
        name="Amenities (L29-L31)"
        position={[0, 7.6, 0]}
        args={[2.8, 0.6, 2.0]}
        color="#f1f5f9"
        selectedZone={selectedZone}
        onSelect={onSelect}
        metrics={{ energy: '140 kWh', status: 'normal' }}
      />
    </group>
  );
}
