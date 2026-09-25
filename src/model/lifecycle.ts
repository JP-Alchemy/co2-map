import type { Position } from 'geojson';
import { CHAINS, PLACES } from '../data';
import { CROSSINGS, FOREIGN_GROCERS, MARKETS, MARKET_PLACES, NL_EXPORT, NL_SHARE, ORIGIN_MARKETS, type Market } from '../data/markets';
import type { Chain, LegStep, NodeStep, Place, Product, SupplyRoute } from '../types';
import { computeRoute, inSeason, type ComputedRoute } from './compute';

/**
 * A product's whole life in one month: every in-season origin, the point it is dispatched from, and
 * the flows from there to the grocers of six European markets. Each flow is a full modelled route
 * (origin → … → a grocer's distribution centre → a store), so CO2e, distance and time per destination
 * come from the same factors as the rest of the app.
 */

/** What the map frames: a country's or grocer's distribution, all of it ('europe'), or the whole journey (null). */
export type LcFocus = { kind: 'market' | 'grocer'; id: string } | { kind: 'europe' } | null;

export interface LcGrocer {
  id: string;
  name: string;
  market: Market;
  color: string;
  textColor: string;
  stores: number;
  /** the real chain (Netherlands) or a stand-in built from the market data */
  chain: Chain;
  dcs: Place[];
  /** within its market */
  share: number;
}

export interface Flow {
  key: string;
  route: SupplyRoute;
  grocer: LcGrocer;
  dc: Place;
  /** share of the product's total volume that month, 0..1 */
  volume: number;
  computed: ComputedRoute;
  /** origin → dispatch point, and dispatch point → distribution centre */
  inbound: Position[];
  outbound: Position[];
}

export interface LcOrigin { route: SupplyRoute; weight: number; co2: number; dispatch: Place; inbound: Position[]; computed: ComputedRoute }
export interface LcGrocerTotal { grocer: LcGrocer; volume: number; co2: number; km: number; days: number; flow: Flow }
export interface LcMarket { market: Market; volume: number; co2: number; km: number; days: number; grocers: LcGrocerTotal[] }

export interface Lifecycle {
  product: Product;
  month: number;
  origins: LcOrigin[];
  flows: Flow[];
  markets: LcMarket[];
  /** packhouses, ports, importers and crossings the product passes */
  hubs: Place[];
  total: { co2: number; km: number; days: number; grocers: number; markets: number; stores: number };
}

const ALL_PLACES: Record<string, Place> = { ...PLACES, ...MARKET_PLACES };

const n = (placeId: string, role: NodeStep['role'], days: number, note?: string): NodeStep => ({ kind: 'node', placeId, role, days, storage: 'chilled', note });
const l = (mode: LegStep['mode'], extra: Omit<LegStep, 'kind' | 'mode'> = {}): LegStep => ({ kind: 'leg', mode, ...extra });

/** The grocers of every market: the five Dutch chains as modelled elsewhere, and stand-ins for the rest. */
export const LC_GROCERS: LcGrocer[] = [
  ...CHAINS.map((c) => {
    const fresh = c.dcs.filter((d) => d.fresh);
    return { id: c.id, name: c.name, market: 'NL' as Market, color: c.color, textColor: c.textColor, stores: c.approxStores, chain: c, dcs: fresh.length ? fresh : c.dcs, share: NL_SHARE[c.id] ?? 0.05 };
  }),
  ...FOREIGN_GROCERS.map((g) => ({
    id: g.id, name: g.name, market: g.market, color: g.color, textColor: g.textColor, stores: g.stores, dcs: [g.dc], share: g.share,
    chain: {
      id: g.id, name: g.name, parent: '', color: g.color, textColor: g.textColor, hq: g.dc, dcs: [{ ...g.dc, fresh: true }],
      freshSupply: { description: 'Distribution drawn at one representative location in the chain’s main region.', confidence: 'extrapolated' as const },
      description: '', approxStores: g.stores,
    },
  })),
];

/** A store a few kilometres from a distribution centre, standing in for all the stores it serves. */
function storeNear(g: LcGrocer, dc: Place): Place {
  const town = dc.name.split(/,\s*/).slice(1).join(', ').replace(/ region$/, '') || dc.name;
  return { id: `lcstore_${dc.id}`, name: `${g.name} store, ${town}`, kind: 'store', country: dc.country, coords: [dc.coords[0] + 0.04, dc.coords[1] + 0.025], confidence: 'extrapolated' };
}

/** Steps from a dispatch point to a foreign grocer's distribution centre: straight by lorry, or across the Channel to Britain. */
function exportTail(dispatch: Place, g: LcGrocer, dc: Place): (NodeStep | LegStep)[] {
  if (g.market !== 'GB') return [l('reefer_truck'), n(dc.id, 'dc', 1, 'Received at the distribution centre and picked per store order.')];
  const viaCalais = dispatch.coords[0] < 3.5;
  const [from, to] = viaCalais ? [CROSSINGS.calais, CROSSINGS.dover] : [CROSSINGS.hook_of_holland, CROSSINGS.harwich];
  return [
    l('reefer_truck'),
    n(from.id, 'port', 0.1, viaCalais ? 'The trailer boards a short-sea ferry across the Channel.' : 'The trailer rolls onto the overnight ferry to Harwich.'),
    l('ferry', { hours: viaCalais ? 1.5 : 7 }),
    n(to.id, 'port', 0.1, 'Customs and plant-health checks for goods entering Great Britain.'),
    l('reefer_truck'),
    n(dc.id, 'dc', 1, 'Received at the distribution centre and picked per store order.'),
  ];
}

function legPoints(c: ComputedRoute, from: number, to: number): Position[] {
  const out: Position[] = [];
  for (const s of c.steps) {
    if (s.kind !== 'leg' || s.index < from || s.index >= to) continue;
    out.push(...(out.length ? s.path.slice(1) : s.path));
  }
  return out;
}

/** How a route's volume splits across the six markets. */
function marketSplit(product: Product, route: SupplyRoute, dispatch: Place): Partial<Record<Market, number>> {
  if (dispatch.country !== 'NL') return ORIGIN_MARKETS[route.id] ?? { NL: 1 };
  const ex = NL_EXPORT[product.id];
  if (!ex) return { NL: 1 };
  const split: Partial<Record<Market, number>> = { NL: 1 - ex.abroad };
  for (const [m, v] of Object.entries(ex.to) as [Market, number][]) split[m] = (split[m] ?? 0) + ex.abroad * v;
  return split;
}

const cache = new Map<string, Lifecycle>();

export function buildLifecycle(product: Product, month: number): Lifecycle {
  const key = `${product.id}|${month}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const live = product.routes.filter((r) => inSeason(r, month));
  const routes = live.length ? live : product.routes;
  const shareSum = routes.reduce((s, r) => s + r.share, 0) || 1;

  const origins: LcOrigin[] = [];
  const flows: Flow[] = [];
  for (const route of routes) {
    const weight = route.share / shareSum;
    const last = route.steps[route.steps.length - 1] as NodeStep;
    const dispatch = ALL_PLACES[last.placeId];
    const split = marketSplit(product, route, dispatch);
    const cut = route.steps.length; // steps before this belong to the route, the rest to the destination
    for (const m of MARKETS) {
      const mShare = split[m.id] ?? 0;
      if (mShare <= 0) continue;
      const grocers = LC_GROCERS.filter((g) => g.market === m.id && (!route.chainIds || m.id !== 'NL' || route.chainIds.includes(g.id)));
      const gSum = grocers.reduce((s, g) => s + g.share, 0) || 1;
      for (const g of grocers) {
        for (const dc of g.dcs) {
          const volume = (weight * mShare * g.share) / gSum / g.dcs.length;
          const store = storeNear(g, dc);
          const r2: SupplyRoute = m.id === 'NL' ? route : { ...route, steps: [...route.steps, ...exportTail(dispatch, g, dc)] };
          let computed: ComputedRoute;
          try { computed = computeRoute(product, r2, g.chain, store, ALL_PLACES); } catch { continue; }
          const legs = computed.steps.filter((s) => s.kind === 'leg');
          const storeLeg = legs[legs.length - 1].index;
          flows.push({ key: `${route.id}>${g.id}>${dc.id}`, route, grocer: g, dc, volume, computed, inbound: legPoints(computed, 0, cut), outbound: legPoints(computed, cut, storeLeg) });
        }
      }
    }
    const own = flows.filter((f) => f.route.id === route.id);
    const vol = own.reduce((s, f) => s + f.volume, 0) || 1;
    if (own.length) origins.push({ route, weight, dispatch, inbound: own[0].inbound, computed: own[0].computed, co2: own.reduce((s, f) => s + f.volume * f.computed.co2e.total, 0) / vol });
  }

  // totals by market and by grocer
  const avg = (fs: Flow[], pick: (c: ComputedRoute) => number) => {
    const v = fs.reduce((s, f) => s + f.volume, 0) || 1;
    return fs.reduce((s, f) => s + f.volume * pick(f.computed), 0) / v;
  };
  const markets: LcMarket[] = [];
  for (const m of MARKETS) {
    const fs = flows.filter((f) => f.grocer.market === m.id);
    if (!fs.length) continue;
    const grocers: LcGrocerTotal[] = [];
    for (const g of LC_GROCERS.filter((x) => x.market === m.id)) {
      const gf = fs.filter((f) => f.grocer.id === g.id);
      if (!gf.length) continue;
      grocers.push({ grocer: g, volume: gf.reduce((s, f) => s + f.volume, 0), co2: avg(gf, (c) => c.co2e.total), km: avg(gf, (c) => c.totalKm), days: avg(gf, (c) => c.totalDays), flow: [...gf].sort((a, b) => b.volume - a.volume)[0] });
    }
    grocers.sort((a, b) => b.volume - a.volume);
    markets.push({ market: m.id, volume: fs.reduce((s, f) => s + f.volume, 0), co2: avg(fs, (c) => c.co2e.total), km: avg(fs, (c) => c.totalKm), days: avg(fs, (c) => c.totalDays), grocers });
  }
  markets.sort((a, b) => b.volume - a.volume);

  const hubs = new Map<string, Place>();
  for (const f of flows) for (const s of f.computed.steps) if (s.kind === 'node' && !['origin', 'dc', 'store'].includes(s.step.role)) hubs.set(s.place.id, s.place);

  const lc: Lifecycle = {
    product, month, origins, flows, markets, hubs: [...hubs.values()],
    total: {
      co2: avg(flows, (c) => c.co2e.total), km: avg(flows, (c) => c.totalKm), days: avg(flows, (c) => c.totalDays),
      grocers: new Set(flows.map((f) => f.grocer.id)).size, markets: markets.length,
      stores: [...new Map(flows.map((f) => [f.grocer.id, f.grocer.stores])).values()].reduce((s, v) => s + v, 0),
    },
  };
  cache.set(key, lc);
  return lc;
}
