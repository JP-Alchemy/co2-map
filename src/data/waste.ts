import type { Product } from '../types';

/**
 * Food loss and waste along the chain, and where the lost food ends up.
 *
 * Loss rates are the stage-by-stage regional averages of FAO's global food loss study (Gustavsson et al. 2011,
 * the most complete dataset that splits losses by stage, region and food group). Each rate is a share of the
 * food that *enters* that stage, so they compound. They are averages for a whole region and food group, so
 * they are indicative for any one product or chain (all `extrapolated`). Where the lost food goes is our
 * estimate of typical Dutch and European practice.
 */

/** Where along the chain food is lost. */
export type WasteStage = 'farm' | 'handling' | 'retail' | 'home';
/** FAO food groups used here */
export type WasteGroup = 'fruitveg' | 'roots' | 'meat' | 'fish' | 'milk' | 'eggs';
/** FAO regions the origins fall in (the retail and home stages are always in Europe) */
export type WasteRegion = 'europe' | 'latam' | 'ssa' | 'nawca' | 'nao';

/**
 * FAO 2011 loss shares by stage: agricultural production, post-harvest handling and storage, processing and
 * packaging, distribution, consumption.
 */
interface FaoRates { production: number; postharvest: number; processing: number; distribution: number; consumption: number }
const fao = (production: number, postharvest: number, processing: number, distribution: number, consumption: number): FaoRates =>
  ({ production: production / 100, postharvest: postharvest / 100, processing: processing / 100, distribution: distribution / 100, consumption: consumption / 100 });

export const FAO_RATES: Record<WasteRegion, Partial<Record<WasteGroup, FaoRates>>> = {
  europe: {
    fruitveg: fao(20, 5, 2, 10, 19), roots: fao(20, 9, 15, 7, 17), meat: fao(3.1, 0.7, 5, 4, 11),
    fish: fao(9.4, 0.5, 6, 9, 11), milk: fao(3.5, 0.5, 1.2, 0.5, 7),
    // FAO has no separate figure for eggs: our estimate, between the milk and meat figures (cracks at grading)
    eggs: fao(3, 1, 2, 2, 7),
  },
  latam: { fruitveg: fao(20, 10, 20, 12, 10) },
  ssa: { fruitveg: fao(10, 9, 25, 17, 5) },
  nawca: { fruitveg: fao(17, 10, 20, 15, 12) },
  nao: { fruitveg: fao(20, 4, 2, 12, 28) },
};

/**
 * FAO's "processing" losses are for processing industries (canning, juicing, milling). Fresh produce is only
 * graded and packed, so for it we cap that stage at the European fresh-produce figure.
 */
export const FRESH_PACKING_CAP = 0.02;

const REGION_OF: Record<string, WasteRegion> = {
  NL: 'europe', ES: 'europe', IT: 'europe', NO: 'europe', DE: 'europe', BE: 'europe', FR: 'europe', PL: 'europe', GB: 'europe', PT: 'europe', GR: 'europe',
  BR: 'latam', EC: 'latam', PE: 'latam', CL: 'latam', CR: 'latam', CO: 'latam', AR: 'latam', MX: 'latam', DO: 'latam',
  KE: 'ssa', ZA: 'ssa', ET: 'ssa', GH: 'ssa', CI: 'ssa', SN: 'ssa',
  MA: 'nawca', EG: 'nawca', IL: 'nawca', TR: 'nawca',
  NZ: 'nao', US: 'nao', CA: 'nao', AU: 'nao',
};
export const regionOf = (country: string): WasteRegion => REGION_OF[country] ?? 'europe';
export const REGION_LABEL: Record<WasteRegion, string> = {
  europe: 'Europe', latam: 'Latin America', ssa: 'sub-Saharan Africa', nawca: 'North Africa and West Asia', nao: 'North America and Oceania',
};

export function groupOf(p: Product): WasteGroup {
  if (p.id === 'potato') return 'roots';
  if (p.category === 'meat') return 'meat';
  if (p.category === 'fish') return 'fish';
  if (p.category === 'dairy') return 'milk';
  if (p.category === 'eggs') return 'eggs';
  return 'fruitveg';
}

/** FAO rates for a group from an origin; groups with only European figures fall back to them. */
export function ratesFor(group: WasteGroup, region: WasteRegion): FaoRates {
  return FAO_RATES[region][group] ?? FAO_RATES.europe[group]!;
}

/** Where lost food ends up, best use first (after the Dutch "ladder van Moerman" food waste hierarchy). */
export type Fate = 'food' | 'processing' | 'feed' | 'rendering' | 'biogas' | 'composting' | 'soil' | 'compost' | 'burned' | 'drain';
export const FATES: Record<Fate, { label: string; icon: string; color: string; note: string }> = {
  food:       { label: 'Food banks & surplus apps', icon: '🤝', color: '#22c55e', note: 'Still eaten by people: donated to food banks (Voedselbanken) or sold off cheaply through apps.' },
  processing: { label: 'Made into other food',      icon: '🥫', color: '#84cc16', note: 'Outgraded or surplus produce turned into juice, soup, sauce or liquid egg.' },
  feed:       { label: 'Animal feed',               icon: '🐄', color: '#a3e635', note: 'Fed to cattle or pigs, or made into pet food and fish meal.' },
  rendering:  { label: 'Rendered',                  icon: '🏭', color: '#c4b5fd', note: 'Animal by-products rendered into fats and meal for industry and biofuel.' },
  biogas:     { label: 'Biogas',                    icon: '⚡', color: '#fbbf24', note: 'Fermented into biogas for heat and power; the digestate goes back on the land.' },
  composting: { label: 'Composting plant',          icon: '🪱', color: '#f59e0b', note: 'Composted at an industrial plant into soil improver for farms and gardens.' },
  soil:       { label: 'Back into the soil',        icon: '🌱', color: '#f59e0b', note: 'Left on the field or ploughed in: fruit that is too small, misshapen or unsold at harvest.' },
  compost:    { label: 'Green bin (compost)',        icon: '🍂', color: '#fb923c', note: 'Household food waste sorted into the green bin (GFT) is composted or fermented.' },
  burned:     { label: 'Burned with the rubbish',   icon: '🔥', color: '#f87171', note: 'Food in the residual waste bin is incinerated; some energy is recovered.' },
  drain:      { label: 'Down the drain',            icon: '🚿', color: '#e11d48', note: 'Liquids poured down the sink end up at the sewage works.' },
};
export const FATE_ORDER: Fate[] = ['food', 'processing', 'feed', 'rendering', 'biogas', 'composting', 'soil', 'compost', 'burned', 'drain'];

type FateSplit = Partial<Record<Fate, number>>;
/** Our estimate of where the food lost at each stage typically goes, by food group (shares add up to 1). */
export const FATE_SPLIT: Record<WasteGroup, Record<WasteStage, FateSplit>> = {
  fruitveg: {
    farm: { soil: 0.55, feed: 0.25, processing: 0.2 },
    handling: { feed: 0.4, processing: 0.2, biogas: 0.4 },
    retail: { food: 0.2, feed: 0.1, biogas: 0.5, composting: 0.05, burned: 0.15 },
    home: { compost: 0.35, burned: 0.65 },
  },
  roots: {
    farm: { soil: 0.4, feed: 0.5, processing: 0.1 },
    handling: { feed: 0.6, processing: 0.2, biogas: 0.2 },
    retail: { food: 0.15, feed: 0.2, biogas: 0.45, composting: 0.05, burned: 0.15 },
    home: { compost: 0.35, burned: 0.65 },
  },
  meat: {
    farm: { rendering: 1 },
    handling: { rendering: 0.6, feed: 0.25, biogas: 0.15 },
    retail: { food: 0.15, rendering: 0.2, biogas: 0.5, burned: 0.15 },
    home: { compost: 0.15, burned: 0.85 },
  },
  fish: {
    farm: { biogas: 0.7, rendering: 0.3 },
    handling: { feed: 0.7, biogas: 0.3 },
    retail: { food: 0.1, biogas: 0.6, burned: 0.3 },
    home: { compost: 0.15, burned: 0.85 },
  },
  milk: {
    farm: { feed: 0.6, biogas: 0.4 },
    handling: { feed: 0.5, biogas: 0.5 },
    retail: { food: 0.3, biogas: 0.6, burned: 0.1 },
    home: { drain: 0.6, burned: 0.3, compost: 0.1 },
  },
  eggs: {
    farm: { processing: 0.5, feed: 0.3, biogas: 0.2 },
    handling: { processing: 0.6, feed: 0.25, biogas: 0.15 },
    retail: { food: 0.25, biogas: 0.5, composting: 0.05, burned: 0.2 },
    home: { compost: 0.3, burned: 0.7 },
  },
};

export const STAGES: Record<WasteStage, { label: string; icon: string; color: string }> = {
  farm: { label: 'At the farm', icon: '🌾', color: '#a16207' },
  handling: { label: 'Packing, storage & transport', icon: '📦', color: '#c2410c' },
  retail: { label: 'Distribution centre & store', icon: '🏬', color: '#be123c' },
  home: { label: 'At home', icon: '🏠', color: '#7c3aed' },
};

/** Share of the retail stage's losses that happen at the distribution centre; the rest are in the store. */
export const DC_SHARE_OF_RETAIL = 0.25;

export const WASTE_SOURCE = { label: 'FAO (2011), Global food losses and food waste: extent, causes and prevention (Gustavsson et al.), annex tables', url: 'https://www.fao.org/3/mb060e/mb060e.pdf' };
