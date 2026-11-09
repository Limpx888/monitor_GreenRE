import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeFacade, rng } from './textures';
import { LAND_Y } from './Towers';
import { DUSK } from './Sky';

/** Shoreline from the foreground left, curving right to a rounded point (xz plane). */
const SHORE = new THREE.CatmullRomCurve3([
  // Sweeps in from the bottom-left foreground, as in the reference
  new THREE.Vector3(-31, 0, 46),
  new THREE.Vector3(-25, 0, 31),
  new THREE.Vector3(-19, 0, 19),
  new THREE.Vector3(-12, 0, 10.5),
  new THREE.Vector3(2, 0, 6.2),
  new THREE.Vector3(14, 0, 4.6),
  new THREE.Vector3(22, 0, 2.4),
  new THREE.Vector3(25.5, 0, 0.2),
  new THREE.Vector3(24.5, 0, -2.0),
  new THREE.Vector3(30, 0, -5.5),
  new THREE.Vector3(48, 0, -9),
  new THREE.Vector3(80, 0, -13),
]);

function useDispose(obj) {
  useEffect(() => () => {
    obj.traverse?.((o) => {
      o.geometry?.dispose();
      const m = o.material;
      (Array.isArray(m) ? m : [m]).forEach((x) => x?.dispose?.());
    });
  }, [obj]);
}

/** Inward offset of the shoreline (toward land = -z normal side). */
function shoreOffset(t, inward) {
  const p = SHORE.getPointAt(t);
  const tan = SHORE.getTangentAt(t);
  const n = new THREE.Vector3(tan.z, 0, -tan.x); // left-hand normal = toward land
  return p.addScaledVector(n, inward);
}

function buildLand() {
  const pts = SHORE.getSpacedPoints(160);
  const shape = new THREE.Shape();
  // Shape lives in XY; rotateX(-90deg) maps (x, y) -> (x, 0, -y)
  shape.moveTo(pts[0].x, -pts[0].z);
  pts.forEach((p) => shape.lineTo(p.x, -p.z));
  shape.lineTo(80, 70);
  shape.lineTo(-70, 70);
  shape.lineTo(-70, -46);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: LAND_Y + 0.4, bevelEnabled: false, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -0.4, 0);
  return geo;
}

function buildRibbon(from, to, inner, outer, segments = 220) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    const t = from + (to - from) * (i / segments);
    const a = shoreOffset(t, inner);
    const b = shoreOffset(t, outer);
    pos.push(a.x, 0, a.z, b.x, 0, b.z);
    if (i < segments) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // Flat ground ribbon: normals straight up regardless of triangle winding
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}

function palmCrownGeometry() {
  const fronds = [];
  for (let i = 0; i < 9; i++) {
    const f = new THREE.PlaneGeometry(0.14, 0.75, 1, 4);
    // Droop each frond along its length
    const p = f.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const y = p.getY(v) + 0.375;
      p.setXYZ(v, p.getX(v) * (1 - y * 0.6), 0, -y);
      p.setY(v, -y * y * 0.55);
    }
    f.translate(0, 0, 0);
    f.rotateY((i / 9) * Math.PI * 2 + (i % 2) * 0.2);
    fronds.push(f);
  }
  const g = mergeGeometries(fronds);
  g.computeVertexNormals();
  return g;
}

function Palms({ count = 46 }) {
  const group = useMemo(() => {
    const r = rng(21);
    const trunkGeo = new THREE.CylinderGeometry(0.035, 0.055, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const crownGeo = palmCrownGeometry();
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5b4a3a', roughness: 0.9 });
    const crownMat = new THREE.MeshStandardMaterial({ color: '#2f6a3a', roughness: 0.8, side: THREE.DoubleSide });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const t = 0.03 + (i / count) * 0.62 + (r() - 0.5) * 0.006;
      const p = shoreOffset(t, 1.3 + r() * 1.6);
      const hgt = 1.0 + r() * 0.6;
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.18, 0, (r() - 0.5) * 0.18));
      m.compose(new THREE.Vector3(p.x, LAND_Y, p.z), q, new THREE.Vector3(1, hgt, 1));
      trunks.setMatrixAt(i, m);
      const top = new THREE.Vector3(0, hgt, 0).applyQuaternion(q).add(new THREE.Vector3(p.x, LAND_Y, p.z));
      const s = 0.8 + r() * 0.5;
      m.compose(top, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6.28, 0)), new THREE.Vector3(s, s, s));
      crowns.setMatrixAt(i, m);
      crowns.setColorAt(i, c.set(i % 4 === 0 ? '#3d7c45' : '#2c6338'));
    }
    trunks.castShadow = crowns.castShadow = true;
    const g = new THREE.Group();
    g.add(trunks, crowns);
    return g;
  }, [count]);
  useDispose(group);
  return <primitive object={group} />;
}

function Lamps() {
  const group = useMemo(() => {
    const n = 64;
    const head = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.05, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#2a1d10', emissive: '#ffd59a', emissiveIntensity: 7 }),
      n,
    );
    const pole = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.012, 0.016, 0.55, 5),
      new THREE.MeshStandardMaterial({ color: '#2a3134', metalness: 0.6, roughness: 0.4 }),
      n,
    );
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const p = shoreOffset(0.02 + (i / n) * 0.66, 0.35);
      m.makeTranslation(p.x, LAND_Y + 0.58, p.z);
      head.setMatrixAt(i, m);
      m.makeTranslation(p.x, LAND_Y + 0.28, p.z);
      pole.setMatrixAt(i, m);
    }
    const g = new THREE.Group();
    g.add(head, pole);
    return g;
  }, []);
  useDispose(group);
  return <primitive object={group} />;
}

/** Dense tree canopy covering the hinterland between the towers and the hills. */
function Hinterland({ count = 220 }) {
  const group = useMemo(() => {
    const r = rng(55);
    const mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 2),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }),
      count,
    );
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    let i = 0;
    while (i < count) {
      const x = -70 + r() * 110;
      const z = -9 - r() * 60;
      if (x > 18 && z > -20) continue; // keep the right-hand shore open
      const s = 0.35 + r() * 0.7;
      m.compose(new THREE.Vector3(x, LAND_Y + s * 0.5, z), new THREE.Quaternion(), new THREE.Vector3(s * 1.2, s, s * 1.2));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setHSL(0.37 + r() * 0.05, 0.3, 0.07 + r() * 0.05));
      i++;
    }
    const g = new THREE.Group();
    g.add(mesh);
    return g;
  }, [count]);
  useDispose(group);
  return <primitive object={group} />;
}

/** Layered mountain silhouettes that fade into the haze (fog). */
function Mountains() {
  const group = useMemo(() => {
    const g = new THREE.Group();
    const layers = [
      { z: -95, height: 20, color: '#16343a', seed: 3, x0: -160, x1: 40 },
      { z: -135, height: 30, color: '#22474c', seed: 8, x0: -190, x1: 70 },
      { z: -175, height: 24, color: '#38605f', seed: 13, x0: -120, x1: 160 },
    ];
    layers.forEach(({ z, height, color, seed, x0, x1 }) => {
      const r = rng(seed);
      const shape = new THREE.Shape();
      shape.moveTo(x0, -2);
      const oct = [r() * 9, r() * 9, r() * 9];
      for (let x = x0; x <= x1; x += 1.5) {
        const u = (x - x0) / (x1 - x0);
        const env = Math.sin(Math.PI * u) ** 0.7; // rise and fall across the range
        const n = 0.55 * Math.sin(x * 0.035 + oct[0]) + 0.3 * Math.sin(x * 0.09 + oct[1]) + 0.15 * Math.sin(x * 0.23 + oct[2]);
        shape.lineTo(x, Math.max(0, env * height * (0.62 + n * 0.45)));
      }
      shape.lineTo(x1, -2);
      shape.closePath();
      const geo = new THREE.ShapeGeometry(shape, 1);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, fog: true }));
      mesh.position.z = z;
      g.add(mesh);
    });
    return g;
  }, []);
  useDispose(group);
  return <primitive object={group} />;
}

/** Distant city along the far shore, instanced boxes sharing one lit facade. */
function Skyline({ count = 70 }) {
  const group = useMemo(() => {
    const r = rng(77);
    const tex = makeFacade({ seed: 91, cols: 8, rows: 16, lit: 0.5, glass: '#1c2f36', frame: '#7d8a8e' });
    [tex.map, tex.emissiveMap, tex.roughnessMap].forEach((t) => t.repeat.set(1, 1.5));
    const mat = new THREE.MeshStandardMaterial({
      map: tex.map, emissiveMap: tex.emissiveMap, emissive: '#ffffff', emissiveIntensity: 1.5, roughness: 0.6, metalness: 0.4,
    });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat, count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const x = 32 + t * 70 + (r() - 0.5) * 3;
      const z = -10 - t * 14 - r() * 18;
      const h = (2 + r() * 7) * (1 - t * 0.35);
      m.compose(new THREE.Vector3(x, LAND_Y - 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 0.6, 0)), new THREE.Vector3(1 + r() * 1.6, h, 1 + r() * 1.4));
      mesh.setMatrixAt(i, m);
    }
    const g = new THREE.Group();
    g.add(mesh);
    return g;
  }, [count]);
  useDispose(group);
  return <primitive object={group} />;
}

export default function Landscape({ detail = 'high' }) {
  const parts = useMemo(() => {
    const land = buildLand();
    const promenade = buildRibbon(0.0, 0.7, 0.05, 2.6);
    const lawn = buildRibbon(0.62, 0.74, 0.4, 3.6, 40);
    return {
      land, promenade, lawn,
      // Land cap: dark vegetated ground (the promenade ribbon paves the shore strip)
      paving: new THREE.MeshStandardMaterial({ color: '#25352d', roughness: 1 }),
      seawall: new THREE.MeshStandardMaterial({ color: '#77736b', roughness: 0.9 }),
      walk: new THREE.MeshStandardMaterial({ color: '#b9a99a', roughness: 0.85, side: THREE.DoubleSide }),
      grass: new THREE.MeshStandardMaterial({ color: '#3f7a3e', roughness: 0.95, side: THREE.DoubleSide }),
    };
  }, []);
  useEffect(() => () => Object.values(parts).forEach((p) => p.dispose?.()), [parts]);

  return (
    <group>
      {/* ExtrudeGeometry groups: 0 = top/bottom caps, 1 = side walls (seawall) */}
      <mesh geometry={parts.land} material={[parts.paving, parts.seawall]} receiveShadow />
      <mesh geometry={parts.promenade} material={parts.walk} position={[0, LAND_Y + 0.005, 0]} receiveShadow />
      <mesh geometry={parts.lawn} material={parts.grass} position={[0, LAND_Y + 0.01, 0]} receiveShadow />
      <Lamps />
      <Palms count={detail === 'high' ? 46 : 24} />
      <Hinterland count={detail === 'high' ? 520 : 180} />
      <Mountains />
      <Skyline count={detail === 'high' ? 70 : 36} />
    </group>
  );
}

export { SHORE, DUSK };
