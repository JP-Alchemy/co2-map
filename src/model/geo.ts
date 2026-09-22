import { greatCircle } from '@turf/great-circle';
import type { Feature, LineString, MultiLineString, Position } from 'geojson';

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Haversine distance in km between [lon, lat] points */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Total great-circle length along a polyline of [lon, lat] points */
export function pathKm(points: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversineKm(points[i - 1], points[i]);
  return d;
}

/** Shift longitudes so consecutive points never jump more than 180°, keeping lines continuous across the antimeridian. */
export function unwrap(points: Position[]): Position[] {
  const out: Position[] = [];
  let offset = 0;
  for (let i = 0; i < points.length; i++) {
    let lon = points[i][0] + offset;
    if (i > 0) {
      const prev = out[i - 1][0];
      if (lon - prev > 180) { offset -= 360; lon -= 360; }
      else if (lon - prev < -180) { offset += 360; lon += 360; }
    }
    out.push([lon, points[i][1]]);
  }
  return out;
}

/** Build a smooth great-circle line through the given points (for ship / air legs). */
export function greatCircleLine(points: [number, number][], npoints = 40): Position[] {
  const out: Position[] = [];
  for (let i = 1; i < points.length; i++) {
    const seg = greatCircle(points[i - 1], points[i], { npoints }) as Feature<LineString | MultiLineString>;
    const coords: Position[] =
      seg.geometry.type === 'LineString' ? seg.geometry.coordinates : seg.geometry.coordinates.flat();
    out.push(...(i === 1 ? coords : coords.slice(1)));
  }
  return unwrap(out);
}

/** A slightly bowed line for road legs, so overlapping legs remain distinguishable. */
export function arcLine(a: [number, number], b: [number, number], bow = 0.08, npoints = 24): Position[] {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / len) * len * bow, cy = my + (dx / len) * len * bow;
  const pts: Position[] = [];
  for (let i = 0; i <= npoints; i++) {
    const t = i / npoints;
    pts.push([
      (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * cx + t ** 2 * b[0],
      (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * cy + t ** 2 * b[1],
    ]);
  }
  return pts;
}
