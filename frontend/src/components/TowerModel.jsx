import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ZONES } from '../data/zones';

const MESH_TO_ZONE = {
  Zone_A_ME_Plant: 'zone-a',
  Zone_B_Podium: 'zone-b',
  Zone_C_Offices: 'zone-c',
  Zone_D_Hyatt_Hotel: 'zone-d',
  Zone_E_Amenities: 'zone-e',
};

/** Primary floor page for each GreenRE zone mesh click */
const ZONE_TO_FLOOR = {
  'zone-a': 'lg-lm',
  'zone-b': 'gf',
  'zone-c': 'l4-12',
  'zone-d': 'l14-28',
  'zone-e': 'l30-31',
};

const ZONE_META = Object.fromEntries(ZONES.map((z) => [z.id, z]));

function findZoneId(object) {
  let cur = object;
  while (cur) {
    if (MESH_TO_ZONE[cur.name]) return MESH_TO_ZONE[cur.name];
    cur = cur.parent;
  }
  return null;
}

/**
 * Blender Light Exchange digital twin (LightExchange_DigitalTwin.glb)
 */
export default function TowerModel({ selectedZone, onSelect }) {
  const groupRef = useRef();
  const navigate = useNavigate();
  const { scene } = useGLTF('/LightExchange_DigitalTwin.glb');

  const model = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.material) {
        obj.material = obj.material.clone();
        obj.userData.baseColor = obj.material.color?.clone?.() || new THREE.Color('#94a3b8');
        obj.userData.baseOpacity = obj.material.opacity ?? 1;
        // Keep glass readable but not invisible
        if (obj.name.includes('Glass') || obj.name.startsWith('Mullion_')) {
          obj.material.transparent = true;
          obj.material.opacity = Math.min(obj.material.opacity ?? 1, 0.35);
          obj.material.depthWrite = false;
        }
      }
      const zoneId = MESH_TO_ZONE[obj.name];
      if (zoneId) {
        obj.userData.zoneId = zoneId;
        obj.material.transparent = true;
        obj.material.opacity = 0.92;
      }
    });
    return root;
  }, [scene]);

  // Fit Blender metres (~130 tall) into dashboard view
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 7.5 / maxDim;
    return {
      scale,
      position: [-center.x * scale, -center.y * scale + 1.2, -center.z * scale],
      height: size.y * scale,
    };
  }, [model]);

  // Highlight selected zone meshes
  useEffect(() => {
    model.traverse((obj) => {
      if (!obj.isMesh || !obj.material || !obj.userData.zoneId) return;
      const active = obj.userData.zoneId === selectedZone;
      const warn = ZONE_META[obj.userData.zoneId]?.status === 'warn';
      if (active) {
        obj.material.color.set('#0f766e');
        obj.material.opacity = 1;
        obj.material.emissive = new THREE.Color('#0d9488');
        obj.material.emissiveIntensity = 0.25;
      } else {
        obj.material.color.copy(obj.userData.baseColor);
        // Keep zone palette vivid for dashboard
        const zColor = ZONE_META[obj.userData.zoneId]?.color;
        if (zColor) obj.material.color.set(zColor);
        obj.material.opacity = warn ? 0.95 : 0.88;
        if (obj.material.emissive) {
          obj.material.emissive.set('#000000');
          obj.material.emissiveIntensity = 0;
        }
      }
    });
  }, [model, selectedZone]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.05;
    }
  });

  return (
    <group
      ref={groupRef}
      scale={fit.scale}
      position={fit.position}
      onClick={(e) => {
        e.stopPropagation();
        const zoneId = findZoneId(e.object);
        if (!zoneId) return;
        onSelect(zoneId);
        const floorId = ZONE_TO_FLOOR[zoneId];
        if (floorId) navigate(`/floor/${floorId}`);
      }}
      onPointerOver={(e) => {
        const zoneId = findZoneId(e.object);
        if (zoneId) document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload('/LightExchange_DigitalTwin.glb');
