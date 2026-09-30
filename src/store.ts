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

/** The player's weekly shop: products (in retail packs, with an origin they picked) priced at one store. Remembered per browser. */
export interface BasketItem { productId: string; packs: number; routeId?: string | null }
export interface Basket { items: BasketItem[]; store: StoreFeature | null }
const BASKET_KEY = 'co2map.basket.v1';
function loadBasket(): Basket {
  try {
    const b = JSON.parse(localStorage.getItem(BASKET_KEY) || '{}');
    return { items: Array.isArray(b.items) ? b.items.filter((i: BasketItem) => i && typeof i.productId === 'string' && i.packs > 0) : [], store: b.store ?? null };
  } catch { return { items: [], store: null }; }
}
function saveBasket(b: Basket) {
  try { localStorage.setItem(BASKET_KEY, JSON.stringify(b)); } catch { /* private mode */ }
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
  basket: Basket;
  basketOpen: boolean;
  /** the route of the unsold product from the store to the waste plants is drawn on the map */
  afterlifeOn: boolean;
  setAfterlifeOn: (on: boolean) => void;
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
  /** Put packs of a product in the basket (priced at `store`, or the store the basket already has). */
  addToBasket: (productId: string, packs?: number, store?: StoreFeature | null) => void;
  /** Set a product's number of packs; 0 takes it out. */
  setPacks: (productId: string, packs: number) => void;
  /** Buy a product from this origin whenever it is in season (null: whatever the store usually has). */
  pinOrigin: (productId: string, routeId: string | null) => void;
  /** Fill an empty basket in one go, or price it at another store. */
  setBasket: (b: Partial<Basket>) => void;
  setBasketOpen: (open: boolean) => void;
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
  basket: loadBasket(),
  basketOpen: false,
  afterlifeOn: false,
  setAfterlifeOn: (afterlifeOn) => set({ afterlifeOn }),
  setLens: (lens) => set({ lens, afterlifeOn: false }),
  setLifecycle: (lifecycleId) => set({ lifecycleId, lens: 'product', afterlifeOn: false }),
  goHome: () => set({ chainId: null, store: null, productId: null, routeId: null, lifecycleId: null, nearby: false, afterlifeOn: false }),
  setChain: (chainId) => set({ chainId, store: null, productId: null, routeId: null, nearby: false, afterlifeOn: false }),
  setStore: (store) => set({ store, productId: null, routeId: null, afterlifeOn: false }),
  setProduct: (productId) => set({ productId, routeId: null, afterlifeOn: false }),
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
  showNearby: () => set({ nearby: true, lens: 'grocer', chainId: null, store: null, productId: null, routeId: null, afterlifeOn: false }),
  shopAt: (store) => set({ chainId: store.properties.chain, store, productId: null, routeId: null, afterlifeOn: false }),
  addToBasket: (productId, packs = 1, store) => set((s) => {
    const items = s.basket.items.some((i) => i.productId === productId)
      ? s.basket.items.map((i) => (i.productId === productId ? { ...i, packs: i.packs + packs } : i))
      : [...s.basket.items, { productId, packs }];
    const basket = { items, store: store ?? s.basket.store };
    saveBasket(basket);
    return { basket };
  }),
  setPacks: (productId, packs) => set((s) => {
    const items = packs > 0 ? s.basket.items.map((i) => (i.productId === productId ? { ...i, packs } : i)) : s.basket.items.filter((i) => i.productId !== productId);
    const basket = { ...s.basket, items };
    saveBasket(basket);
    return { basket };
  }),
  pinOrigin: (productId, routeId) => set((s) => {
    const basket = { ...s.basket, items: s.basket.items.map((i) => (i.productId === productId ? { ...i, routeId } : i)) };
    saveBasket(basket);
    return { basket };
  }),
  setBasket: (b) => set((s) => {
    const basket = { ...s.basket, ...b };
    saveBasket(basket);
    return { basket };
  }),
  setBasketOpen: (basketOpen) => set({ basketOpen }),
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
