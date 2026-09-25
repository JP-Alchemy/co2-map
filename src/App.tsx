import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { CHAIN_BY_ID, PRODUCT_BY_ID } from './data';
import { pickRoute, type ComputedRoute } from './model/compute';
import { buildLifecycle, type Flow, type LcFocus } from './model/lifecycle';
import { useComputedRoute } from './model/useRoute';
import { storePlaceOf, useApp } from './store';
import type { StoreProps } from './types';
import { About } from './components/About';
import { ChainPanel } from './components/ChainPanel';
import { ChainSelect } from './components/ChainSelect';
import { Dock } from './components/Dock';
import { Hotbar } from './components/Hotbar';
import { HudControls, QuestTrail } from './components/Hud';
import { JourneyPlayer } from './components/JourneyPlayer';
import { LifecyclePanel } from './components/LifecyclePanel';
import { MapView } from './components/MapView';
import { ProductBar } from './components/ProductBar';
import { RoutePanel } from './components/RoutePanel';
import { StoreCard } from './components/StoreCard';

export default function App() {
  const [stores, setStores] = useState<FeatureCollection<Point, StoreProps> | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [focusStep, setFocusStep] = useState<{ index: number; n: number } | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [journey, setJourney] = useState<{ key: string | null; run: number; open: boolean; seek: { index: number; n: number } | null }>({ key: null, run: 0, open: false, seek: null });
  const [preview, setPreview] = useState<ComputedRoute | null>(null);
  const [dockOpen, setDockOpen] = useState(true);
  const [lcFocus, setLcFocus] = useState<LcFocus>(null);
  const [lcJourney, setLcJourney] = useState<{ flow: Flow; run: number } | null>(null);
  const { lens, lifecycleId, chainId, store, productId, routeId, month, view, useRoads, fx, setProduct, setRoute, setMonth, setLifecycle } = useApp();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/stores.geojson`).then((r) => r.json()).then(setStores).catch(() => setStores({ type: 'FeatureCollection', features: [] }));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of stores?.features ?? []) c[f.properties.chain] = (c[f.properties.chain] ?? 0) + 1;
    return c;
  }, [stores]);

  // ---- the supermarket lens: one chain, one store, one product's journey
  const chain = chainId ? CHAIN_BY_ID[chainId] : null;
  const product = productId ? PRODUCT_BY_ID[productId] : null;

  // pick a default route for the month when the product or month changes
  const route = useMemo(() => (product ? pickRoute(product, month, routeId) : null), [product, routeId, month]);
  useEffect(() => { if (route && route.id !== routeId) setRoute(route.id); }, [route, routeId, setRoute]);

  const storePlace = useMemo(() => (store ? storePlaceOf(store) : null), [store]);
  const computed = useComputedRoute(product, route, chain, storePlace, useRoads);

  // every newly chosen product (or origin) plays its journey from the farm to the shelf
  const journeyKey = store && product && route ? `${store.properties.osm}|${product.id}|${route.id}` : null;
  if (journey.key !== journeyKey) setJourney({ key: journeyKey, run: journey.run + 1, open: !!journeyKey, seek: null });
  const playJourney = useCallback(() => setJourney((j) => ({ ...j, run: j.run + 1, open: true, seek: null })), []);
  const closeJourney = useCallback(() => setJourney((j) => ({ ...j, open: false })), []);
  const pickAnother = useCallback(() => { setJourney((j) => ({ ...j, open: false })); setProduct(null); }, [setProduct]);
  const swapTo = useCallback((id: string, m: number) => { setMonth(m); setRoute(id); }, [setMonth, setRoute]);
  const journeyActive = lens === 'grocer' && journey.open && !!computed && !!map;
  const focus = (index: number) => {
    if (journeyActive) setJourney((j) => ({ ...j, seek: { index, n: (j.seek?.n ?? 0) + 1 } }));
    else setFocusStep((f) => ({ index, n: (f?.n ?? 0) + 1 }));
  };

  // ---- the product lens: one product across every market it reaches
  const lcProduct = lifecycleId ? PRODUCT_BY_ID[lifecycleId] : null;
  const lifecycle = useMemo(() => (lens === 'product' && lcProduct ? buildLifecycle(lcProduct, month) : null), [lens, lcProduct, month]);
  const lcJourneyActive = lens === 'product' && !!lifecycle && !!lcJourney && !!map;
  const followFlow = useCallback((flow: Flow) => setLcJourney((j) => ({ flow, run: (j?.run ?? 0) + 1 })), []);
  const closeLcJourney = useCallback(() => setLcJourney(null), []);
  const showLifecycle = useCallback((id: string) => setLifecycle(id), [setLifecycle]);

  // switching lens or product starts that story fresh: no journey left running, no stale focus
  const lensKey = `${lens}|${lens === 'product' ? lifecycleId : ''}`;
  const [lastLensKey, setLastLensKey] = useState(lensKey);
  if (lensKey !== lastLensKey) {
    setLastLensKey(lensKey);
    setLcFocus(null);
    setLcJourney(null);
    if (lens === 'product' && journey.open) setJourney((j) => ({ ...j, open: false }));
  }

  const mode = lens === 'product'
    ? (!lifecycle ? 'landing' : lcJourneyActive ? 'journey' : 'lifecycle')
    : (!chain ? 'landing' : !store ? 'chain' : !product ? 'store' : journeyActive ? 'journey' : 'explore');
  // each new screen opens the dock again; a hover preview never outlives the hotbar
  const [lastMode, setLastMode] = useState(mode);
  if (mode !== lastMode) { setLastMode(mode); setDockOpen(true); if (mode !== 'store' && mode !== 'explore') setPreview(null); }
  const dockVisible = mode === 'chain' || mode === 'store' || mode === 'explore' || mode === 'lifecycle';
  const anyJourney = journeyActive || lcJourneyActive;

  return (
    <div className={`app mode-${mode} lens-${lens}`}>
      <main className={`map-wrap ${fx.grain ? 'fx-grain' : ''} ${anyJourney ? 'journey-on' : ''}`}>
        <MapView stores={stores} computed={computed} activeStep={activeStep} focusStep={focusStep} journeyActive={anyJourney}
          preview={preview} dockOpen={dockVisible && dockOpen} lifecycle={lifecycle} lcFocus={lcFocus} onLcFocus={setLcFocus} onReady={setMap} />
        <div className="map-fx" aria-hidden="true" />

        <QuestTrail />
        <HudControls />

        {mode === 'landing' && <ChainSelect counts={counts} />}

        {dockVisible && (
          <Dock key={mode} open={dockOpen} onToggle={() => setDockOpen((o) => !o)}
            title={mode === 'lifecycle' && lifecycle ? <>🌍 {lifecycle.product.emoji} {lifecycle.product.name} across Europe</>
              : mode === 'chain' && chain ? <><span className="dock-swatch" style={{ background: chain.color, color: chain.textColor }}>{chain.name[0]}</span>{chain.name}</>
              : mode === 'store' ? <>📍 Your store</> : <>{product?.emoji} {product?.name}</>}>
            {mode === 'lifecycle' && lifecycle && <LifecyclePanel lc={lifecycle} focus={lcFocus} onFocus={setLcFocus} onFollow={followFlow} />}
            {mode === 'chain' && chain && <ChainPanel chain={chain} stores={stores} />}
            {mode === 'store' && chain && store && <StoreCard chain={chain} store={store} />}
            {mode === 'explore' && product && <RoutePanel product={product} route={route} computed={computed} activeStep={activeStep} liveStep={null} journeyActive={false} onPlay={playJourney} onHover={setActiveStep} onFocus={focus} />}
          </Dock>
        )}

        {lens === 'grocer' && chain && store && (mode === 'store' || mode === 'explore') && <Hotbar chain={chain} store={store} currentId={productId} onPreview={setPreview} />}
        {lens === 'product' && mode !== 'journey' && <ProductBar />}

        {journeyActive && map && computed && (
          <JourneyPlayer key={`g${journey.run}`} map={map} computed={computed} seek={journey.seek}
            onClose={closeJourney} onPickAnother={pickAnother} onSwap={swapTo} onLifecycle={() => showLifecycle(computed.product.id)} />
        )}
        {lcJourneyActive && map && lcJourney && (
          <JourneyPlayer key={`p${lcJourney.run}`} map={map} computed={lcJourney.flow.computed} seek={null}
            onClose={closeLcJourney} onPickAnother={closeLcJourney} />
        )}

        {!stores && lens === 'grocer' && <div className="toast top">Loading 3,000 store locations…</div>}
        {mode === 'chain' && <div className="toast">🛒 Click a store to shop there · clusters zoom in</div>}
      </main>

      {view === 'about' && <About />}
    </div>
  );
}
