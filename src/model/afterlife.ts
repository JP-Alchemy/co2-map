import { FUEL_CO2E_PER_L, MODES } from '../data/factors';
import { ELECTRIC_TRUCK, FACILITIES, FATE_FACILITY, FEED_PROCESSOR_KM, SHELF_LIFE, TREATMENT, type Facility, type ShelfLife } from '../data/afterlife';
import { FATE_SPLIT, groupOf, type Fate } from '../data/waste';
import type { ComputedNode, ComputedRoute } from './compute';
import { haversineKm } from './geo';
import { computeWaste } from './waste';

const roadKm = (a: [number, number], b: [number, number]) => haversineKm(a, b) * MODES.truck.detour;

export interface AfterlifeDest {
  fate: Fate;
  /** share of the unsold food */
  share: number;
  facility: Facility | null;
  /** DC → plant by road (0 for what is collected at the store) */
  km: number;
  /** the whole trip from the store, per kg of unsold food */
  tripKm: number;
  co2eTransport: number;
  fuelMl: number;
  treatment: number;
  kWh: number;
}

export interface Afterlife {
  shelf: ShelfLife | null;
  /** kg left unsold in the store for every kg sold */
  unsoldKg: number;
  store: { name: string; coords: [number, number] };
  dc: { name: string; coords: [number, number] } | null;
  /** store → DC, riding back on the delivery truck */
  backhaulKm: number;
  dests: AfterlifeDest[];
  /** per kg of unsold food, over all destinations */
  perKg: { km: number; fuelMl: number; co2eTransport: number; co2eElectric: number; kWhElectric: number; treatment: number; energyKWh: number; landfillCo2e: number };
}

function nearest(kind: Facility['kinds'][number], from: [number, number]) {
  let best: Facility | null = null, bestKm = Infinity;
  for (const f of FACILITIES) {
    if (!f.kinds.includes(kind)) continue;
    const km = haversineKm(from, f.coords);
    if (km < bestKm) { best = f; bestKm = km; }
  }
  return best;
}

/**
 * What happens to the food a store doesn't sell: rescued in the store, or taken back to the DC and on to the
 * nearest plant of the right kind, with the kilometres, diesel and CO2e of getting it there and of treating it.
 */
export function computeAfterlife(c: ComputedRoute): Afterlife {
  const nodes = c.steps.filter((s): s is ComputedNode => s.kind === 'node');
  const storeNode = nodes[nodes.length - 1];
  const dcNode = [...nodes].reverse().find((n) => n.step.role === 'dc') ?? null;
  const store = { name: storeNode.place.name, coords: storeNode.place.coords };
  const dc = dcNode ? { name: dcNode.place.name, coords: dcNode.place.coords } : null;
  const hub = dc ?? store;
  const backhaulKm = dc ? roadKm(store.coords, dc.coords) : 0;

  const w = computeWaste(c);
  const unsoldKg = w.nodes.filter((n) => n.index === storeNode.index && n.stage === 'retail').reduce((s, n) => s + n.kg, 0);
  const split = FATE_SPLIT[groupOf(c.product)].retail;
  const perTkm = MODES.truck.co2ePerTkm;

  const dests: AfterlifeDest[] = (Object.entries(split) as [Fate, number][]).map(([fate, share]) => {
    const kind = FATE_FACILITY[fate];
    const facility = kind ? nearest(kind, hub.coords) : null;
    // food banks and surplus-app shoppers collect at the store; everything else rides back to the DC first
    const local = fate === 'food';
    const km = local ? 0 : facility ? roadKm(hub.coords, facility.coords) : fate === 'feed' ? FEED_PROCESSOR_KM : 0;
    const tripKm = local ? 0 : backhaulKm + km;
    const co2eTransport = (tripKm * perTkm) / 1000;
    const t = TREATMENT[fate] ?? { co2e: 0, kWh: 0 };
    return { fate, share, facility, km, tripKm, co2eTransport, fuelMl: (co2eTransport / FUEL_CO2E_PER_L) * 1000, treatment: t.co2e, kWh: t.kWh };
  });

  const avg = (f: (d: AfterlifeDest) => number) => dests.reduce((s, d) => s + d.share * f(d), 0);
  const km = avg((d) => d.tripKm);
  return {
    shelf: SHELF_LIFE[c.product.id] ?? null,
    unsoldKg, store, dc, backhaulKm, dests,
    perKg: {
      km, fuelMl: avg((d) => d.fuelMl), co2eTransport: avg((d) => d.co2eTransport),
      co2eElectric: (km * ELECTRIC_TRUCK.co2ePerTkm) / 1000, kWhElectric: (km * ELECTRIC_TRUCK.kWhPerTkm) / 1000,
      treatment: avg((d) => d.treatment), energyKWh: avg((d) => d.kWh), landfillCo2e: TREATMENT.landfill!.co2e,
    },
  };
}
