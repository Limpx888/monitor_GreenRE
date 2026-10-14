import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ZONES } from '../data/zones';
import { FLOORS } from '../data/floors';

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

/** Floors grouped by zone for tooltip display */
const ZONE_FLOORS = {};
FLOORS.forEach((f) => {
  if (!ZONE_FLOORS[f.zoneId]) ZONE_FLOORS[f.zoneId] = [];
  ZONE_FLOORS[f.zoneId].push(f);
});

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
export default function TowerModel({ selectedZone, onSelect, onHover, anomalyFloor, anomalyZone, zonesData }) {
  const groupRef = useRef();
  const hoveredZoneRef = useRef(null);
  const navigate = useNavigate();
  const { scene } = useGLTF('/LightExchange_DigitalTwin.glb');

  // ⚠️ 动态数据合并逻辑 (Dynamic Data Merge Logic)
  // 将外部传入的实时数据 (zonesData) 与本地静态配置 (ZONE_META) 结合
  const dynamicZoneMeta = useMemo(() => {
    const meta = { ...ZONE_META };
    if (zonesData && Array.isArray(zonesData)) {
      zonesData.forEach((z) => {
        if (meta[z.id]) {
          meta[z.id] = { ...meta[z.id], ...z };
        }
      });
    }
    return meta;
  }, [zonesData]);

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

  // Apply hover highlight to zone meshes
  const applyHoverHighlight = useCallback(
    (hoverZoneId) => {
      model.traverse((obj) => {
        if (!obj.isMesh || !obj.material || !obj.userData.zoneId) return;
        if (obj.userData.zoneId === selectedZone) return; // don't touch selected
        const hovered = obj.userData.zoneId === hoverZoneId;
        if (hovered) {
          obj.material.emissive = new THREE.Color('#ffffff');
          obj.material.emissiveIntensity = 0.15;
          obj.material.opacity = 1;
        } else {
          // ⚠️ 使用 dynamicZoneMeta 获取实时状态，控制模型透明度
          const warn = dynamicZoneMeta[obj.userData.zoneId]?.status === 'warn';
          obj.material.opacity = warn ? 0.95 : 0.88;
          if (obj.material.emissive) {
            obj.material.emissive.set('#000000');
            obj.material.emissiveIntensity = 0;
          }
        }
      });
    },
    [model, selectedZone, dynamicZoneMeta], // ⚠️ 添加 dynamicZoneMeta 依赖
  );

  // Highlight selected zone meshes
  useEffect(() => {
    model.traverse((obj) => {
      if (!obj.isMesh || !obj.material || !obj.userData.zoneId) return;
      const active = obj.userData.zoneId === selectedZone;
      // ⚠️ 使用 dynamicZoneMeta
      const warn = dynamicZoneMeta[obj.userData.zoneId]?.status === 'warn';
      if (active) {
        obj.material.color.set('#0f766e');
        obj.material.opacity = 1;
        obj.material.emissive = new THREE.Color('#0d9488');
        obj.material.emissiveIntensity = 0.25;
      } else {
        obj.material.color.copy(obj.userData.baseColor);
        // Keep zone palette vivid for dashboard
        // ⚠️ 使用 dynamicZoneMeta
        const zColor = dynamicZoneMeta[obj.userData.zoneId]?.color;
        if (zColor) obj.material.color.set(zColor);
        obj.material.opacity = warn ? 0.95 : 0.88;
        if (obj.material.emissive) {
          obj.material.emissive.set('#000000');
          obj.material.emissiveIntensity = 0;
        }
      }
    });
  }, [model, selectedZone, dynamicZoneMeta]); // ⚠️ 添加 dynamicZoneMeta 依赖

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.05;
    }

    // 3D Model State Control: Anomaly Floor Flashing Red Warning (e.g. L14 -> Zone D Hotel)
    if (anomalyFloor || anomalyZone) {
      const isTarget = (zid) => {
        if (anomalyZone && zid === anomalyZone) return true;
        if (anomalyFloor === 'L14' && zid === 'zone-d') return true;
        return false;
      };

      const pulse = (Math.sin(state.clock.elapsedTime * 7.0) + 1.0) / 2.0; // 0 to 1 strobe
      model.traverse((obj) => {
        if (!obj.isMesh || !obj.material || !obj.userData.zoneId) return;
        if (isTarget(obj.userData.zoneId)) {
          obj.material.color.setRGB(0.95 + pulse * 0.05, 0.08 * (1 - pulse), 0.18 * (1 - pulse));
          if (!obj.material.emissive) obj.material.emissive = new THREE.Color();
          obj.material.emissive.setRGB(0.85 * pulse, 0.02, 0.06);
          obj.material.emissiveIntensity = 0.35 + pulse * 0.75;
          obj.material.opacity = 0.98;
        }
      });
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
        navigate(`/zone/${zoneId}`);
      }}
      onPointerMove={(e) => {
        const zoneId = findZoneId(e.object);
        if (zoneId) {
          document.body.style.cursor = 'pointer';
          if (hoveredZoneRef.current !== zoneId) {
            hoveredZoneRef.current = zoneId;
            applyHoverHighlight(zoneId);
          }
          // ⚠️ 使用 dynamicZoneMeta 以确保给 Dashboard 的悬浮窗发送实时能耗 (kW) 和警告状态
          const zone = dynamicZoneMeta[zoneId];
          const floors = ZONE_FLOORS[zoneId] || [];
          onHover?.({
            zoneId,
            floorId: ZONE_TO_FLOOR[zoneId],
            name: zone?.name || '',
            floors: zone?.floors || '',
            energy: zone?.energy || '',     // 🚀 现在这里拿到的是 Dashboard 算好的动态电量了！
            status: zone?.status || 'ok',   // 🚀 动态的警告状态
            color: zone?.color || '#94a3b8',
            floorDetails: floors.map((f) => ({
              label: f.label,
              description: f.description,
            })),
            x: e.nativeEvent?.clientX ?? e.clientX ?? 0,
            y: e.nativeEvent?.clientY ?? e.clientY ?? 0,
          });
        }
      }}
      onPointerOver={(e) => {
        const zoneId = findZoneId(e.object);
        if (zoneId) document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
        hoveredZoneRef.current = null;
        applyHoverHighlight(null);
        onHover?.(null);
      }}
    >
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload('/LightExchange_DigitalTwin.glb');