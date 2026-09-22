/**
 * Core data model for the food-origin map.
 *
 * Every real-world claim carries a `confidence` level:
 *  - verified:     taken from a primary source (company website, port authority, OSM).
 *  - likely:       widely reported but not confirmed from a primary source for this exact link.
 *  - extrapolated: a reasonable modelled estimate; numbers here are illustrative, not measured.
 */
export type Confidence = 'verified' | 'likely' | 'extrapolated';

export type TransportMode =
  | 'truck'        // ambient road haulage
  | 'reefer_truck' // refrigerated road haulage
  | 'reefer_ship'  // refrigerated container / reefer vessel
  | 'air'          // air freight (belly or freighter)
  | 'rail'
  | 'ferry';       // short ro-ro crossing (truck stays with cargo)

export type PlaceKind =
  | 'farm' | 'greenhouse' | 'orchard' | 'packhouse' | 'cooperative' | 'processor'
  | 'port' | 'airport' | 'importer' | 'ripening' | 'dc' | 'store' | 'hq';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  /** ISO 3166-1 alpha-2 */
  country: string;
  /** [lon, lat] */
  coords: [number, number];
  note?: string;
  confidence: Confidence;
}

export interface Producer {
  id: string;
  name: string;
  kind: 'grower' | 'cooperative' | 'company' | 'region';
  country: string;
  region: string;
  description: string;
  url?: string;
  confidence: Confidence;
}

export interface Chain {
  id: string;
  name: string;
  parent: string;
  color: string;
  textColor: string;
  hq: Place;
  /** Distribution centres that serve stores. `fresh: true` marks the ones handling chilled produce. */
  dcs: (Place & { fresh?: boolean })[];
  /** How fresh produce reaches the chain's DCs (e.g. a dedicated supplier). */
  freshSupply: { placeId?: string; description: string; confidence: Confidence };
  description: string;
  approxStores: number;
}

export type StorageType = 'ambient' | 'chilled' | 'ripening' | 'frozen';

export type NodeRole = 'origin' | 'packing' | 'processing' | 'port' | 'airport' | 'import' | 'ripening' | 'dc' | 'store';

/** A stop in the supply chain: something happens to the product here (grown, packed, stored, ripened). */
export interface NodeStep {
  kind: 'node';
  placeId: string;
  role: NodeRole;
  /** Typical dwell time in days */
  days: number;
  storage: StorageType;
  note?: string;
}

/** A movement between two nodes. Distance is derived from geometry unless overridden. */
export interface LegStep {
  kind: 'leg';
  mode: TransportMode;
  /** Optional intermediate [lon, lat] points (canals, straits) for sea/air routing */
  waypoints?: [number, number][];
  /** Override computed distance (km) when known */
  distanceKm?: number;
  /** Override computed duration (hours) when known */
  hours?: number;
  note?: string;
}

export type Step = NodeStep | LegStep;

export interface SeasonWindow {
  /** 1-12 inclusive; may wrap (e.g. from 11 to 3) */
  from: number;
  to: number;
}

export interface SupplyRoute {
  id: string;
  label: string;
  origin: { country: string; region: string };
  season: SeasonWindow;
  /** Share of the chain's volume for this product coming via this route in season (0-1, extrapolated) */
  share: number;
  producerIds: string[];
  /** Cradle-to-farm-gate footprint, kg CO2e per kg product */
  production: { co2ePerKg: number; method: string; source: string; confidence: Confidence };
  /** EUR per kg paid at farm gate (extrapolated) */
  farmGateEurPerKg: number;
  /** Packing/grading cost at origin, EUR per kg */
  packingEurPerKg: number;
  /** Steps from origin up to (and including) the last node before the chain's own network. */
  steps: Step[];
  /** Typical shelf price for this origin when it differs from the product default (EUR per pack) */
  shelfPriceEur?: number;
  /** Which chains use this route. Empty = all five. */
  chainIds?: string[];
  notes?: string[];
}

export type ProductCategory = 'fruit' | 'vegetable' | 'dairy' | 'meat' | 'fish' | 'eggs';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  emoji: string;
  /** Typical retail pack the shelf price refers to */
  pack: { label: string; kg: number };
  /** Typical shelf price in EUR for the pack (extrapolated, 2025-2026 level) */
  shelfPriceEur: number;
  description: string;
  routes: SupplyRoute[];
}

/* ---------- Store features (from OpenStreetMap) ---------- */
export interface StoreProps {
  chain: string;
  name: string;
  street?: string;
  city?: string;
  postcode?: string;
  osm: string;
}
