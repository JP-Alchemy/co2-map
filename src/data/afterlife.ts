import type { Fate } from './waste';

/**
 * What happens to food that is not bought: how long it lasts on the shelf, what a store does before throwing
 * it away, the plants that take what is left, and what treating it emits and recovers. Store practice and
 * the treatment figures are typical values (`extrapolated`); the plants are real, at approximate locations,
 * and which one a store's waste goes to is our assumption (the nearest of its kind to the chain's DC).
 */

export type ShelfLimit = 'use-by' | 'best-before' | 'quality';
export interface ShelfLife { days: number; limit: ShelfLimit; note: string }

/** Typical number of days a product can stay on the shelf before it is pulled. */
export const SHELF_LIFE: Record<string, ShelfLife> = {
  tomato: { days: 5, limit: 'quality', note: 'Checked every morning; soft or split tomatoes are taken off the shelf.' },
  pepper: { days: 7, limit: 'quality', note: 'Peppers go once they start to wrinkle or get soft spots.' },
  strawberry: { days: 2, limit: 'quality', note: 'Mould spreads fast: a punnet with one bad berry is pulled.' },
  apple: { days: 14, limit: 'quality', note: 'Apples keep well; bruised or wrinkled ones are sorted out.' },
  potato: { days: 21, limit: 'quality', note: 'Green or sprouting potatoes are pulled.' },
  banana: { days: 4, limit: 'quality', note: 'Sold from yellow with green tips to fully yellow; bunches with brown spots go.' },
  avocado: { days: 4, limit: 'quality', note: 'Ripe-and-ready avocados have only a few days before they turn.' },
  blueberry: { days: 5, limit: 'quality', note: 'Punnets are checked for soft or mouldy berries.' },
  mango: { days: 5, limit: 'quality', note: 'Sea-freighted mangoes ripen on the shelf; over-ripe ones go.' },
  beans: { days: 4, limit: 'quality', note: 'Fine beans lose their snap within a few days.' },
  orange: { days: 14, limit: 'quality', note: 'Citrus keeps for weeks; the odd mouldy fruit is sorted out.' },
  grapes: { days: 5, limit: 'quality', note: 'Loose or brown grapes are sorted out.' },
  kiwi: { days: 10, limit: 'quality', note: 'Kiwifruit soften slowly and keep well.' },
  salmon: { days: 4, limit: 'use-by', note: 'Fresh fish carries a use-by date ("te gebruiken tot") and must be off the shelf by then.' },
  chicken: { days: 5, limit: 'use-by', note: 'Fresh chicken carries a use-by date ("te gebruiken tot") and must be off the shelf by then.' },
  milk: { days: 8, limit: 'best-before', note: 'Dutch fresh milk carries a best-before date ("ten minste houdbaar tot").' },
  eggs: { days: 21, limit: 'best-before', note: 'EU rules: eggs reach the shopper within 21 days of laying; the best-before date is 28 days.' },
};
export const LIMIT_LABEL: Record<ShelfLimit, string> = { 'use-by': 'use-by date', 'best-before': 'best-before date', quality: 'freshness' };

/** What a Dutch supermarket typically tries before food is thrown away, in order. */
export const RESCUE: { icon: string; label: string; note: string }[] = [
  { icon: '🏷️', label: 'Reduced', note: 'Near the end of its shelf life it gets a discount sticker.' },
  { icon: '🥡', label: 'Surplus apps', note: 'At closing time leftovers go into surprise bags sold through apps such as Too Good To Go.' },
  { icon: '🤝', label: 'Food bank', note: 'What is still good is collected by the local food bank (Voedselbank) or a charity.' },
  { icon: '🚛', label: 'Back to the DC', note: 'The rest goes into waste bins that ride back to the distribution centre on the delivery truck.' },
  { icon: '🏭', label: 'To a plant', note: 'A waste company collects it at the DC, strips the packaging and takes it to a biogas plant, composter, renderer or incinerator.' },
];

export type FacilityKind = 'digestion' | 'composting' | 'incineration' | 'rendering';
export interface Facility { id: string; name: string; town: string; kinds: FacilityKind[]; coords: [number, number] }

/** Waste plants in the Netherlands (locations approximate, to the town). */
export const FACILITIES: Facility[] = [
  // food waste and GFT fermentation (biogas), and industrial composting
  { id: 'meerlanden', name: 'Meerlanden', town: 'Rijsenhout', kinds: ['digestion'], coords: [4.698, 52.259] },
  { id: 'hvc_middenmeer', name: 'HVC', town: 'Middenmeer', kinds: ['digestion'], coords: [5.005, 52.805] },
  { id: 'attero_wilp', name: 'Attero', town: 'Wilp', kinds: ['digestion', 'composting'], coords: [6.134, 52.236] },
  { id: 'attero_venlo', name: 'Attero', town: 'Venlo', kinds: ['digestion', 'composting'], coords: [6.135, 51.390] },
  // rendering of animal by-products
  { id: 'rendac', name: 'Rendac', town: 'Son en Breugel', kinds: ['rendering'], coords: [5.475, 51.508] },
  // waste-to-energy incinerators
  { id: 'aeb', name: 'AEB', town: 'Amsterdam', kinds: ['incineration'], coords: [4.829, 52.403] },
  { id: 'avr_rozenburg', name: 'AVR', town: 'Rozenburg', kinds: ['incineration'], coords: [4.264, 51.899] },
  { id: 'avr_duiven', name: 'AVR', town: 'Duiven', kinds: ['incineration'], coords: [6.028, 51.952] },
  { id: 'hvc_alkmaar', name: 'HVC', town: 'Alkmaar', kinds: ['incineration'], coords: [4.776, 52.645] },
  { id: 'hvc_dordrecht', name: 'HVC', town: 'Dordrecht', kinds: ['incineration'], coords: [4.648, 51.802] },
  { id: 'twence', name: 'Twence', town: 'Hengelo', kinds: ['incineration'], coords: [6.825, 52.270] },
  { id: 'attero_moerdijk', name: 'Attero', town: 'Moerdijk', kinds: ['incineration'], coords: [4.602, 51.692] },
  { id: 'attero_wijster', name: 'Attero', town: 'Wijster', kinds: ['incineration'], coords: [6.522, 52.800] },
  { id: 'arn', name: 'ARN', town: 'Weurt', kinds: ['incineration'], coords: [5.813, 51.854] },
  { id: 'rec', name: 'REC', town: 'Harlingen', kinds: ['incineration'], coords: [5.435, 53.165] },
  { id: 'eew', name: 'EEW', town: 'Delfzijl', kinds: ['incineration'], coords: [6.955, 53.312] },
];

/** Which kind of plant each destination needs; null: handled locally or by a processor we don't place on the map. */
export const FATE_FACILITY: Partial<Record<Fate, FacilityKind>> = { biogas: 'digestion', composting: 'composting', burned: 'incineration', rendering: 'rendering' };
/** Animal feed goes to a regional processor we don't place; this is our round-number estimate of the trip. */
export const FEED_PROCESSOR_KM = 50;

/**
 * Indicative emissions of treating a kilo of food waste (kg CO2e, excluding the biogenic CO2 of the food itself)
 * and the electricity it gives back (kWh), in the range of European waste LCA studies.
 */
export const TREATMENT: Partial<Record<Fate | 'landfill', { co2e: number; kWh: number; what: string }>> = {
  food: { co2e: 0, kWh: 0, what: 'eaten after all' },
  feed: { co2e: 0.01, kWh: 0, what: 'replaces other feed' },
  rendering: { co2e: 0.05, kWh: 0.15, what: 'fats become biofuel, the rest meal' },
  biogas: { co2e: 0.03, kWh: 0.25, what: 'biogas for power and heat, digestate as fertiliser' },
  composting: { co2e: 0.06, kWh: 0, what: 'about 0.4 kg of compost' },
  burned: { co2e: 0.03, kWh: 0.1, what: 'wet food burns poorly, so little energy' },
  landfill: { co2e: 0.7, kWh: 0.03, what: 'rots into methane, a strong greenhouse gas' },
};

/** A battery-electric rigid truck: about 1.1 kWh per km at an average 8 t load, on the Dutch grid mix (~0.3 kg CO2e per kWh). */
export const ELECTRIC_TRUCK = { kWhPerTkm: 0.14, co2ePerTkm: 0.042 };
/** Energy to charge a smartphone once, for comparisons */
export const PHONE_CHARGE_KWH = 0.015;
