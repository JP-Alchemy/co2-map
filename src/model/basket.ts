import { CHAIN_BY_ID, PLACES, PRODUCT_BY_ID } from '../data';
import { storePlaceOf, type BasketItem, type StoreFeature } from '../store';
import type { Product, SupplyRoute } from '../types';
import { computeRoute, inSeason, pickRoute, type ComputedRoute } from './compute';
import { routeYear } from './useYear';
import { computeWaste } from './waste';

export interface BasketLine {
  item: BasketItem;
  product: Product;
  route: SupplyRoute;
  c: ComputedRoute;
  /** the origin picked for this product isn't in season this month, so the store's usual one is counted */
  pinnedOff: boolean;
  /** for all the packs of this line */
  kg: number;
  co2: number;
  eur: number;
  /** food lost on the way to put these packs on the shelf, and what that adds to the bill */
  lostKg: number;
  wasteEur: number;
  km: number;
  local: boolean;
  flown: boolean;
  /** an in-season origin at this store with a clearly lower footprint */
  swap: { route: SupplyRoute; saving: number; pct: number } | null;
  /** the month this product (as bought) has its lowest footprint, if clearly lower than now */
  season: { month: number; pct: number } | null;
  /** kg CO2e per kg for each month */
  year: number[];
}

export interface BasketResult {
  lines: BasketLine[];
  totals: { kg: number; co2: number; eur: number; lostKg: number; wasteEur: number; km: number; localShare: number; flown: number; co2PerKg: number; saving: number };
  /** the whole basket's kg CO2e if bought in each month (index 0 = January) */
  byMonth: number[];
}

/** A good first basket for someone who hasn't built their own: roughly one person's fresh shop for a week. */
export const TYPICAL_WEEK: { productId: string; packs: number }[] = [
  { productId: 'milk', packs: 2 }, { productId: 'eggs', packs: 1 }, { productId: 'banana', packs: 1 }, { productId: 'apple', packs: 1 },
  { productId: 'tomato', packs: 1 }, { productId: 'potato', packs: 1 }, { productId: 'pepper', packs: 1 }, { productId: 'chicken', packs: 1 },
];

/** Everything in the basket, priced and traced for its store in a month. */
export function computeBasket(items: BasketItem[], store: StoreFeature, month: number): BasketResult {
  const chain = CHAIN_BY_ID[store.properties.chain];
  const place = storePlaceOf(store);
  const lines: BasketLine[] = [];
  for (const item of items) {
    const product = PRODUCT_BY_ID[item.productId];
    if (!product || !chain) continue;
    const route = pickRoute(product, month, item.routeId);
    let c: ComputedRoute;
    try { c = computeRoute(product, route, chain, place, PLACES); } catch { continue; }
    const kg = product.pack.kg * item.packs;
    const w = computeWaste(c);
    // the cleanest origin this store could have this month
    let swap: BasketLine['swap'] = null;
    for (const r of product.routes) {
      // only origins in season now that this chain stocks
      if (r.id === route.id || !inSeason(r, month) || (r.chainIds && !r.chainIds.includes(chain.id))) continue;
      try {
        const alt = computeRoute(product, r, chain, place, PLACES);
        const saving = (c.co2e.total - alt.co2e.total) * kg;
        const pct = saving / (c.co2e.total * kg);
        if (pct >= 0.1 && (!swap || saving > swap.saving)) swap = { route: r, saving, pct };
      } catch { /* skip */ }
    }
    const year = routeYear(product, chain, place, item.routeId).map((m) => m.co2);
    const now = c.co2e.total;
    let best = month, bestV = now;
    year.forEach((v, i) => { if (Number.isFinite(v) && v < bestV) { best = i + 1; bestV = v; } });
    const season = best !== month && bestV < now / 1.2 ? { month: best, pct: 1 - bestV / now } : null;
    lines.push({
      item, product, route, c, pinnedOff: !!item.routeId && item.routeId !== route.id,
      kg, co2: c.co2e.total * kg, eur: c.cost.shelf * kg, lostKg: (w.harvestedKg - 1) * kg, wasteEur: w.lostEur * kg,
      km: c.totalKm, local: route.origin.country === 'NL', flown: !!c.byMode.air, swap, season, year,
    });
  }
  const sum = (f: (l: BasketLine) => number) => lines.reduce((s, l) => s + f(l), 0);
  const kg = sum((l) => l.kg), co2 = sum((l) => l.co2);
  return {
    lines,
    totals: {
      kg, co2, eur: sum((l) => l.eur), lostKg: sum((l) => l.lostKg), wasteEur: sum((l) => l.wasteEur), km: sum((l) => l.km),
      localShare: kg ? sum((l) => (l.local ? l.kg : 0)) / kg : 0, flown: lines.filter((l) => l.flown).length,
      co2PerKg: kg ? co2 / kg : 0, saving: sum((l) => l.swap?.saving ?? 0),
    },
    byMonth: Array.from({ length: 12 }, (_, m) => lines.reduce((s, l) => s + (Number.isFinite(l.year[m]) ? l.year[m] : l.c.co2e.total) * l.kg, 0)),
  };
}
