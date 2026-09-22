import type { StorageType, TransportMode } from '../types';

/**
 * Emission, speed and cost factors used by the model.
 * All are conservative, order-of-magnitude-correct defaults with their provenance listed
 * in `SOURCES`. They are deliberately simple so that the app can explain every number.
 */

export interface ModeFactor {
  label: string;
  /** kg CO2e per tonne-km, well-to-wheel, incl. refrigeration where relevant */
  co2ePerTkm: number;
  /** average door-to-door speed in km/h incl. typical stops */
  kmh: number;
  /** EUR per tonne-km, typical contract rate (extrapolated) */
  eurPerTkm: number;
  /** multiply great-circle distance by this to approximate real route length */
  detour: number;
  color: string;
  icon: string;
}

export const MODES: Record<TransportMode, ModeFactor> = {
  truck:        { label: 'Truck',              co2ePerTkm: 0.085, kmh: 60,  eurPerTkm: 0.10, detour: 1.25, color: '#f59e0b', icon: '🚛' },
  reefer_truck: { label: 'Refrigerated truck', co2ePerTkm: 0.105, kmh: 60,  eurPerTkm: 0.12, detour: 1.25, color: '#f97316', icon: '🚛' },
  reefer_ship:  { label: 'Reefer container ship', co2ePerTkm: 0.018, kmh: 33, eurPerTkm: 0.020, detour: 1.03, color: '#0ea5e9', icon: '🚢' },
  air:          { label: 'Air freight',        co2ePerTkm: 0.60,  kmh: 700, eurPerTkm: 0.30, detour: 1.05, color: '#ef4444', icon: '✈️' },
  rail:         { label: 'Rail',               co2ePerTkm: 0.028, kmh: 45,  eurPerTkm: 0.05, detour: 1.20, color: '#8b5cf6', icon: '🚆' },
  ferry:        { label: 'Ro-ro ferry',        co2ePerTkm: 0.12,  kmh: 30,  eurPerTkm: 0.15, detour: 1.05, color: '#14b8a6', icon: '⛴️' },
};

export interface StorageFactor {
  label: string;
  /** kg CO2e per kg product per day (electricity for cooling, NL/EU grid mix) */
  co2ePerKgDay: number;
  /** EUR per kg product per day (extrapolated) */
  eurPerKgDay: number;
}

export const STORAGE: Record<StorageType, StorageFactor> = {
  ambient:  { label: 'Ambient',            co2ePerKgDay: 0.0000, eurPerKgDay: 0.0005 },
  chilled:  { label: 'Chilled (0-8 °C)',   co2ePerKgDay: 0.0004, eurPerKgDay: 0.0015 },
  ripening: { label: 'Ripening room',      co2ePerKgDay: 0.0012, eurPerKgDay: 0.0040 },
  frozen:   { label: 'Frozen (-18 °C)',    co2ePerKgDay: 0.0010, eurPerKgDay: 0.0025 },
};

/** Fixed handling cost every time goods pass through a node, EUR per kg (extrapolated) */
export const HANDLING_EUR_PER_KG = 0.03;
/** Importer / wholesaler margin on landed cost */
export const IMPORT_MARGIN = 0.10;
/** Dutch VAT on food */
export const VAT = 0.09;

export const SOURCES = [
  { id: 'defra', label: 'UK DEFRA/DESNZ GHG conversion factors 2024 (freight, refrigerated HGV, container ship, air freight)', url: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024' },
  { id: 'glec', label: 'Smart Freight Centre, GLEC Framework v3 (default intensity ranges per mode)', url: 'https://www.smartfreightcentre.org/en/our-programs/global-logistics-emissions-council/' },
  { id: 'poore', label: 'Poore & Nemecek (2018), Reducing food\'s environmental impacts through producers and consumers, Science', url: 'https://doi.org/10.1126/science.aaq0216' },
  { id: 'blonk', label: 'Blonk Consultants / RIVM Dutch LCA food database (NL greenhouse, dairy, poultry benchmarks)', url: 'https://www.rivm.nl/voedsel-en-voeding/duurzaam-voedsel/database-milieubelasting-voedingsmiddelen' },
  { id: 'wur', label: 'Wageningen University & Research, greenhouse horticulture energy monitor (Energiemonitor Glastuinbouw)', url: 'https://www.wur.nl/' },
  { id: 'cbs', label: 'CBS StatLine, Dutch imports of fresh fruit and vegetables by origin country', url: 'https://opendata.cbs.nl/' },
  { id: 'osm', label: 'OpenStreetMap contributors (store locations, ODbL)', url: 'https://www.openstreetmap.org/copyright' },
];
