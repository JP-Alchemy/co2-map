import type { Position } from 'geojson';

/**
 * Optional road geometry from the public OSRM demo server, so truck legs follow real roads.
 * Falls back silently (the model then draws an arc and uses a detour factor). Results are
 * cached in memory and localStorage. Disabled when offline.
 */
const mem = new Map<string, Position[] | null>();
const LS_KEY = 'co2map.osrm.v1';
let lsCache: Record<string, Position[]> = {};
try { lsCache = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { lsCache = {}; }

export async function roadGeometry(from: [number, number], to: [number, number]): Promise<Position[] | null> {
  const key = `${from.join(',')}|${to.join(',')}`;
  if (mem.has(key)) return mem.get(key)!;
  if (lsCache[key]) { mem.set(key, lsCache[key]); return lsCache[key]; }
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.join(',')};${to.join(',')}?overview=simplified&geometries=geojson`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const coords: Position[] | undefined = j.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) throw new Error('no route');
    mem.set(key, coords);
    lsCache[key] = coords;
    try { localStorage.setItem(LS_KEY, JSON.stringify(lsCache)); } catch { /* quota */ }
    return coords;
  } catch {
    mem.set(key, null);
    return null;
  }
}
