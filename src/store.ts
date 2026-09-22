import { create } from 'zustand';
import type { Feature, Point } from 'geojson';
import type { StoreProps } from './types';

export type StoreFeature = Feature<Point, StoreProps>;

interface AppState {
  chainId: string | null;
  store: StoreFeature | null;
  productId: string | null;
  routeId: string | null;
  month: number;
  view: 'explore' | 'about';
  useRoads: boolean;
  setChain: (id: string | null) => void;
  setStore: (f: StoreFeature | null) => void;
  setProduct: (id: string | null) => void;
  setRoute: (id: string | null) => void;
  setMonth: (m: number) => void;
  setView: (v: 'explore' | 'about') => void;
  setUseRoads: (b: boolean) => void;
}

export const useApp = create<AppState>((set) => ({
  chainId: null,
  store: null,
  productId: null,
  routeId: null,
  month: new Date().getMonth() + 1,
  view: 'explore',
  useRoads: true,
  setChain: (chainId) => set({ chainId, store: null, productId: null, routeId: null }),
  setStore: (store) => set({ store, productId: null, routeId: null }),
  setProduct: (productId) => set({ productId, routeId: null }),
  setRoute: (routeId) => set({ routeId }),
  setMonth: (month) => set({ month }),
  setView: (view) => set({ view }),
  setUseRoads: (useRoads) => set({ useRoads }),
}));
