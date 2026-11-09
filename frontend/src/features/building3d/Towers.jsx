import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { fitFacade, makeFacade, makeShopfront, rng } from './textures';

export const LAND_Y = 0.6;
const EMISSIVE = 1.45;

/** Tower layout modelled on the waterfront reference: two towers left, two right. */
export const TOWERS = [
  { id: 'tower-a', name: 'Residences A', position: [-6.4, -5.2], size: [2.6, 13.2, 2.6], style: 'grid', seed: 11, crown: 'stepped', lit: 0.8 },
  { id: 'tower-b', name: 'Residences B', position: [-2.8, -3.6], size: [3.5, 9.6, 2.8], style: 'bands', seed: 23, crown: 'cap', lit: 0.74 },
  { id: 'tower-c', name: 'Hotel Tower', position: [4.4, -4.2], size: [2.8, 16.2, 2.5], style: 'grid', seed: 37, crown: 'frame', lit: 0.86 },
  { id: 'tower-d', name: 'Office Tower', position: [8.1, -5.0], size: [3.2, 14.6, 2.7], style: 'fins', seed: 41, crown: 'screen', lit: 0.78 },
];

function useDisposable(factory, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(factory, deps);
  useEffect(() => () => {
    const list = Array.isArray(value) ? value : Object.values(value);
    list.forEach((v) => {
      if (v?.dispose) v.dispose();
      ['map', 'emissiveMap', 'roughnessMap'].forEach((k) => v?.[k]?.dispose?.());
    });
  }, [value]);
  return value;
}

function facadeMaterial(tex) {
  return new THREE.MeshStandardMaterial({
    map: tex.map,
    emissiveMap: tex.emissiveMap,
    roughnessMap: tex.roughnessMap,
    color: '#ffffff',
    emissive: '#ffffff',
    emissiveIntensity: EMISSIVE,
    metalness: 0.7,
    roughness: 1,
    envMapIntensity: 1.25,
  });
}

/** Shared trim materials (frames, roofs, LED crown lines). */
export function useTrimMaterials() {
  return useDisposable(() => ({
    roof: new THREE.MeshStandardMaterial({ color: '#2b3336', roughness: 0.85, metalness: 0.2 }),
    frame: new THREE.MeshStandardMaterial({ color: '#a7b1b3', roughness: 0.35, metalness: 0.85, envMapIntensity: 1.2 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1c2427', roughness: 0.6, metalness: 0.5 }),
    led: new THREE.MeshStandardMaterial({ color: '#0b2a20', emissive: '#34d399', emissiveIntensity: 4.5, toneMapped: true }),
    ledWarm: new THREE.MeshStandardMaterial({ color: '#2a1d10', emissive: '#ffe1b0', emissiveIntensity: 3.2 }),
  }), []);
}

function Crown({ type, w, h, d, trim }) {
  const top = h;
  switch (type) {
    case 'stepped':
      return (
        <group position={[0, top, 0]}>
          <mesh material={trim.dark} position={[0, 0.5, 0]} castShadow><boxGeometry args={[w * 0.78, 1, d * 0.78]} /></mesh>
          <mesh material={trim.dark} position={[0, 1.25, 0]} castShadow><boxGeometry args={[w * 0.5, 0.5, d * 0.5]} /></mesh>
          <mesh material={trim.led} position={[0, 0.02, d / 2 + 0.01]}><boxGeometry args={[w, 0.05, 0.02]} /></mesh>
          <mesh material={trim.led} position={[0, 1.0, d * 0.39 + 0.01]}><boxGeometry args={[w * 0.78, 0.04, 0.02]} /></mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={trim.frame} position={[s * w * 0.4, 0.9, d * 0.4]} castShadow><boxGeometry args={[0.06, 1.8, 0.06]} /></mesh>
          ))}
        </group>
      );
    case 'frame':
      return (
        <group position={[0, top, 0]}>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
            <mesh key={`${sx}${sz}`} material={trim.frame} position={[sx * (w / 2 - 0.04), 0.7, sz * (d / 2 - 0.04)]} castShadow>
              <boxGeometry args={[0.08, 1.4, 0.08]} />
            </mesh>
          ))}
          <mesh material={trim.frame} position={[0, 1.4, d / 2 - 0.04]}><boxGeometry args={[w, 0.08, 0.08]} /></mesh>
          <mesh material={trim.frame} position={[0, 1.4, -d / 2 + 0.04]}><boxGeometry args={[w, 0.08, 0.08]} /></mesh>
          <mesh material={trim.dark} position={[0, 0.35, 0]}><boxGeometry args={[w * 0.7, 0.7, d * 0.7]} /></mesh>
          {/* Illuminated crown sign panel and LED outline */}
          <mesh material={trim.ledWarm} position={[0, 1.05, d / 2 + 0.005]}><boxGeometry args={[w * 0.42, 0.18, 0.02]} /></mesh>
          <mesh material={trim.led} position={[0, 1.46, d / 2 - 0.04]}><boxGeometry args={[w, 0.03, 0.1]} /></mesh>
          <mesh material={trim.led} position={[0, 0.02, d / 2 + 0.01]}><boxGeometry args={[w, 0.04, 0.02]} /></mesh>
        </group>
      );
    case 'screen':
      return (
        <group position={[0, top, 0]}>
          <mesh material={trim.dark} position={[0, 0.45, 0]} castShadow><boxGeometry args={[w * 0.92, 0.9, d * 0.92]} /></mesh>
          <mesh material={trim.led} position={[0, 0.9, d * 0.46 + 0.01]}><boxGeometry args={[w * 0.92, 0.04, 0.02]} /></mesh>
          <mesh material={trim.led} position={[w * 0.46 + 0.01, 0.9, 0]}><boxGeometry args={[0.02, 0.04, d * 0.92]} /></mesh>
        </group>
      );
    default: // cap
      return (
        <group position={[0, top, 0]}>
          <mesh material={trim.frame} position={[0, 0.06, 0]} castShadow><boxGeometry args={[w + 0.12, 0.12, d + 0.12]} /></mesh>
          <mesh material={trim.dark} position={[w * 0.15, 0.45, -d * 0.1]}><boxGeometry args={[w * 0.4, 0.7, d * 0.5]} /></mesh>
          <mesh material={trim.led} position={[0, 0.13, d / 2 + 0.07]}><boxGeometry args={[w + 0.12, 0.03, 0.02]} /></mesh>
        </group>
      );
  }
}

export function Tower({ tower, trim, highlight = 0, dimmed = false, ...props }) {
  const [w, h, d] = tower.size;
  const facade = useDisposable(
    () => makeFacade({ seed: tower.seed, style: tower.style, lit: tower.lit, glass: tower.style === 'fins' ? '#1d3a44' : '#18323b' }),
    [tower.seed, tower.style, tower.lit],
  );
  const materials = useDisposable(() => {
    const r = rng(tower.seed);
    const side = facadeMaterial({ ...fitFacade(facade, d, h, { offset: r() }) });
    const front = facadeMaterial({ ...fitFacade(facade, w, h, { offset: r() }) });
    return [side, side.clone(), trim.roof, trim.roof, front, front.clone()];
  }, [facade, w, h, d, trim]);

  // Hover/selection glow and fade (used by the interactive twin)
  useEffect(() => {
    materials.forEach((m) => {
      if (m === trim.roof) return;
      m.emissiveIntensity = EMISSIVE * (1 + highlight * 0.6) * (dimmed ? 0.35 : 1);
      m.opacity = dimmed ? 0.35 : 1;
      m.transparent = dimmed;
    });
  }, [materials, highlight, dimmed, trim.roof]);

  return (
    <group position={[tower.position[0], LAND_Y, tower.position[1]]} {...props}>
      <mesh material={materials} position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      <Crown type={tower.crown} w={w} h={h} d={d} trim={trim} />
    </group>
  );
}

/** Retail podium: shopfronts, an upper banded level, roof garden and glass pavilion. */
export function Podium({ trim }) {
  const shop = useDisposable(() => makeShopfront({ seed: 7, bays: 24, levels: 3 }), []);
  const upper = useDisposable(() => makeFacade({ seed: 5, cols: 24, rows: 6, style: 'bands', lit: 0.8, glass: '#24353a', frame: '#c9cfcc', spandrel: '#aeb6b3' }), []);

  const mats = useDisposable(() => {
    const shopMat = (len) => {
      const t = (src) => { const c = src.clone(); c.repeat.set(len / 24 / 1.05, 1); c.needsUpdate = true; return c; };
      return new THREE.MeshStandardMaterial({ map: t(shop.map), emissiveMap: t(shop.emissiveMap), emissive: '#ffffff', emissiveIntensity: 2.2, roughness: 0.4, metalness: 0.3 });
    };
    const up = (len, hgt) => facadeMaterial(fitFacade(upper, len, hgt, { bayW: 0.6, floorH: 0.6 }));
    return {
      shopFront: shopMat(30), shopSide: shopMat(9),
      upperFront: up(28, 1.2), upperSide: up(8, 1.2),
      garden: new THREE.MeshStandardMaterial({ color: '#2f5f3a', roughness: 0.95 }),
      deck: new THREE.MeshStandardMaterial({ color: '#8d8a83', roughness: 0.9 }),
      pavilion: new THREE.MeshPhysicalMaterial({ color: '#1f2e2c', emissive: '#e8a95e', emissiveIntensity: 0.18, roughness: 0.05, metalness: 0.85, transparent: false, opacity: 1, envMapIntensity: 1.6, clearcoat: 1 }),
      pool: new THREE.MeshStandardMaterial({ color: '#0e6b6a', emissive: '#2dd4bf', emissiveIntensity: 1.6, roughness: 0.1, metalness: 0.2 }),
      tree: new THREE.MeshStandardMaterial({ color: '#2d6a3e', roughness: 0.9 }),
    };
  }, [shop, upper]);

  // Roof garden trees (instanced)
  const treeData = useMemo(() => {
    const r = rng(99);
    const out = [];
    while (out.length < 70) {
      const x = -21 + r() * 28;
      const z = -5.5 + r() * 7.5;
      const nearTower = TOWERS.some((t) => Math.abs(x - t.position[0]) < t.size[0] / 2 + 0.6 && Math.abs(z - t.position[1]) < t.size[2] / 2 + 0.6);
      if (!nearTower) out.push([x, z, 0.18 + r() * 0.22]);
    }
    return out;
  }, []);
  const treeMesh = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mesh = new THREE.InstancedMesh(geo, mats.tree, treeData.length);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    treeData.forEach(([x, z, s], i) => {
      m.compose(new THREE.Vector3(x, LAND_Y + 3.05 + s * 0.8, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.9, s));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(i % 3 ? '#2f6f40' : '#3f8a4c'));
    });
    mesh.castShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [treeData, mats.tree]);
  useEffect(() => () => treeMesh.geometry.dispose(), [treeMesh]);

  const L = LAND_Y;
  return (
    <group>
      {/* Ground-floor retail */}
      <mesh position={[-7, L + 0.9, -1.5]} castShadow receiveShadow material={[mats.shopSide, mats.shopSide, trim.roof, trim.roof, mats.shopFront, mats.shopFront]}>
        <boxGeometry args={[30, 1.8, 9]} />
      </mesh>
      {/* Upper retail level, set back */}
      <mesh position={[-7.5, L + 2.4, -2]} castShadow receiveShadow material={[mats.upperSide, mats.upperSide, mats.deck, trim.roof, mats.upperFront, mats.upperFront]}>
        <boxGeometry args={[28, 1.2, 8]} />
      </mesh>
      {/* Canopy line and LED edge */}
      <mesh material={trim.frame} position={[-7, L + 1.82, 3.05]}><boxGeometry args={[30.2, 0.08, 0.3]} /></mesh>
      <mesh material={trim.led} position={[-7.5, L + 3.02, 2.02]}><boxGeometry args={[28, 0.035, 0.03]} /></mesh>
      {/* Roof garden beds */}
      {[[-16, -2.5, 7, 5], [-9.5, 0, 4, 2.5], [0.5, 0.4, 3, 2]].map(([x, z, w, d]) => (
        <mesh key={`${x}${z}`} material={mats.garden} position={[x, L + 3.04, z]} receiveShadow><boxGeometry args={[w, 0.08, d]} /></mesh>
      ))}
      <primitive object={treeMesh} />
      {/* Curved glass pavilion on the podium roof */}
      <mesh material={mats.pavilion} position={[-12.5, L + 3.0, -3.5]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.1, 1.1, 6, 32, 1, false, 0, Math.PI]} />
      </mesh>
      {/* Waterfront steps and teal-lit water feature */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={mats.deck} position={[-4, L + 0.1 + i * 0.12, 4.4 - i * 0.35]} receiveShadow><boxGeometry args={[5 - i * 0.4, 0.12, 0.6]} /></mesh>
      ))}
      <mesh material={mats.pool} position={[-4, L + 0.62, 2.9]}><boxGeometry args={[3, 0.06, 1.2]} /></mesh>
      {/* Low-rise annex on the right */}
      <Annex trim={trim} />
    </group>
  );
}

function Annex({ trim }) {
  const tex = useDisposable(() => makeFacade({ seed: 61, cols: 20, rows: 8, style: 'bands', lit: 0.85, glass: '#283a3f', frame: '#d4d8d4', spandrel: '#c1c7c3' }), []);
  const mats = useDisposable(() => {
    const f = facadeMaterial(fitFacade(tex, 8, 2.6, { bayW: 0.42, floorH: 0.65 }));
    const s = facadeMaterial(fitFacade(tex, 5, 2.6, { bayW: 0.42, floorH: 0.65 }));
    return [s, s.clone(), trim.roof, trim.roof, f, f.clone()];
  }, [tex, trim]);
  return (
    <group position={[13.5, LAND_Y, -2.2]} rotation={[0, -0.25, 0]}>
      <mesh material={mats} position={[0, 1.3, 0]} castShadow receiveShadow><boxGeometry args={[8, 2.6, 5]} /></mesh>
      <mesh material={trim.led} position={[0, 2.62, 2.51]}><boxGeometry args={[8, 0.035, 0.02]} /></mesh>
    </group>
  );
}
