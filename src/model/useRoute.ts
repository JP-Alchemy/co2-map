import { useEffect, useMemo, useState } from 'react';
import type { Position } from 'geojson';
import { PLACES } from '../data';
import type { Chain, Place, Product, SupplyRoute } from '../types';
import { buildFullSteps, computeRoute, type ComputedRoute, type RoutedGeometry } from './compute';
import { roadGeometry } from './routing';

/** Computes a route for the given selection, upgrading truck legs to real road geometry when available. */
export function useComputedRoute(product: Product | null, route: SupplyRoute | null, chain: Chain | null, store: Place | null, useRoads: boolean): ComputedRoute | null {
  const [routed, setRouted] = useState<RoutedGeometry>({});

  const legKeys = useMemo(() => {
    if (!product || !route || !chain || !store) return [] as { key: string; from: [number, number]; to: [number, number] }[];
    const all: Record<string, Place> = { ...PLACES, [store.id]: store };
    for (const d of chain.dcs) all[d.id] = d;
    const { steps } = buildFullSteps(product, route, chain, store, all);
    const out: { key: string; from: [number, number]; to: [number, number] }[] = [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.kind !== 'leg' || !(s.mode === 'truck' || s.mode === 'reefer_truck')) continue;
      if (s.distanceKm) continue; // fixed distance → keep the arc
      const a = steps[i - 1], b = steps[i + 1];
      if (a.kind !== 'node' || b.kind !== 'node') continue;
      const from = all[a.placeId], to = all[b.placeId];
      out.push({ key: `${from.id}>${to.id}`, from: from.coords, to: to.coords });
    }
    return out;
  }, [product, route, chain, store]);

  useEffect(() => {
    if (!useRoads) return;
    let cancelled = false;
    (async () => {
      const results: Record<string, Position[] | undefined> = {};
      await Promise.all(legKeys.map(async (k) => { const g = await roadGeometry(k.from, k.to); if (g) results[k.key] = g; }));
      if (!cancelled && Object.keys(results).length) setRouted((prev) => ({ ...prev, ...results }));
    })();
    return () => { cancelled = true; };
  }, [legKeys, useRoads]);

  return useMemo(() => {
    if (!product || !route || !chain || !store) return null;
    return computeRoute(product, route, chain, store, PLACES, useRoads ? routed : {});
  }, [product, route, chain, store, routed, useRoads]);
}
