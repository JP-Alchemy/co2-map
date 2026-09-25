import type { Position } from 'geojson';

/** A camera pose. Longitudes may be unwrapped (beyond ±180) — MapLibre normalises them. */
export interface Cam { center: [number, number]; zoom: number; pitch: number }
export interface Pad { top: number; bottom: number; left: number; right: number }

const RAD = Math.PI / 180;

/** A gentle tilt once you are close enough to see terrain; straight down over the whole globe. */
export function pitchFor(zoom: number) {
  return Math.max(0, Math.min(1, (zoom - 4.5) / 4)) * 38;
}

function toVec([lon, lat]: Position): [number, number, number] {
  return [Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.cos(lon * RAD)];
}
function toLonLat([x, y, z]: [number, number, number]): [number, number] {
  return [Math.atan2(x, z) / RAD, Math.asin(Math.max(-1, Math.min(1, y))) / RAD];
}

/** Spherical interpolation between two [lon, lat] points (shortest way round). */
export function slerp(a: Position, b: Position, t: number): [number, number] {
  const va = toVec(a), vb = toVec(b);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const om = Math.acos(dot);
  if (om < 1e-6) return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const s = Math.sin(om), ka = Math.sin((1 - t) * om) / s, kb = Math.sin(t * om) / s;
  const p = toLonLat([va[0] * ka + vb[0] * kb, va[1] * ka + vb[1] * kb, va[2] * ka + vb[2] * kb]);
  // keep the longitude continuous with the start so MapLibre does not spin the long way round
  p[0] += Math.round((a[0] - p[0]) / 360) * 360;
  return p;
}

type Vec = [number, number, number];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: Vec): Vec | null => { const n = Math.hypot(v[0], v[1], v[2]); return n > 1e-9 ? [v[0] / n, v[1] / n, v[2] / n] : null; };
/** Within this angle of the centre a route reads clearly on the globe (beyond it, it is squeezed against the edge). */
const CLEAR = Math.cos(75 * RAD);

/**
 * Centre of the smallest spherical cap holding every point (Badoiu–Clarkson: step towards the farthest
 * point with a shrinking stride): the tightest framing when everything fits on one side of the planet.
 */
function capCenter(pts: Vec[], start: Vec): Vec {
  let c = start;
  for (let k = 1; k <= 160; k++) {
    let far = pts[0], best = 2;
    for (const v of pts) { const d = dot(v, c); if (d < best) { best = d; far = v; } }
    const t = 1 / (k + 1);
    const n = unit([c[0] + (far[0] - c[0]) * t, c[1] + (far[1] - c[1]) * t, c[2] + (far[2] - c[2]) * t]);
    if (!n) break;
    c = n;
  }
  return c;
}

/**
 * Where to centre the globe: the point that keeps the most of the route's length clearly in view, and of
 * those the tightest. For anything that fits on one side of the planet that is the smallest enclosing
 * cap; for a route curling round to the far side it is the middle of the route, with its ends just over
 * the edge of the globe.
 */
function bestCenter(coords: Position[]): Vec {
  const step = Math.max(1, Math.floor(coords.length / 1500));
  const pts: Vec[] = [];
  for (let i = 0; i < coords.length; i += step) pts.push(toVec(coords[i]));
  // each point stands for the stretch of route before it (capped, so jumps between separate paths don't count)
  const w = pts.map((v, i) => (i ? Math.min(Math.acos(Math.max(-1, Math.min(1, dot(v, pts[i - 1])))), 5 * RAD) : 0));
  let total = w.reduce((a, b) => a + b, 0);
  if (total < 1e-9) { w.fill(1); total = w.length; }
  const mean = unit(pts.reduce<Vec>((a, v, i) => [a[0] + v[0] * w[i], a[1] + v[1] * w[i], a[2] + v[2] * w[i]], [0, 0, 0])) ?? pts[0];
  const candidates: Vec[] = [capCenter(pts, mean), mean];
  const every = Math.max(1, Math.floor(pts.length / 120));
  for (let i = 0; i < pts.length; i += every) candidates.push(pts[i]);
  let best = candidates[0], bestSeen = -1, bestTight = -2;
  for (const c of candidates) {
    let seen = 0, tight = 2;
    for (let i = 0; i < pts.length; i++) {
      const d = dot(pts[i], c);
      if (d > CLEAR) seen += w[i];
      if (d < tight) tight = d;
    }
    if (seen > bestSeen + total * 0.005 || (seen >= bestSeen - total * 0.005 && tight > bestTight)) { best = c; bestSeen = Math.max(seen, bestSeen); bestTight = tight; }
  }
  return best;
}

/**
 * Centre and zoom that frame a set of points on the globe, inside the padded part of a viewport.
 * Uses an orthographic approximation of MapLibre's globe (whose radius is 512·2^z / 2π / cos(lat) px),
 * which reduces to the usual flat fit for small areas. Always a globe: a route reaching round to the other
 * side of the planet gets a best-effort fit, the whole globe with the far end just over its edge.
 */
export function fitCam(coords: Position[], w: number, h: number, pad: Pad, maxZoom = 12, minZoom = 0.8): Cam {
  if (!coords.length) return { center: [5, 52], zoom: 5, pitch: pitchFor(5) };
  const center = toLonLat(bestCenter(coords));
  center[0] += Math.round((coords[0][0] - center[0]) / 360) * 360;
  const [lonC, latC] = center;
  const halfW = Math.max(40, (w - pad.left - pad.right) / 2), halfH = Math.max(40, (h - pad.top - pad.bottom) / 2);
  const lc = latC * RAD;
  let r = Infinity;
  for (const [lon, lat] of coords) {
    const dl = (lon - lonC) * RAD, la = lat * RAD;
    let x = Math.cos(la) * Math.sin(dl);
    let y = Math.cos(lc) * Math.sin(la) - Math.sin(lc) * Math.cos(la) * Math.cos(dl);
    // behind the planet: the best we can do is its edge in that direction
    if (Math.sin(lc) * Math.sin(la) + Math.cos(lc) * Math.cos(la) * Math.cos(dl) < 0) {
      const n = Math.hypot(x, y) || 1;
      x /= n; y /= n;
    }
    x = Math.abs(x); y = Math.abs(y);
    if (x > 1e-9) r = Math.min(r, halfW / x);
    if (y > 1e-9) r = Math.min(r, halfH / y);
  }
  if (!Number.isFinite(r)) r = 1e9;
  const zoom = Math.max(minZoom, Math.min(maxZoom, Math.log2((r * 0.92 * 2 * Math.PI * Math.cos(latC * RAD)) / 512)));
  return { center, zoom, pitch: pitchFor(zoom) };
}

function merc([lon, lat]: [number, number]) {
  const l = Math.max(-85, Math.min(85, lat));
  return [(lon + 180) / 360, 0.5 - Math.log(Math.tan(Math.PI / 4 + (l * RAD) / 2)) / (2 * Math.PI)];
}

/**
 * Camera at progress k (0..1, already eased) along an optimal zoom-out/pan/zoom-in flight from a to b
 * (van Wijk & Nuij 2003, the same curve MapLibre's flyTo uses). Pure function of k, so the journey can
 * be scrubbed backwards and forwards.
 */
export function flyCam(a: Cam, b: Cam, k: number, w: number, h: number): Cam {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const rho = 1.42, rho2 = rho * rho;
  const w0 = Math.max(w, h);
  const w1 = w0 / Math.pow(2, b.zoom - a.zoom);
  const bc: [number, number] = [b.center[0] + Math.round((a.center[0] - b.center[0]) / 360) * 360, b.center[1]];
  const pa = merc(a.center), pb = merc(bc);
  const u1 = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) * 512 * Math.pow(2, a.zoom);
  let zoom: number, f: number;
  if (u1 < 1) {
    zoom = a.zoom + (b.zoom - a.zoom) * k;
    f = k;
  } else {
    const r = (i: 0 | 1) => {
      const bb = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
      return Math.log(Math.sqrt(bb * bb + 1) - bb);
    };
    const r0 = r(0), S = (r(1) - r0) / rho, s = k * S;
    const scale = Math.cosh(r0 + rho * s) / Math.cosh(r0);
    zoom = a.zoom + Math.log2(scale);
    f = Math.min(1, (w0 * ((Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0)) / rho2)) / u1);
    if (!Number.isFinite(zoom) || !Number.isFinite(f)) { zoom = a.zoom + (b.zoom - a.zoom) * k; f = k; }
  }
  return { center: slerp(a.center, bc, f), zoom, pitch: pitchFor(zoom) };
}

export const ease = {
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  smooth: (t: number) => t * t * (3 - 2 * t),
};

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
