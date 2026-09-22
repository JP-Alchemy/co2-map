import { useEffect, useMemo, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import { CHAIN_BY_ID, PRODUCT_BY_ID } from './data';
import { inSeason } from './model/compute';
import { useComputedRoute } from './model/useRoute';
import { useApp } from './store';
import type { Place, StoreProps } from './types';
import { About } from './components/About';
import { ChainList } from './components/ChainList';
import { ChainPanel } from './components/ChainPanel';
import { MapView } from './components/MapView';
import { RoutePanel } from './components/RoutePanel';
import { StorePanel } from './components/StorePanel';

export default function App() {
  const [stores, setStores] = useState<FeatureCollection<Point, StoreProps> | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [focusStep, setFocusStep] = useState<{ index: number; n: number } | null>(null);
  const { chainId, store, productId, routeId, month, view, useRoads, setChain, setStore, setProduct, setRoute } = useApp();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/stores.geojson`).then((r) => r.json()).then(setStores).catch(() => setStores({ type: 'FeatureCollection', features: [] }));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of stores?.features ?? []) c[f.properties.chain] = (c[f.properties.chain] ?? 0) + 1;
    return c;
  }, [stores]);

  const chain = chainId ? CHAIN_BY_ID[chainId] : null;
  const product = productId ? PRODUCT_BY_ID[productId] : null;

  // pick a default route for the month when the product or month changes
  const route = useMemo(() => {
    if (!product) return null;
    const live = product.routes.filter((r) => inSeason(r, month));
    const pool = live.length ? live : product.routes;
    return pool.find((r) => r.id === routeId) ?? [...pool].sort((a, b) => b.share - a.share)[0];
  }, [product, routeId, month]);
  useEffect(() => { if (route && route.id !== routeId) setRoute(route.id); }, [route, routeId, setRoute]);

  const storePlace = useMemo<Place | null>(() => store ? ({ id: `store_${store.properties.osm}`, name: `${store.properties.name}${store.properties.city ? ', ' + store.properties.city : ''}`, kind: 'store', country: 'NL', coords: store.geometry.coordinates as [number, number], confidence: 'verified' }) : null, [store]);
  const computed = useComputedRoute(product, route, chain, storePlace, useRoads);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" onClick={() => setChain(null)} role="button">
          <span className="logo">🌍</span>
          <span><b>Where does my food come from?</b><small>Fresh produce supply chains of Dutch supermarkets</small></span>
        </div>
        <nav className="crumbs">
          <button className={!chainId ? 'cur' : ''} onClick={() => setChain(null)}>Chains</button>
          {chain && <><span>›</span><button className={chainId && !store ? 'cur' : ''} onClick={() => setStore(null)} style={{ color: chain.color }}>{chain.name}</button></>}
          {store && <><span>›</span><button className={store && !product ? 'cur' : ''} onClick={() => setProduct(null)}>{store.properties.city ?? 'Store'}</button></>}
          {product && <><span>›</span><button className="cur">{product.emoji} {product.name}</button></>}
        </nav>
        <button className="about-btn" onClick={() => useApp.getState().setView(view === 'about' ? 'explore' : 'about')}>{view === 'about' ? 'Map' : 'About the data'}</button>
      </header>

      <aside className="sidebar">
        {!chain && <ChainList counts={counts} />}
        {chain && !store && <ChainPanel chain={chain} stores={stores} />}
        {chain && store && !product && <StorePanel chain={chain} store={store} />}
        {chain && store && product && <RoutePanel product={product} route={route} computed={computed} activeStep={activeStep} onHover={setActiveStep} onFocus={(index) => setFocusStep((f) => ({ index, n: (f?.n ?? 0) + 1 }))} />}
      </aside>

      <main className="map-wrap">
        <MapView stores={stores} computed={computed} activeStep={activeStep} focusStep={focusStep} />
        {!stores && <div className="loading">Loading 3,000 store locations…</div>}
        {chain && !store && <div className="map-hint">Click a store dot to continue · clusters zoom in</div>}
      </main>

      {view === 'about' && <About />}
    </div>
  );
}
