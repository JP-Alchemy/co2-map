import type { Chain } from '../types';
import coords from './coords.json';

const C = coords as unknown as Record<string, [number, number]>;
const dc = (id: string, name: string, fresh = true, confidence: 'verified' | 'likely' = 'verified', note?: string) =>
  ({ id, name, kind: 'dc' as const, country: 'NL', coords: C[id], confidence, fresh, note });
const hq = (id: string, name: string) => ({ id, name, kind: 'hq' as const, country: 'NL', coords: C[id], confidence: 'verified' as const });

export const CHAINS: Chain[] = [
  {
    id: 'ah', name: 'Albert Heijn', parent: 'Ahold Delhaize', color: '#00ade6', textColor: '#ffffff',
    hq: hq('ah_hq', 'Albert Heijn head office, Zaandam'),
    dcs: [
      dc('ah_dc_zaandam', 'AH distribution centre Zaandam'),
      dc('ah_dc_pijnacker', 'AH distribution centre Pijnacker'),
      dc('ah_dc_geldermalsen', 'AH distribution centre Geldermalsen'),
      dc('ah_dc_tilburg', 'AH distribution centre Tilburg'),
      dc('ah_dc_zwolle', 'AH distribution centre Zwolle'),
      dc('ah_dc_nieuwegein', 'AH distribution centre Nieuwegein', true, 'likely'),
    ],
    freshSupply: { placeId: 'bakker_barendrecht', confidence: 'likely', description: 'Fruit and vegetables are bought and consolidated by Bakker Barendrecht in Ridderkerk, which delivers to the regional AH distribution centres.' },
    description: 'The largest Dutch supermarket chain, founded in Oostzaan in 1887. Six regional distribution centres each supply the stores in their part of the country.',
    approxStores: 1050,
  },
  {
    id: 'jumbo', name: 'Jumbo', parent: 'Jumbo Groep Holding (Van Eerd family)', color: '#eeb717', textColor: '#111111',
    hq: hq('jumbo_hq', 'Jumbo head office, Veghel'),
    dcs: [
      dc('jumbo_dc_nieuwegein', 'Jumbo central fresh DC Nieuwegein', true, 'likely', 'Mechanised fresh centre in use since 2024.'),
      dc('jumbo_hq', 'Jumbo DC Veghel', false),
      dc('jumbo_dc_woerden', 'Jumbo DC Woerden', false),
      dc('jumbo_dc_breda', 'Jumbo DC Breda', false),
      dc('jumbo_dc_beilen', 'Jumbo DC Beilen', false),
      dc('jumbo_dc_bleiswijk', 'Jumbo DC Bleiswijk', false, 'likely'),
      dc('jumbo_dc_raalte', 'Jumbo frozen DC Raalte', false),
    ],
    freshSupply: { confidence: 'likely', description: 'Fresh produce is bought from Dutch cooperatives and importers and consolidated in the central fresh distribution centre in Nieuwegein.' },
    description: 'Family-owned chain from Veghel that grew rapidly by taking over Super de Boer, C1000 and EMTÉ. Regional centres handle ambient goods; fresh produce runs through one central site.',
    approxStores: 700,
  },
  {
    id: 'lidl', name: 'Lidl', parent: 'Schwarz Gruppe (DE)', color: '#0050aa', textColor: '#fff000',
    hq: hq('lidl_hq', 'Lidl Nederland head office, Huizen'),
    dcs: [
      dc('lidl_dc_almere', 'Lidl DC Almere'),
      dc('lidl_dc_heerenveen', 'Lidl DC Heerenveen'),
      dc('lidl_dc_oosterhout', 'Lidl DC Oosterhout (Gelderland)'),
      dc('lidl_dc_weert', 'Lidl DC Weert'),
      dc('lidl_dc_waddinxveen', 'Lidl DC Waddinxveen', true, 'likely'),
      dc('lidl_dc_ettenleur', 'Lidl DC Etten-Leur', true, 'likely'),
    ],
    freshSupply: { confidence: 'likely', description: 'Lidl buys fruit and vegetables directly from growers and importers, delivered straight to its regional distribution centres.' },
    description: 'German discounter, in the Netherlands since 1997. Six regional distribution centres each handle the full range, including chilled and fresh produce.',
    approxStores: 440,
  },
  {
    id: 'aldi', name: 'ALDI', parent: 'Aldi Nord (DE)', color: '#00005f', textColor: '#ffffff',
    hq: hq('aldi_hq', 'Aldi Nederland head office, Culemborg'),
    dcs: [
      dc('aldi_dc_culemborg', 'Aldi DC Culemborg'),
      dc('aldi_dc_roosendaal', 'Aldi DC Roosendaal'),
      dc('aldi_dc_roermond', 'Aldi DC Roermond'),
      dc('aldi_dc_zoetermeer', 'Aldi DC Zoetermeer', true, 'likely'),
      dc('aldi_dc_deventer', 'Aldi DC Deventer', true, 'likely'),
      dc('aldi_dc_groningen', 'Aldi DC Groningen'),
    ],
    freshSupply: { confidence: 'likely', description: 'Aldi buys centrally for the Netherlands and delivers through six regional distribution centres, after consolidating its network in 2021 to 2024.' },
    description: 'The original discounter, in the Netherlands since 1973. A limited range of around 1,500 lines keeps logistics simple.',
    approxStores: 480,
  },
  {
    id: 'plus', name: 'PLUS', parent: 'PLUS Retail (cooperative of independent grocers)', color: '#6cb33f', textColor: '#ffffff',
    hq: hq('plus_hq', 'PLUS Retail head office, Utrecht'),
    dcs: [
      dc('plus_dc_oss', 'PLUS central DC Oss', true, 'verified', 'Fully automated central distribution centre opened in 2023, replacing four regional sites.'),
    ],
    freshSupply: { confidence: 'likely', description: 'All ranges, including fresh produce, are consolidated in the single automated distribution centre in Oss.' },
    description: 'Cooperative of independent entrepreneurs; merged with Coop in 2022. One central automated warehouse in Oss serves every store.',
    approxStores: 540,
  },
];

export const CHAIN_BY_ID: Record<string, Chain> = Object.fromEntries(CHAINS.map((c) => [c.id, c]));
