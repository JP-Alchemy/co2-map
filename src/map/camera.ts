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

/**
 * Centre and zoom that frame a set of points on the globe, inside the padded part of a viewport.
 * Uses an orthographic approximation of MapLibre's globe (whose radius is 512·2^z / 2π / cos(lat) px),
 * which reduces to the usual mercator fit for small areas and stays sane for ocean crossings.
 */
export function fitCam(coords: Position[], w: number, h: number, pad: Pad, maxZoom = 12, minZoom = 0.8): Cam {
  if (!coords.length) return { center: [5, 52], zoom: 5, pitch: pitchFor(5) };
  let sx = 0, sy = 0, sz = 0;
  for (const c of coords) { const v = toVec(c); sx += v[0]; sy += v[1]; sz += v[2]; }
  const len = Math.hypot(sx, sy, sz);
  const center = len > 1e-6 ? toLonLat([sx / len, sy / len, sz / len]) : [coords[0][0], coords[0][1]] as [number, number];
  center[0] += Math.round((coords[0][0] - center[0]) / 360) * 360;
  const [lonC, latC] = center;
  const halfW = Math.max(40, (w - pad.left - pad.right) / 2), halfH = Math.max(40, (h - pad.top - pad.bottom) / 2);
  let r = Infinity;
  for (const [lon, lat] of coords) {
    const dl = (lon - lonC) * RAD, la = lat * RAD, lc = latC * RAD;
    const x = Math.abs(Math.cos(la) * Math.sin(dl));
    const y = Math.abs(Math.cos(lc) * Math.sin(la) - Math.sin(lc) * Math.cos(la) * Math.cos(dl));
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
