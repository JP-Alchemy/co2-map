import { create } from 'zustand';
import type { Feature, Point } from 'geojson';
import type { Grade } from './game/grade';
import { locate, type Here, type LocateError } from './model/near';
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

/** Follow one supermarket's supply chain to a store, or one product across all its markets. */
export type Lens = 'grocer' | 'product';

interface AppState {
  lens: Lens;
  /** product shown across Europe in the product lens */
  lifecycleId: string | null;
  chainId: string | null;
  store: StoreFeature | null;
  productId: string | null;
  routeId: string | null;
  month: number;
  view: 'explore' | 'about';
  useRoads: boolean;
  fx: Fx;
  passport: Passport;
  /** the "near me" screen is (or was, on the way to the current store) part of the story */
  nearby: boolean;
  /** where the player is, once known; kept in memory only */
  here: Here | null;
  locating: boolean;
  locateError: LocateError | null;
  setLens: (lens: Lens) => void;
  setLifecycle: (id: string | null) => void;
  /** back to the start screen of the current lens */
  goHome: () => void;
  setChain: (id: string | null) => void;
  setStore: (f: StoreFeature | null) => void;
  setProduct: (id: string | null) => void;
  setRoute: (id: string | null) => void;
  setMonth: (m: number) => void;
  setView: (v: 'explore' | 'about') => void;
  setUseRoads: (b: boolean) => void;
  setFx: (fx: Partial<Fx>) => void;
  /** Ask the browser where we are; with `open`, show the stores around it (the "near me" screen). */
  findMe: (open?: boolean) => void;
  /** a town or postcode the player typed instead */
  setHere: (here: Here) => void;
  /** back to the "near me" screen */
  showNearby: () => void;
  /** choose a store of any chain in one go */
  shopAt: (store: StoreFeature) => void;
  /** Stamp a completed journey; returns which badges and product were new. */
  stamp: (productId: string, routeId: string, grade: Grade, badgeIds: string[]) => { newProduct: boolean; newBadges: string[] };
}

export const useApp = create<AppState>((set, get) => ({
  lens: 'grocer',
  lifecycleId: null,
  chainId: null,
  store: null,
  productId: null,
  routeId: null,
  month: new Date().getMonth() + 1,
  view: 'explore',
  useRoads: true,
  fx: loadFx(),
  passport: loadPassport(),
  nearby: false,
  here: null,
  locating: false,
  locateError: null,
  setLens: (lens) => set({ lens }),
  setLifecycle: (lifecycleId) => set({ lifecycleId, lens: 'product' }),
  goHome: () => set({ chainId: null, store: null, productId: null, routeId: null, lifecycleId: null, nearby: false }),
  setChain: (chainId) => set({ chainId, store: null, productId: null, routeId: null, nearby: false }),
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
  findMe: (open = true) => {
    if (open) set({ nearby: true, lens: 'grocer', chainId: null, store: null, productId: null, routeId: null });
    set({ locating: true, locateError: null });
    locate().then(
      (here) => set({ here, locating: false }),
      (locateError: LocateError) => set({ locating: false, locateError }),
    );
  },
  setHere: (here) => set({ here, locateError: null }),
  showNearby: () => set({ nearby: true, lens: 'grocer', chainId: null, store: null, productId: null, routeId: null }),
  shopAt: (store) => set({ chainId: store.properties.chain, store, productId: null, routeId: null }),
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
