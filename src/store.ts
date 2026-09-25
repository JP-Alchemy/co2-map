import { create } from 'zustand';
import type { Feature, Point } from 'geojson';
import type { StoreProps } from './types';

export type StoreFeature = Feature<Point, StoreProps>;

/** Visual effects on the map; remembered per browser. */
export interface Fx { clouds: boolean; grain: boolean }
const FX_KEY = 'co2map.fx.v1';
function loadFx(): Fx {
  try { return { clouds: true, grain: true, ...JSON.parse(localStorage.getItem(FX_KEY) || '{}') }; } catch { return { clouds: true, grain: true }; }
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
  setChain: (id: string | null) => void;
  setStore: (f: StoreFeature | null) => void;
  setProduct: (id: string | null) => void;
  setRoute: (id: string | null) => void;
  setMonth: (m: number) => void;
  setView: (v: 'explore' | 'about') => void;
  setUseRoads: (b: boolean) => void;
  setFx: (fx: Partial<Fx>) => void;
}

export const useApp = create<AppState>((set) => ({
  chainId: null,
  store: null,
  productId: null,
  routeId: null,
  month: new Date().getMonth() + 1,
  view: 'explore',
  useRoads: true,
  fx: loadFx(),
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
}));
