import React, { useMemo } from 'react';
import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(0.82, 0.07, -0.56).normalize();

/** Dusk palette, shifted toward teal/sea-green to match the GoGreen theme. */
export const DUSK = {
  zenith: '#0a2430',
  upper: '#1d4c56',
  mid: '#3f7f7a',
  horizon: '#f0b48f',
  glow: '#f29aa6',
  below: '#16323a',
  cloud: '#f6b3b0',
  fog: '#6f8784',
};

const vertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w; // always at the far plane
  }
`;

const fragment = /* glsl */ `
  uniform vec3 zenith; uniform vec3 upper; uniform vec3 mid; uniform vec3 horizon;
  uniform vec3 glow; uniform vec3 below; uniform vec3 cloud; uniform vec3 sunDir;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(horizon, mid, smoothstep(0.0, 0.16, h));
    col = mix(col, upper, smoothstep(0.12, 0.42, h));
    col = mix(col, zenith, smoothstep(0.38, 0.9, h));
    col = mix(col, below, smoothstep(0.0, -0.08, h));

    float s = max(dot(d, normalize(sunDir)), 0.0);
    col += glow * (pow(s, 6.0) * 0.45 + pow(s, 48.0) * 0.6) * smoothstep(-0.05, 0.1, h + 0.05);

    // Streaky altocumulus lit pink by the low sun
    vec2 uv = d.xz / max(h + 0.12, 0.05);
    float n = fbm(uv * vec2(0.55, 1.6) + vec2(3.1, 1.7));
    float band = smoothstep(0.03, 0.18, h) * (1.0 - smoothstep(0.35, 0.75, h));
    float c = smoothstep(0.52, 0.82, n) * band;
    vec3 cc = mix(cloud * 0.75, cloud * 1.15 + glow * 0.2, pow(s, 2.0));
    col = mix(col, cc, c * 0.6);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function Sky({ radius = 450 }) {
  const material = useMemo(() => {
    const u = Object.fromEntries(Object.entries(DUSK).filter(([k]) => k !== 'fog').map(([k, v]) => [k, { value: new THREE.Color(v) }]));
    return new THREE.ShaderMaterial({
      uniforms: { ...u, sunDir: { value: SUN_DIR } },
      vertexShader: vertex,
      fragmentShader: fragment,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
  }, []);

  return (
    <mesh material={material} scale={radius} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1, 48, 24]} />
    </mesh>
  );
}
