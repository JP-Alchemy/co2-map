import { create } from 'zustand';
import type { Feature, Point } from 'geojson';
import type { Grade } from './game/grade';
import type { Place, StoreProps } from './types';

export type StoreFeature = Feature<Point, StoreProps>;

/** A store as a place on a route. */
export function storePlaceOf(store: StoreFeature): Place {
  const p = store.properties;
  return { id: `store_${p.osm}`, name: `${p.name}${p.city ? ', ' + p.city : ''}`, kind: 'store', country: 'NL', coords: store.geometry.coordinates as [number, number], confidence: 'verified' };
}

/** Visual effects on the map; remembered per browser. */
export interface Fx { clouds: boolean; grain: boolean; sound: boolean }
const FX_KEY = 'co2map.fx.v1';
const FX_DEFAULT: Fx = { clouds: true, grain: true, sound: false };
function loadFx(): Fx {
  try { return { ...FX_DEFAULT, ...JSON.parse(localStorage.getItem(FX_KEY) || '{}') }; } catch { return FX_DEFAULT; }
}

/** Journeys the player has completed, remembered per browser: a stamp per product and the badges earned. */
export interface Passport {
  products: Record<string, { routes: string[]; best: Grade }>;
  badges: Record<string, number>;
}
const PASSPORT_KEY = 'co2map.passport.v1';
function loadPassport(): Passport {
  try { return { products: {}, badges: {}, ...JSON.parse(localStorage.getItem(PASSPORT_KEY) || '{}') }; } catch { return { products: {}, badges: {} }; }
}

interface AppState {
  chainId: string | null;
  store: StoreFeature | null;
  productId: string | null;
  routeId: string | null;
  month: number;
  view: 'explore' | 'about';
  useRoads: boolean;
  fx: Fx;
  passport: Passport;
  setChain: (id: string | null) => void;
  setStore: (f: StoreFeature | null) => void;
  setProduct: (id: string | null) => void;
  setRoute: (id: string | null) => void;
  setMonth: (m: number) => void;
  setView: (v: 'explore' | 'about') => void;
  setUseRoads: (b: boolean) => void;
  setFx: (fx: Partial<Fx>) => void;
  /** Stamp a completed journey; returns which badges and product were new. */
  stamp: (productId: string, routeId: string, grade: Grade, badgeIds: string[]) => { newProduct: boolean; newBadges: string[] };
}

export const useApp = create<AppState>((set, get) => ({
  chainId: null,
  store: null,
  productId: null,
  routeId: null,
  month: new Date().getMonth() + 1,
  view: 'explore',
  useRoads: true,
  fx: loadFx(),
  passport: loadPassport(),
  setChain: (chainId) => set({ chainId, store: null, productId: null, routeId: null }),
  setStore: (store) => set({ store, productId: null, routeId: null }),
  setProduct: (productId) => set({ productId, routeId: null }),
  setRoute: (routeId) => set({ routeId }),
  setMonth: (month) => set({ month }),
  setView: (view) => set({ view }),
  setUseRoads: (useRoads) => set({ useRoads }),
  setFx: (fx) => set((s) => {
    const next = { ...s.fx, ...fx };
    try { localStorage.setItem(FX_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    return { fx: next };
  }),
  stamp: (productId, routeId, grade, badgeIds) => {
    const prev = get().passport;
    const had = prev.products[productId];
    const newBadges = badgeIds.filter((b) => !prev.badges[b]);
    const next: Passport = {
      products: { ...prev.products, [productId]: { routes: [...new Set([...(had?.routes ?? []), routeId])], best: had && had.best < grade ? had.best : grade } },
      badges: { ...prev.badges, ...Object.fromEntries(badgeIds.map((b) => [b, (prev.badges[b] ?? 0) + 1])) },
    };
    try { localStorage.setItem(PASSPORT_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    set({ passport: next });
    return { newProduct: !had, newBadges };
  },
}));
