import type { Position } from 'geojson';
import { HANDLING_EUR_PER_KG, IMPORT_MARGIN, MODES, STORAGE, VAT } from '../data/factors';
import type { Chain, LegStep, NodeStep, Place, Product, Step, SupplyRoute, TransportMode } from '../types';
import { arcLine, greatCircleLine, haversineKm, pathKm, unwrap } from './geo';

export interface ComputedNode {
  kind: 'node';
  index: number;
  step: NodeStep;
  place: Place;
  /** [lon, lat] to draw at; longitude may exceed ±180 so the whole route is one continuous line */
  coords: [number, number];
  co2eKg: number;   // per kg product
  costEur: number;  // per kg product
  days: number;
}

export interface ComputedLeg {
  kind: 'leg';
  index: number;
  step: LegStep;
  from: Place;
  to: Place;
  mode: TransportMode;
  distanceKm: number;
  hours: number;
  co2eKg: number;
  costEur: number;
  /** [lon, lat] path drawn on the map */
  path: Position[];
  /** True when the geometry came from a road router rather than an arc */
  routed?: boolean;
}

export type ComputedStep = ComputedNode | ComputedLeg;

export interface Breakdown {
  production: number;
  transport: number;
  storage: number;
}

export interface ComputedRoute {
  route: SupplyRoute;
  product: Product;
  chain: Chain;
  steps: ComputedStep[];
  co2e: Breakdown & { total: number };            // kg CO2e per kg product
  cost: {
    farmGate: number; packing: number; transport: number; storage: number; handling: number;
    importMargin: number; retailMargin: number; vat: number; shelf: number;                 // EUR per kg
  };
  totalKm: number;
  totalDays: number;
  byMode: Partial<Record<TransportMode, { km: number; co2eKg: number }>>;
  /** Index into `steps` where the chain-specific tail begins */
  tailStart: number;
}

export interface RoutedGeometry {
  /** key: `${fromId}>${toId}` */
  [key: string]: Position[] | undefined;
}

function nearestDc(chain: Chain, to: [number, number]) {
  const fresh = chain.dcs.filter((d) => d.fresh);
  const pool = fresh.length ? fresh : chain.dcs;
  return pool.reduce((best, d) => (haversineKm(d.coords, to) < haversineKm(best.coords, to) ? d : best), pool[0]);
}

/**
 * Append the chain-specific tail to a route: last route node → (fresh supplier) → nearest DC → store.
 * Domestic routes whose last node already is the chain's fresh supplier skip that hop.
 */
export function buildFullSteps(product: Product, route: SupplyRoute, chain: Chain, store: Place, places: Record<string, Place>): { steps: Step[]; tailStart: number } {
  const steps: Step[] = [...route.steps];
  const tailStart = steps.length;
  const last = steps[steps.length - 1] as NodeStep;
  const lastPlace = places[last.placeId];

  // A dedicated produce supplier (e.g. Bakker Barendrecht for AH) only handles fruit and vegetables.
  const usesHub = product.category === 'fruit' || product.category === 'vegetable';
  const hub = usesHub && chain.freshSupply.placeId ? places[chain.freshSupply.placeId] : undefined;
  if (hub && lastPlace.id !== hub.id && last.role !== 'dc') {
    steps.push({ kind: 'leg', mode: 'reefer_truck' });
    steps.push({ kind: 'node', placeId: hub.id, role: 'import', days: 1, storage: 'chilled', note: chain.freshSupply.description });
  }
  const dc = nearestDc(chain, store.coords);
  if (last.role !== 'dc') {
    steps.push({ kind: 'leg', mode: 'reefer_truck' });
    steps.push({ kind: 'node', placeId: dc.id, role: 'dc', days: 1, storage: 'chilled', note: 'Cross-docked overnight and picked per store order.' });
  }
  steps.push({ kind: 'leg', mode: 'reefer_truck', note: 'Store delivery, usually in the early morning.' });
  steps.push({ kind: 'node', placeId: store.id, role: 'store', days: 2, storage: 'chilled', note: 'Average time on the shelf before purchase.' });
  return { steps, tailStart };
}

export function computeRoute(
  product: Product,
  route: SupplyRoute,
  chain: Chain,
  store: Place,
  places: Record<string, Place>,
  routed: RoutedGeometry = {},
): ComputedRoute {
  const { steps: raw, tailStart } = buildFullSteps(product, route, chain, store, places);
  const all: Record<string, Place> = { ...places, [store.id]: store };
  for (const d of chain.dcs) all[d.id] = d;

  const steps: ComputedStep[] = [];
  const byMode: ComputedRoute['byMode'] = {};
  let transportCo2 = 0, storageCo2 = 0, transportCost = 0, storageCost = 0, handling = 0, km = 0, days = 0;

  for (let i = 0; i < raw.length; i++) {
    const s = raw[i];
    if (s.kind === 'node') {
      const place = all[s.placeId];
      if (!place) throw new Error(`Unknown place ${s.placeId}`);
      const sf = STORAGE[s.storage];
      const co2 = sf.co2ePerKgDay * s.days;
      const cost = sf.eurPerKgDay * s.days + (s.role === 'origin' ? 0 : HANDLING_EUR_PER_KG);
      storageCo2 += co2; storageCost += sf.eurPerKgDay * s.days; if (s.role !== 'origin') handling += HANDLING_EUR_PER_KG;
      days += s.days;
      steps.push({ kind: 'node', index: i, step: s, place, coords: [...place.coords] as [number, number], co2eKg: co2, costEur: cost, days: s.days });
    } else {
      const prev = raw[i - 1] as NodeStep, next = raw[i + 1] as NodeStep;
      const from = all[prev.placeId], to = all[next.placeId];
      const mf = MODES[s.mode];
      const pts: [number, number][] = [from.coords, ...(s.waypoints ?? []), to.coords];
      const isSurface = s.mode === 'truck' || s.mode === 'reefer_truck' || s.mode === 'rail';
      const routedPath = isSurface ? routed[`${from.id}>${to.id}`] : undefined;
      let distanceKm = s.distanceKm ?? (routedPath ? pathKm(routedPath as [number, number][]) : pathKm(pts) * mf.detour);
      distanceKm = Math.max(distanceKm, 1);
      const hours = s.hours ?? distanceKm / mf.kmh + (s.mode === 'air' ? 6 : s.mode === 'reefer_ship' ? 24 : 1);
      const co2 = (distanceKm * mf.co2ePerTkm) / 1000;
      const cost = (distanceKm * mf.eurPerTkm) / 1000;
      transportCo2 += co2; transportCost += cost; km += distanceKm; days += hours / 24;
      const bm = (byMode[s.mode] ??= { km: 0, co2eKg: 0 });
      bm.km += distanceKm; bm.co2eKg += co2;
      const path = routedPath ?? (isSurface ? arcLine(from.coords, to.coords) : greatCircleLine(pts));
      steps.push({ kind: 'leg', index: i, step: s, from, to, mode: s.mode, distanceKm, hours, co2eKg: co2, costEur: cost, path, routed: !!routedPath });
    }
  }

  // Unwrap longitudes across the whole route so a New Zealand → Panama → Europe chain never jumps back across the map.
  let prev: Position | null = null;
  for (const st of steps) {
    if (st.kind === 'leg') {
      const joined = unwrap(prev ? [prev, ...st.path] : st.path);
      st.path = prev ? joined.slice(1) : joined;
      prev = st.path[st.path.length - 1];
    } else if (prev) {
      st.coords = [prev[0], prev[1]];
    }
  }

  const production = route.production.co2ePerKg;
  const shelfPerKg = (route.shelfPriceEur ?? product.shelfPriceEur) / product.pack.kg;
  const vat = shelfPerKg - shelfPerKg / (1 + VAT);
  const landed = route.farmGateEurPerKg + route.packingEurPerKg + transportCost + storageCost + handling;
  const importMargin = landed * IMPORT_MARGIN;
  const retailMargin = Math.max(0, shelfPerKg - vat - landed - importMargin);

  return {
    route, product, chain, steps, tailStart,
    co2e: { production, transport: transportCo2, storage: storageCo2, total: production + transportCo2 + storageCo2 },
    cost: { farmGate: route.farmGateEurPerKg, packing: route.packingEurPerKg, transport: transportCost, storage: storageCost, handling, importMargin, retailMargin, vat, shelf: shelfPerKg },
    totalKm: km, totalDays: days, byMode,
  };
}

export function inSeason(route: SupplyRoute, month: number): boolean {
  const { from, to } = route.season;
  return from <= to ? month >= from && month <= to : month >= from || month <= to;
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtKg(v: number) { return v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3); }
export function fmtEur(v: number) { return '€' + (v >= 10 ? v.toFixed(2) : v.toFixed(2)); }
export function fmtKm(v: number) { return Math.round(v).toLocaleString('en-GB') + ' km'; }
export function fmtDuration(hours: number) {
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${(hours / 24).toFixed(hours / 24 >= 10 ? 0 : 1)} days`;
}
