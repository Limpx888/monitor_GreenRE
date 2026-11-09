/**
 * Picks a render tier for the 3D scene:
 *   'high' full effects (reflections, AO, bloom, soft shadows)
 *   'low'  phones / low-core laptops: no AO or planar reflection, DPR 1
 *   'none' no WebGL or data-saver: show the static poster image instead
 */
export function detectTier() {
  if (typeof window === 'undefined') return 'none';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'none';
  } catch {
    return 'none';
  }
  if (navigator.connection?.saveData) return 'none';
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = window.innerWidth < 768;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8;
  if (coarse || small || cores <= 4 || memory <= 4) return 'low';
  return 'high';
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
