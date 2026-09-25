import type { FeatureCollection, Point } from 'geojson';
import type { StoreFeature } from '../store';
import type { StoreProps } from '../types';
import { haversineKm } from './geo';

/** Where the player is: from the browser's location, or a town or postcode they typed. Never leaves the device. */
export interface Here {
  coords: [number, number];
  /** metres, for a browser location */
  accuracy: number | null;
  /** "your location", or the town or postcode that was searched */
  label: string;
  source: 'gps' | 'search';
}

export type LocateError = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

/** The browser's idea of where we are (asks for permission the first time). */
export function locate(): Promise<Here> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject('unsupported' satisfies LocateError); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ coords: [p.coords.longitude, p.coords.latitude], accuracy: p.coords.accuracy, label: 'your location', source: 'gps' }),
      (e) => reject((e.code === e.PERMISSION_DENIED ? 'denied' : e.code === e.TIMEOUT ? 'timeout' : 'unavailable') satisfies LocateError),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
  });
}

export interface Hit { store: StoreFeature; km: number }

/** Beyond this the player is probably not in the Netherlands, where all the mapped stores are. */
export const FAR_KM = 40;

/**
 * The stores around a point: the nearest one of every chain (the ones you most likely shop at), closest
 * first, and a few more of any chain within a short trip.
 */
export function nearbyStores(stores: FeatureCollection<Point, StoreProps>, at: [number, number], more = 6, radiusKm = 4): { perChain: Hit[]; more: Hit[] } {
  const hits = stores.features.map((f) => ({ store: f as StoreFeature, km: haversineKm(at, f.geometry.coordinates as [number, number]) })).sort((a, b) => a.km - b.km);
  const perChain: Hit[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (seen.has(h.store.properties.chain)) continue;
    seen.add(h.store.properties.chain);
    perChain.push(h);
  }
  const taken = new Set(perChain.map((h) => h.store.properties.osm));
  return { perChain, more: hits.filter((h) => !taken.has(h.store.properties.osm) && h.km <= radiusKm).slice(0, more) };
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/**
 * A town or postcode typed by the player, found among the stores' own addresses (no geocoding service):
 * the middle of the stores in that town, or in that postcode area.
 */
export function findPlace(stores: FeatureCollection<Point, StoreProps>, query: string): Here | null {
  const q = norm(query);
  if (q.length < 2) return null;
  let matches: StoreFeature[] = [];
  let label = query.trim();
  const pc = /^(\d{4})([a-z]{0,2})$/.exec(q);
  if (pc) {
    // the full postcode if a store has it, else the four-digit area, else the wider area
    for (const prefix of [q, pc[1], pc[1].slice(0, 3), pc[1].slice(0, 2)]) {
      matches = stores.features.filter((f) => f.properties.postcode && norm(f.properties.postcode).startsWith(prefix)) as StoreFeature[];
      if (matches.length) { label = prefix.length >= 4 ? query.trim().toUpperCase() : `${prefix}…`; break; }
    }
  } else {
    const byCity = (test: (c: string) => boolean) => stores.features.filter((f) => f.properties.city && test(norm(f.properties.city))) as StoreFeature[];
    matches = byCity((c) => c === q);
    if (!matches.length) matches = byCity((c) => c.startsWith(q));
    if (!matches.length && q.length >= 4) matches = byCity((c) => c.includes(q));
    if (matches.length) label = matches[0].properties.city!;
  }
  if (!matches.length) return null;
  // the median, so one mistagged store far away doesn't drag the middle off
  const mid = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
  return { coords: [mid(matches.map((m) => m.geometry.coordinates[0])), mid(matches.map((m) => m.geometry.coordinates[1]))], accuracy: null, label, source: 'search' };
}

export function fmtDistance(km: number) {
  return km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} m` : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString('en-GB')} km`;
}

/** A rough trip time from the straight-line distance: on foot nearby, by bike in town (this is the Netherlands), else by car. */
export function tripHint(km: number) {
  const road = km * 1.3;
  if (km < 1.2) return `🚶 ${Math.max(1, Math.round((road / 4.8) * 60))} min`;
  if (km < 8) return `🚲 ${Math.max(1, Math.round((road / 15) * 60))} min`;
  if (km < 150) return `🚗 ${Math.max(1, Math.round((road / 55) * 60))} min`;
  return '';
}

/** What went wrong, and what to do instead. */
export const LOCATE_HELP: Record<LocateError, string> = {
  denied: 'Location access is blocked for this site. Allow it in your browser, or type your town or postcode.',
  unavailable: 'Your device couldn’t tell where you are just now. Try again, or type your town or postcode.',
  timeout: 'Finding your location took too long. Try again, or type your town or postcode.',
  unsupported: 'This browser can’t share its location. Type your town or postcode instead.',
};
