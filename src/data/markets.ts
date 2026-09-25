import type { Confidence, Place } from '../types';

/**
 * Where a product goes after it is grown or lands in Europe: six markets and their main grocers.
 *
 * This is a teaching model, not trade data. Market shares are rounded public figures for each country's
 * grocery market; the export splits per product are indicative, in line with the order of magnitude of
 * Dutch trade statistics (CBS StatLine, GroentenFruit Huis). Foreign grocers are drawn at one
 * representative distribution location each: a real place in the chain's main region, not a confirmed
 * link for a specific product. Everything here is labelled `extrapolated` or `likely` accordingly.
 */

export type Market = 'NL' | 'DE' | 'BE' | 'GB' | 'FR' | 'SE';

export const MARKETS: { id: Market; name: string; color: string }[] = [
  { id: 'NL', name: 'Netherlands', color: '#fb923c' },
  { id: 'DE', name: 'Germany', color: '#facc15' },
  { id: 'BE', name: 'Belgium', color: '#f472b6' },
  { id: 'GB', name: 'United Kingdom', color: '#60a5fa' },
  { id: 'FR', name: 'France', color: '#a78bfa' },
  { id: 'SE', name: 'Sweden', color: '#34d399' },
];
export const MARKET_BY_ID = Object.fromEntries(MARKETS.map((m) => [m.id, m])) as Record<Market, (typeof MARKETS)[number]>;

/** Share of each Dutch chain in the Dutch grocery market (2024, rounded). The five chains shown hold about 80%. */
export const NL_SHARE: Record<string, number> = { ah: 0.375, jumbo: 0.218, lidl: 0.111, plus: 0.056, aldi: 0.049 };

export interface Grocer {
  id: string;
  name: string;
  market: Market;
  color: string;
  textColor: string;
  /** rounded share of the national grocery market */
  share: number;
  /** rounded number of stores */
  stores: number;
  /** representative distribution location */
  dc: Place;
}

const dc = (id: string, name: string, country: string, coords: [number, number], confidence: Confidence = 'extrapolated'): Place =>
  ({ id, name, kind: 'dc', country, coords, confidence, note: 'Representative distribution location in the chain’s main region; not a confirmed supplier link for this product.' });

export const FOREIGN_GROCERS: Grocer[] = [
  { id: 'edeka', name: 'EDEKA', market: 'DE', color: '#ffd400', textColor: '#1a3e8c', share: 0.26, stores: 11000, dc: dc('dc_edeka_moers', 'EDEKA Rhein-Ruhr, Moers', 'DE', [6.63, 51.45], 'likely') },
  { id: 'rewe', name: 'REWE', market: 'DE', color: '#cc071e', textColor: '#ffffff', share: 0.21, stores: 6000, dc: dc('dc_rewe_koeln', 'REWE, Cologne region', 'DE', [6.96, 50.94]) },
  { id: 'schwarz', name: 'Lidl & Kaufland', market: 'DE', color: '#0050aa', textColor: '#fff000', share: 0.23, stores: 4000, dc: dc('dc_schwarz_neckarsulm', 'Lidl & Kaufland, Neckarsulm region', 'DE', [9.22, 49.19]) },
  { id: 'aldi_de', name: 'ALDI Nord & Süd', market: 'DE', color: '#00005f', textColor: '#ffffff', share: 0.17, stores: 4000, dc: dc('dc_aldi_muelheim', 'ALDI Süd, Mülheim an der Ruhr region', 'DE', [6.88, 51.43]) },
  { id: 'colruyt', name: 'Colruyt', market: 'BE', color: '#ef7d00', textColor: '#ffffff', share: 0.29, stores: 250, dc: dc('dc_colruyt_halle', 'Colruyt, Halle', 'BE', [4.24, 50.73], 'likely') },
  { id: 'delhaize', name: 'Delhaize', market: 'BE', color: '#e21a2c', textColor: '#ffffff', share: 0.21, stores: 750, dc: dc('dc_delhaize_zellik', 'Delhaize, Zellik', 'BE', [4.27, 50.89], 'likely') },
  { id: 'carrefour_be', name: 'Carrefour Belgium', market: 'BE', color: '#1e5bc6', textColor: '#ffffff', share: 0.18, stores: 700, dc: dc('dc_carrefour_evere', 'Carrefour Belgium, Brussels region', 'BE', [4.40, 50.87]) },
  { id: 'tesco', name: 'Tesco', market: 'GB', color: '#00539f', textColor: '#ffffff', share: 0.27, stores: 2900, dc: dc('dc_tesco_daventry', 'Tesco, Daventry', 'GB', [-1.16, 52.26], 'likely') },
  { id: 'sainsburys', name: 'Sainsbury’s', market: 'GB', color: '#f06c00', textColor: '#ffffff', share: 0.15, stores: 1400, dc: dc('dc_sainsburys_hamshall', 'Sainsbury’s, Hams Hall', 'GB', [-1.72, 52.52], 'likely') },
  { id: 'asda', name: 'Asda', market: 'GB', color: '#68a51c', textColor: '#ffffff', share: 0.13, stores: 1200, dc: dc('dc_asda_lutterworth', 'Asda, Lutterworth', 'GB', [-1.20, 52.45], 'likely') },
  { id: 'aldi_uk', name: 'Aldi UK', market: 'GB', color: '#00005f', textColor: '#ffffff', share: 0.10, stores: 1000, dc: dc('dc_aldi_atherstone', 'Aldi UK, Atherstone', 'GB', [-1.55, 52.58], 'likely') },
  { id: 'leclerc', name: 'E.Leclerc', market: 'FR', color: '#0066b3', textColor: '#ffffff', share: 0.23, stores: 730, dc: dc('dc_leclerc_ivry', 'E.Leclerc, Paris region', 'FR', [2.39, 48.81]) },
  { id: 'carrefour_fr', name: 'Carrefour', market: 'FR', color: '#1e5bc6', textColor: '#ffffff', share: 0.20, stores: 5000, dc: dc('dc_carrefour_massy', 'Carrefour, Massy', 'FR', [2.28, 48.73]) },
  { id: 'intermarche', name: 'Intermarché', market: 'FR', color: '#e30613', textColor: '#ffffff', share: 0.15, stores: 1800, dc: dc('dc_intermarche_bondoufle', 'Intermarché, Bondoufle', 'FR', [2.38, 48.61]) },
  { id: 'auchan', name: 'Auchan', market: 'FR', color: '#d6001c', textColor: '#ffffff', share: 0.09, stores: 600, dc: dc('dc_auchan_croix', 'Auchan, Lille region', 'FR', [3.15, 50.68]) },
  { id: 'ica', name: 'ICA', market: 'SE', color: '#e3000b', textColor: '#ffffff', share: 0.51, stores: 1250, dc: dc('dc_ica_helsingborg', 'ICA, Helsingborg', 'SE', [12.70, 56.05], 'likely') },
  { id: 'axfood', name: 'Axfood (Willys, Hemköp)', market: 'SE', color: '#111827', textColor: '#ffffff', share: 0.22, stores: 450, dc: dc('dc_axfood_goteborg', 'Axfood, Gothenburg region', 'SE', [11.98, 57.75]) },
  { id: 'coop_se', name: 'Coop Sverige', market: 'SE', color: '#00a94f', textColor: '#ffffff', share: 0.17, stores: 800, dc: dc('dc_coop_bro', 'Coop Sverige, Bro', 'SE', [17.64, 59.51], 'likely') },
];

/** Ferry ports for lorries to Great Britain. */
export const CROSSINGS: Record<string, Place> = {
  hook_of_holland: { id: 'hook_of_holland', name: 'Hook of Holland ferry terminal', kind: 'port', country: 'NL', coords: [4.13, 51.98], confidence: 'verified' },
  harwich: { id: 'harwich', name: 'Harwich International', kind: 'port', country: 'GB', coords: [1.28, 51.95], confidence: 'verified' },
  calais: { id: 'calais', name: 'Port of Calais', kind: 'port', country: 'FR', coords: [1.86, 50.97], confidence: 'verified' },
  dover: { id: 'dover', name: 'Port of Dover', kind: 'port', country: 'GB', coords: [1.33, 51.12], confidence: 'verified' },
};

/** Every place this file adds, for the route model. */
export const MARKET_PLACES: Record<string, Place> = {
  ...CROSSINGS,
  ...Object.fromEntries(FOREIGN_GROCERS.map((g) => [g.dc.id, g.dc])),
};

type Split = Partial<Record<Market, number>>;

/**
 * For produce dispatched from the Netherlands (grown here, or landed and handled here): the share that
 * goes on to other countries, and how that export splits between them. Indicative (extrapolated).
 */
export const NL_EXPORT: Record<string, { abroad: number; to: Split }> = {
  tomato: { abroad: 0.8, to: { DE: 0.55, GB: 0.15, SE: 0.12, FR: 0.1, BE: 0.08 } },
  pepper: { abroad: 0.85, to: { DE: 0.5, GB: 0.18, FR: 0.12, SE: 0.1, BE: 0.1 } },
  strawberry: { abroad: 0.35, to: { DE: 0.5, BE: 0.25, GB: 0.1, FR: 0.1, SE: 0.05 } },
  apple: { abroad: 0.35, to: { DE: 0.35, GB: 0.2, SE: 0.2, BE: 0.15, FR: 0.1 } },
  potato: { abroad: 0.45, to: { BE: 0.4, DE: 0.3, FR: 0.15, GB: 0.1, SE: 0.05 } },
  banana: { abroad: 0.55, to: { DE: 0.6, BE: 0.1, SE: 0.1, FR: 0.1, GB: 0.1 } },
  avocado: { abroad: 0.75, to: { DE: 0.35, FR: 0.2, GB: 0.15, SE: 0.15, BE: 0.15 } },
  blueberry: { abroad: 0.6, to: { DE: 0.4, GB: 0.25, SE: 0.15, BE: 0.1, FR: 0.1 } },
  mango: { abroad: 0.7, to: { DE: 0.4, FR: 0.2, GB: 0.15, BE: 0.15, SE: 0.1 } },
  beans: { abroad: 0.45, to: { DE: 0.35, GB: 0.3, BE: 0.15, FR: 0.1, SE: 0.1 } },
  orange: { abroad: 0.3, to: { DE: 0.5, BE: 0.15, SE: 0.15, GB: 0.1, FR: 0.1 } },
  grapes: { abroad: 0.45, to: { DE: 0.4, GB: 0.25, SE: 0.15, BE: 0.1, FR: 0.1 } },
  kiwi: { abroad: 0.4, to: { DE: 0.4, BE: 0.2, FR: 0.15, SE: 0.15, GB: 0.1 } },
  salmon: { abroad: 0.4, to: { DE: 0.45, BE: 0.35, FR: 0.15, SE: 0.05 } },
  chicken: { abroad: 0.7, to: { DE: 0.5, GB: 0.25, BE: 0.15, FR: 0.1 } },
  milk: { abroad: 0.1, to: { BE: 0.6, DE: 0.4 } },
  eggs: { abroad: 0.65, to: { DE: 0.75, BE: 0.1, GB: 0.05, FR: 0.05, SE: 0.05 } },
};

/**
 * For routes dispatched outside the Netherlands (a Spanish packhouse, the Zespri terminal in Zeebrugge):
 * how that origin's supply splits across the six markets, the Netherlands included. Indicative.
 */
export const ORIGIN_MARKETS: Record<string, Split> = {
  tomato_es: { DE: 0.35, FR: 0.2, GB: 0.2, NL: 0.12, SE: 0.08, BE: 0.05 },
  pepper_es: { DE: 0.4, GB: 0.2, FR: 0.15, NL: 0.12, SE: 0.08, BE: 0.05 },
  strawberry_es: { DE: 0.4, FR: 0.25, GB: 0.15, NL: 0.1, BE: 0.05, SE: 0.05 },
  orange_es: { DE: 0.35, FR: 0.35, GB: 0.1, NL: 0.1, BE: 0.05, SE: 0.05 },
  kiwi_nz: { DE: 0.3, NL: 0.2, BE: 0.15, FR: 0.15, GB: 0.1, SE: 0.1 },
};
