import { useEffect, useMemo, useState } from 'react';
import { PLACES } from '../data';
import type { Chain, Place, Product } from '../types';
import { computeRoute, inSeason, pickRoute } from './compute';
import { buildLifecycle } from './lifecycle';

/** One month of a product's year, for the season timeline. */
export interface MonthStat {
  /** kg CO2e per kg on the shelf */
  co2: number;
  /** where most of it comes from that month */
  country: string;
  /** false when no origin is in season, so the shelf is filled from out-of-season stock */
  inSeason: boolean;
}

/** A product's year at one store: the origin you would get each month and its footprint. Cheap enough to run on hover. */
export function routeYear(product: Product, chain: Chain, place: Place, routeId?: string | null): MonthStat[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1, route = pickRoute(product, m, routeId);
    let co2 = NaN;
    try { co2 = computeRoute(product, route, chain, place, PLACES).co2e.total; } catch { /* no bar for that month */ }
    return { co2, country: route.origin.country, inSeason: product.routes.some((r) => inSeason(r, m)) };
  });
}

/** `routeYear`, kept while the product and store stay the same. */
export function useRouteYear(product: Product | null, chain: Chain, place: Place, routeId: string | null): MonthStat[] | null {
  return useMemo(() => (product ? routeYear(product, chain, place, routeId) : null), [product, chain, place, routeId]);
}

const lcYear = new Map<string, MonthStat>();
const MONTH_NUMS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * A product's year across every market it reaches (the product lens). A lifecycle takes a few milliseconds
 * to build, so the months are filled in over a few frames; each one is kept once built.
 */
export function useLifecycleYear(product: Product | null): (MonthStat | undefined)[] | null {
  const [, setBuilt] = useState(0);
  useEffect(() => {
    if (!product) return;
    let raf = 0;
    const step = () => {
      const t0 = performance.now();
      let added = 0;
      for (const m of MONTH_NUMS) {
        const key = `${product.id}|${m}`;
        if (lcYear.has(key)) continue;
        if (added && performance.now() - t0 > 6) break;
        const lc = buildLifecycle(product, m);
        const main = lc.origins.reduce((a, b) => (b.weight > a.weight ? b : a), lc.origins[0]);
        lcYear.set(key, { co2: lc.total.co2, country: main?.route.origin.country ?? '', inSeason: lc.origins.some((o) => inSeason(o.route, m)) });
        added++;
      }
      if (added) setBuilt((n) => n + added);
      if (MONTH_NUMS.some((m) => !lcYear.has(`${product.id}|${m}`))) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [product]);
  return product ? MONTH_NUMS.map((m) => lcYear.get(`${product.id}|${m}`)) : null;
}
