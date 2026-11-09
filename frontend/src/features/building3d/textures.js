import * as THREE from 'three';

/**
 * Procedural facade textures, drawn once into canvases and reused by every
 * tower. Each texture covers COLS x ROWS window cells; materials set
 * texture.repeat so one cell maps to one real bay x floor at any tower size.
 */

/** Small deterministic PRNG, so the city looks the same on every load. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { color = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

const WARM = ['#f7b65e', '#f2a648', '#ffc878', '#e9953a', '#ffd9a0', '#f5bd6d'];

/**
 * Curtain-wall facade.
 * style: 'grid' (glass box), 'bands' (horizontal spandrels), 'fins' (vertical fins)
 */
export function makeFacade({
  cols = 24, rows = 40, cellW = 22, cellH = 40, seed = 1, lit = 0.6,
  glass = '#1a3640', frame = '#6f7b7e', spandrel = '#4a5559', style = 'grid', cool = 0.04,
} = {}) {
  const r = rng(seed);
  const W = cols * cellW;
  const H = rows * cellH;
  const [mc, m] = canvas(W, H);   // base colour
  const [ec, e] = canvas(W, H);   // emissive
  const [rc, rough] = canvas(W, H); // roughness (glass smooth, frame rough)

  m.fillStyle = frame;
  m.fillRect(0, 0, W, H);
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);
  rough.fillStyle = '#b4b4b4';
  rough.fillRect(0, 0, W, H);

  const slab = style === 'bands' ? Math.round(cellH * 0.32) : Math.round(cellH * 0.14);
  const mull = style === 'fins' ? Math.round(cellW * 0.22) : Math.round(cellW * 0.08);

  // Whole floors (or clusters) tend to be lit together, like real offices and hotels
  const floorBias = Array.from({ length: rows }, () => (r() < 0.1 ? -0.35 : r() < 0.25 ? 0.15 : 0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * cellW + mull / 2;
      const py = y * cellH + slab;
      const w = cellW - mull;
      const h = cellH - slab;

      // Glass with slight per-pane tint variation
      const g = new THREE.Color(glass).offsetHSL(0, 0, (r() - 0.5) * 0.06);
      m.fillStyle = `#${g.getHexString()}`;
      m.fillRect(px, py, w, h);
      rough.fillStyle = '#1e1e1e';
      rough.fillRect(px, py, w, h);

      if (style === 'bands') {
        m.fillStyle = spandrel;
        m.fillRect(x * cellW, y * cellH, cellW, slab);
      }

      if (r() < lit + floorBias[y]) {
        const isCool = r() < cool;
        const base = new THREE.Color(isCool ? '#d6ecff' : WARM[Math.floor(r() * WARM.length)]);
        const k = 0.55 + r() * 0.4; // dimmer / brighter rooms
        base.multiplyScalar(k);
        // Interior falloff: brighter ceiling band, curtains partly closed
        const grad = e.createLinearGradient(0, py, 0, py + h);
        grad.addColorStop(0, `#${base.clone().multiplyScalar(1.15).getHexString()}`);
        grad.addColorStop(0.7, `#${base.getHexString()}`);
        grad.addColorStop(1, `#${base.clone().multiplyScalar(0.55).getHexString()}`);
        e.fillStyle = grad;
        const curtain = r() < 0.3 ? w * (0.3 + r() * 0.4) : 0;
        e.fillRect(px + curtain, py, w - curtain, h);
      }
    }
  }

  return { map: toTexture(mc), emissiveMap: toTexture(ec), roughnessMap: toTexture(rc, { color: false }), cols, rows };
}

/** Retail podium frontage: tall glazed shopfronts, signage bands and soffit lights. */
export function makeShopfront({ seed = 7, bays = 24, levels = 3 } = {}) {
  const r = rng(seed);
  const cellW = 48;
  const cellH = 64;
  const W = bays * cellW;
  const H = levels * cellH;
  const [mc, m] = canvas(W, H);
  const [ec, e] = canvas(W, H);
  m.fillStyle = '#9aa29f';
  m.fillRect(0, 0, W, H);
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);
  const signs = ['#7ee2b8', '#34d399', '#fef3c7', '#fda4af', '#a7f3d0', '#ffffff'];

  for (let l = 0; l < levels; l++) {
    for (let b = 0; b < bays; b++) {
      const x = b * cellW + 3;
      const y = l * cellH + 14;
      m.fillStyle = '#26363a';
      m.fillRect(x, y, cellW - 6, cellH - 18);
      // Warm, very bright retail interiors
      const c = new THREE.Color(WARM[Math.floor(r() * WARM.length)]).multiplyScalar(0.75 + r() * 0.35);
      const grad = e.createLinearGradient(0, y, 0, y + cellH - 18);
      grad.addColorStop(0, `#${c.getHexString()}`);
      grad.addColorStop(1, `#${c.clone().multiplyScalar(0.6).getHexString()}`);
      e.fillStyle = grad;
      e.fillRect(x, y, cellW - 6, cellH - 18);
      // Signage band above the shopfront
      if (r() < 0.55) {
        e.fillStyle = signs[Math.floor(r() * signs.length)];
        e.fillRect(x + 6, l * cellH + 4, cellW - 18, 6);
      }
    }
  }
  return { map: toTexture(mc), emissiveMap: toTexture(ec), cellW, cellH, bays, levels };
}

/** Tileable value-noise texture, used as the water distortion map. */
export function makeNoise(size = 256, seed = 3) {
  const r = rng(seed);
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  const grid = 32;
  const g = Array.from({ length: grid * grid }, () => r());
  const at = (x, y) => g[((y % grid) + grid) % grid * grid + (((x % grid) + grid) % grid)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * grid;
      const fy = (y / size) * grid * 0.35; // stretched: horizontal ripples
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const v = (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { color: false });
}

/** Clone a facade texture set with the repeat needed for a w x h face. */
export function fitFacade(tex, faceW, faceH, { bayW = 0.15, floorH = 0.32, offset = 0 } = {}) {
  const fit = (t) => {
    const c = t.clone();
    c.repeat.set(faceW / (tex.cols * bayW), faceH / (tex.rows * floorH));
    c.offset.set(offset, 0);
    c.needsUpdate = true;
    return c;
  };
  return { map: fit(tex.map), emissiveMap: fit(tex.emissiveMap), roughnessMap: fit(tex.roughnessMap) };
}
