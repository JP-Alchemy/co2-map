import { DC_SHARE_OF_RETAIL, FATE_ORDER, FATE_SPLIT, FRESH_PACKING_CAP, groupOf, ratesFor, regionOf, type Fate, type WasteGroup, type WasteRegion, type WasteStage } from '../data/waste';
import type { ComputedNode, ComputedRoute } from './compute';

export interface FateKg { fate: Fate; kg: number }
/** Food lost at one stop of the journey, per kg that reaches the shelf. */
export interface WasteNode { index: number; stage: WasteStage; kg: number; fates: FateKg[] }
export interface WasteStageTotal {
  stage: WasteStage;
  /** share of what enters the stage */
  rate: number;
  /** kg lost per kg on the shelf (for the home stage: per kg bought) */
  kg: number;
  fates: FateKg[];
}

export interface Waste {
  group: WasteGroup;
  region: WasteRegion;
  /** kg harvested for every kg that reaches the shelf */
  harvestedKg: number;
  stages: WasteStageTotal[];
  nodes: WasteNode[];
  /**
   * What the food lost after harvest had already cost (farm gate, packing, freight, cooling, handling, the
   * importer), per kg sold: the chain recovers it through the price of what does sell.
   */
  lostEur: number;
  /** share of the shelf price that pays for food lost after harvest */
  priceShare: number;
  /** kg CO2e already emitted to grow, move and cool the food lost after harvest, per kg sold */
  lostCo2e: number;
  /** what the part thrown away at home cost and emitted, per kg bought */
  homeEur: number;
  homeCo2e: number;
  /** share of the harvest that is eaten */
  eatenShare: number;
  /** everything lost, harvest to plate, by where it ends up (per kg on the shelf) */
  fates: FateKg[];
}

export const fmtMass = (kg: number) => (kg < 1 ? `${Math.max(1, Math.round(kg * 1000))} g` : `${kg.toFixed(2)} kg`);

const split = (group: WasteGroup, stage: WasteStage, kg: number): FateKg[] =>
  FATE_ORDER.filter((f) => FATE_SPLIT[group][stage][f]).map((fate) => ({ fate, kg: kg * FATE_SPLIT[group][stage][fate]! }));

/**
 * Food loss and waste along a computed route, from FAO's regional loss rates. Losses compound: each stage
 * loses a share of what reaches it, so putting 1 kg on the shelf takes more than 1 kg at the farm.
 */
export function computeWaste(c: ComputedRoute): Waste {
  const group = groupOf(c.product);
  const region = regionOf(c.route.origin.country);
  const origin = ratesFor(group, region), europe = ratesFor(group, 'europe');
  const fresh = group === 'fruitveg' || group === 'roots' || group === 'eggs';
  const farm = origin.production;
  const handling = 1 - (1 - origin.postharvest) * (1 - (fresh ? Math.min(origin.processing, FRESH_PACKING_CAP) : origin.processing));
  // the shelf and the kitchen are in Europe whatever the origin
  const retail = europe.distribution;
  const home = europe.consumption;

  const nodes = c.steps.filter((s): s is ComputedNode => s.kind === 'node');
  const originNode = nodes[0];
  const retailNodes = nodes.filter((n) => n.step.role === 'dc' || n.step.role === 'store');
  let handlingNodes = nodes.filter((n) => n !== originNode && !retailNodes.includes(n));
  if (!handlingNodes.length) handlingNodes = [retailNodes[0] ?? originNode];
  const dc = retailNodes.find((n) => n.step.role === 'dc');
  const store = retailNodes.find((n) => n.step.role === 'store') ?? retailNodes[retailNodes.length - 1];

  // loss rates by step index (a stop can hold losses of more than one stage)
  const rates = new Map<number, { stage: WasteStage; rate: number }[]>();
  const add = (n: ComputedNode | undefined, stage: WasteStage, rate: number) => {
    if (!n || rate <= 0) return;
    const list = rates.get(n.index) ?? [];
    list.push({ stage, rate });
    rates.set(n.index, list);
  };
  add(originNode, 'farm', farm);
  const each = 1 - Math.pow(1 - handling, 1 / handlingNodes.length);
  for (const n of handlingNodes) add(n, 'handling', each);
  if (dc && store && dc !== store) {
    const atDc = retail * DC_SHARE_OF_RETAIL;
    add(dc, 'retail', atDc);
    add(store, 'retail', 1 - (1 - retail) / (1 - atDc));
  } else add(store ?? dc, 'retail', retail);

  const harvestedKg = 1 / ((1 - farm) * (1 - handling) * (1 - retail));
  const packing = nodes.find((n) => n.step.role === 'packing' || n.step.role === 'processing');
  const importer = nodes.find((n) => n.step.role === 'import' || n.step.role === 'ripening') ?? dc;

  // walk the route: mass arriving at each stop, and what each kilo has cost and emitted by then
  let mass = harvestedKg, eur = c.cost.farmGate, co2 = c.co2e.production, lostEur = 0, lostCo2e = 0;
  let passedPacking = false, passedImporter = false;
  const wasteNodes: WasteNode[] = [];
  const stageKg: Record<WasteStage, number> = { farm: 0, handling: 0, retail: 0, home: 0 };
  for (const s of c.steps) {
    if (s.kind === 'leg') { eur += s.costEur; co2 += s.co2eKg; continue; }
    for (const { stage, rate } of rates.get(s.index) ?? []) {
      const kg = mass * rate;
      mass -= kg;
      stageKg[stage] += kg;
      // losses at the farm are already in the farm-gate price and growing footprint per kilo sold
      if (stage !== 'farm') { lostEur += kg * eur; lostCo2e += kg * co2; }
      const prev = wasteNodes[wasteNodes.length - 1];
      if (prev && prev.index === s.index && prev.stage === stage) prev.kg += kg;
      else wasteNodes.push({ index: s.index, stage, kg, fates: [] });
    }
    eur += s.costEur; co2 += s.co2eKg;
    if (s === packing && !passedPacking) { eur += c.cost.packing; passedPacking = true; }
    if (s === importer && !passedImporter) { eur += c.cost.importMargin; passedImporter = true; }
  }
  for (const n of wasteNodes) n.fates = split(group, n.stage, n.kg);
  stageKg.home = home;

  const stages: WasteStageTotal[] = (['farm', 'handling', 'retail', 'home'] as WasteStage[]).map((stage) => ({
    stage, rate: stage === 'farm' ? farm : stage === 'handling' ? handling : stage === 'retail' ? retail : home,
    kg: stageKg[stage], fates: split(group, stage, stageKg[stage]),
  }));
  const fates = FATE_ORDER.map((fate) => ({ fate, kg: stages.reduce((s, st) => s + (st.fates.find((f) => f.fate === fate)?.kg ?? 0), 0) })).filter((f) => f.kg > 0);

  return {
    group, region, harvestedKg, stages, nodes: wasteNodes,
    lostEur, priceShare: lostEur / c.cost.shelf, lostCo2e,
    homeEur: c.cost.shelf * home, homeCo2e: c.co2e.total * home,
    eatenShare: (1 - home) / harvestedKg,
    fates,
  };
}
