import { useEffect, useRef } from 'react';
import { AttributionControl, Map as MapLibreMap, Marker, NavigationControl, Popup, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Point, Position } from 'geojson';
import { CHAINS, CHAIN_BY_ID, MODES } from '../data';
import { fitCam, type Pad } from '../map/camera';
import { CloudLayer } from '../map/clouds';
import { LifecycleOverlay } from '../map/lifecycleOverlay';
import { LANDING_PAD, landingZoom, SATELLITE_STYLE } from '../map/style';
import type { ComputedRoute } from '../model/compute';
import type { LcFocus, Lifecycle } from '../model/lifecycle';
import { useApp, type StoreFeature } from '../store';
import type { StoreProps } from '../types';

const NL_BOUNDS: [number, number, number, number] = [3.2, 50.7, 7.3, 53.6];
/** Landing view: a globe with Europe and the Atlantic in view (the zoom is fitted to the container) */
const GLOBE_CENTER: [number, number] = [-10, 32];
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
/** One full rotation of the idle globe takes this long */
const SPIN_MS = 90_000;
/** Longitude span above which a route cannot be seen on one hemisphere, so the map falls back to the flat projection. */
const GLOBE_MAX_SPAN = 140;
/** Custom event fired once all sources and layers exist (typed as a built-in event name to satisfy MapLibre's typings). */
const READY = 'app-ready' as unknown as 'load';
const ROUTE_LAYERS = ['legs-casing', 'legs', 'legs-dash', 'legs-active', 'nodes', 'nodes-label'];
/** the store picker's layers, which would only clutter the planet while a journey plays */
const PICKER_LAYERS = ['clusters', 'cluster-count', 'stores-pt', 'dcs-halo', 'dcs', 'dcs-label'];

interface Props {
  stores: FeatureCollection<Point, StoreProps> | null;
  computed: ComputedRoute | null;
  /** step highlighted on hover */
  activeStep: number | null;
  /** step the map should zoom to (set on click); the counter makes repeated clicks re-trigger */
  focusStep: { index: number; n: number } | null;
  /** while the journey animation runs it owns the camera and draws its own route */
  journeyActive: boolean;
  /** a product hovered in the hotbar: its route is sketched on the map */
  preview: ComputedRoute | null;
  /** whether the left dock covers part of the map, so camera fits leave room for it */
  dockOpen: boolean;
  /** the product lens: one product across all its markets */
  lifecycle: Lifecycle | null;
  lcFocus: LcFocus;
  onLcFocus: (f: LcFocus) => void;
  onReady?: (map: MapLibreMap) => void;
}

/** Room below a hovered product's route (the hotbar plus the tooltip above the tile) and to its right (the origin's label). */
const PREVIEW_BOTTOM = 215;
const PREVIEW_RIGHT = 200;
/** Pause on a tile before the camera moves, so skimming along the aisle doesn't swing the map about. */
const PREVIEW_DELAY_MS = 140;
/** Pause after the pointer leaves the aisle before going back to the previous view. */
const PREVIEW_RETURN_MS = 260;

/** Room the HUD takes around the map: the dock on the left (a bottom sheet on phones) and the hotbar below. */
function hudPad(m: MapLibreMap, dock: boolean, bottom: number): Pad {
  const el = m.getContainer();
  if (el.clientWidth < 820) return { top: 64, bottom: dock ? Math.round(el.clientHeight * 0.5) : bottom, left: 20, right: 20 };
  return { top: 70, bottom, left: dock ? 430 : 40, right: 60 };
}

export function MapView({ stores, computed, activeStep, focusStep, journeyActive, preview, dockOpen, lifecycle, lcFocus, onLcFocus, onReady }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const clouds = useRef<CloudLayer | null>(null);
  const ready = useRef(false);
  const marker = useRef<Marker | null>(null);
  const previewPin = useRef<Marker | null>(null);
  const overlay = useRef<LifecycleOverlay | null>(null);
  const onLcFocusRef = useRef(onLcFocus);
  useEffect(() => { onLcFocusRef.current = onLcFocus; }, [onLcFocus]);
  const spin = useRef({ on: false, raf: 0 });
  const dockRef = useRef(dockOpen);
  useEffect(() => { dockRef.current = dockOpen; }, [dockOpen]);
  const chainId = useApp((s) => s.chainId);
  const store = useApp((s) => s.store);
  const lens = useApp((s) => s.lens);
  const fxClouds = useApp((s) => s.fx.clouds);
  // the latest selection, for camera moves that run on a timer after the render that scheduled them
  const latest = useRef({ computed, journeyActive, store, chainId, lens, lifecycle });
  useEffect(() => { latest.current = { computed, journeyActive, store, chainId, lens, lifecycle }; });
  const previewTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(previewTimer.current), []);

  // ---- init
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new MapLibreMap({ container: el.current, style: SATELLITE_STYLE, center: GLOBE_CENTER, zoom: 1.5, attributionControl: false, maxPitch: 60 });
    // the container only gets its size once MapLibre has styled it
    m.jumpTo({ zoom: landingZoom(m.getContainer().clientWidth, m.getContainer().clientHeight), padding: LANDING_PAD });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new AttributionControl({ compact: true, customAttribution: 'Stores © OpenStreetMap contributors' }), 'bottom-right');
    map.current = m;
    if (import.meta.env.DEV) Object.assign(window, { __map: m, __spin: spin });

    m.on('load', () => {
      const cl = new CloudLayer();
      cl.enabled = useApp.getState().fx.clouds;
      clouds.current = cl;
      m.addLayer(cl, 'country-labels');

      const chainColor: unknown[] = ['match', ['get', 'chain']];
      for (const c of CHAINS) chainColor.push(c.id, c.color);
      chainColor.push('#888');
      const halo = 'rgba(2,6,23,0.85)';

      m.addSource('stores', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 45, clusterMaxZoom: 11 });
      m.addLayer({ id: 'clusters', type: 'circle', source: 'stores', filter: ['has', 'point_count'],
        paint: { 'circle-color': '#0f172a', 'circle-opacity': 0.82, 'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 100, 24], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
      m.addLayer({ id: 'cluster-count', type: 'symbol', source: 'stores', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 11 }, paint: { 'text-color': '#fff' } });
      m.addLayer({ id: 'stores-pt', type: 'circle', source: 'stores', filter: ['!', ['has', 'point_count']],
        paint: { 'circle-color': chainColor as never, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 8], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' } });

      m.addSource('dcs', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'dcs-halo', type: 'circle', source: 'dcs', paint: { 'circle-color': '#fff', 'circle-radius': 14, 'circle-opacity': 0.9 } });
      m.addLayer({ id: 'dcs', type: 'circle', source: 'dcs',
        paint: { 'circle-color': ['get', 'color'], 'circle-radius': 9, 'circle-stroke-width': 3, 'circle-stroke-color': '#111827', 'circle-opacity': 0.95 } });
      m.addLayer({ id: 'dcs-label', type: 'symbol', source: 'dcs',
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#fff', 'text-halo-color': halo, 'text-halo-width': 1.5 } });

      m.addSource('legs', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'legs-casing', type: 'line', source: 'legs', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#020617', 'line-width': 7, 'line-opacity': 0.6 } });
      m.addLayer({ id: 'legs', type: 'line', source: 'legs', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 3.5 } });
      m.addLayer({ id: 'legs-dash', type: 'line', source: 'legs', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#fff', 'line-width': 2, 'line-opacity': 0.9, 'line-dasharray': [0, 4, 3] } });
      m.addLayer({ id: 'legs-active', type: 'line', source: 'legs', filter: ['==', ['get', 'index'], -1], layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#fff', 'line-width': 10, 'line-opacity': 0.4, 'line-blur': 3 } });

      m.addSource('nodes', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'nodes', type: 'circle', source: 'nodes',
        paint: { 'circle-color': '#fff', 'circle-radius': ['case', ['get', 'major'], 7, 5], 'circle-stroke-width': 3, 'circle-stroke-color': '#0f172a' } });
      m.addLayer({ id: 'nodes-label', type: 'symbol', source: 'nodes',
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 12 },
        paint: { 'text-color': '#fff', 'text-halo-color': halo, 'text-halo-width': 1.5 } });

      m.addSource('preview', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'preview-glow', type: 'line', source: 'preview', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 12, 'line-blur': 9, 'line-opacity': 0.55 } });
      m.addLayer({ id: 'preview-line', type: 'line', source: 'preview', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 3 } });
      m.addLayer({ id: 'preview-dash', type: 'line', source: 'preview', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#fff', 'line-width': 1.6, 'line-opacity': 0.9, 'line-dasharray': [0, 4, 3] } });

      const ov = new LifecycleOverlay(m);
      ov.onFocus = (f) => onLcFocusRef.current(f);
      overlay.current = ov;

      // animated dashes on route legs
      const seq = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
      let step = 0;
      const tick = (t: number) => {
        if (!map.current) return;
        const s = Math.floor((t / 60) % seq.length);
        if (s !== step) {
          step = s;
          if (m.getLayer('legs-dash') && m.getLayoutProperty('legs-dash', 'visibility') !== 'none') m.setPaintProperty('legs-dash', 'line-dasharray', seq[s]);
          if (m.getLayer('preview-dash')) m.setPaintProperty('preview-dash', 'line-dasharray', seq[s]);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      m.on('click', 'clusters', (e: MapLayerMouseEvent) => {
        const f = e.features?.[0]; if (!f) return;
        (m.getSource('stores') as GeoJSONSource).getClusterExpansionZoom(f.properties!.cluster_id as number).then((z) => {
          m.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom: z + 0.5 });
        });
      });
      m.on('click', 'stores-pt', (e: MapLayerMouseEvent) => {
        const f = e.features?.[0]; if (!f) return;
        const feat: StoreFeature = { type: 'Feature', id: f.id, geometry: { type: 'Point', coordinates: (f.geometry as Point).coordinates }, properties: f.properties as StoreProps };
        useApp.getState().setStore(feat);
      });
      for (const id of ['clusters', 'stores-pt']) {
        m.on('mouseenter', id, () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', id, () => { m.getCanvas().style.cursor = ''; });
      }
      // a small card over the store under the pointer
      const card = new Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'hud-popup', maxWidth: '260px' });
      m.on('mousemove', 'stores-pt', (e: MapLayerMouseEvent) => {
        const f = e.features?.[0]; if (!f) return;
        const p = f.properties as StoreProps;
        const body = document.createElement('div');
        const name = document.createElement('b'); name.textContent = p.name;
        const addr = document.createElement('small'); addr.textContent = [p.street, p.city].filter(Boolean).join(', ') || 'Address not tagged in OpenStreetMap';
        const cta = document.createElement('span'); cta.className = 'hp-cta'; cta.textContent = 'Click to shop here →';
        body.append(name, addr, cta);
        card.setLngLat((f.geometry as Point).coordinates as [number, number]).setDOMContent(body).addTo(m);
      });
      m.on('mouseleave', 'stores-pt', () => card.remove());
      // on phones the attribution starts folded behind its (i) button
      if (m.getContainer().clientWidth < 820) m.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      ready.current = true;
      m.fire(READY);
      onReady?.(m);
    });

    // any hand on the globe stops the landing-page spin
    const sp = spin.current;
    const stopSpin = () => { sp.on = false; };
    m.on('mousedown', stopSpin); m.on('touchstart', stopSpin); m.on('wheel', stopSpin);
    return () => { cancelAnimationFrame(sp.raf); overlay.current?.destroy(); overlay.current = null; m.remove(); map.current = null; ready.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- landing view: a slowly turning planet (the globe projection and atmosphere come from the style)
  const landing = lens === 'product' ? !lifecycle : !chainId;
  useEffect(() => {
    const m = map.current; if (!m) return;
    const sp = spin.current;
    cancelAnimationFrame(sp.raf);
    if (!landing) { sp.on = false; return; }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    sp.on = !reduced;
    let last = performance.now();
    const turn = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (sp.on && !m.isMoving()) {
        const c = m.getCenter();
        m.jumpTo({ center: [c.lng + (dt * 360_000) / SPIN_MS, c.lat] });
      }
      sp.raf = requestAnimationFrame(turn);
    };
    sp.raf = requestAnimationFrame(turn);
    return () => cancelAnimationFrame(sp.raf);
  }, [landing]);

  // ---- stores + DCs by chain
  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => {
      // once a store is chosen the other stores and the DCs would only clutter the board
      const feats = stores && chainId && !store ? stores.features.filter((f) => f.properties.chain === chainId) : [];
      (m.getSource('stores') as GeoJSONSource).setData({ type: 'FeatureCollection', features: feats });
      const chain = chainId && !store ? CHAIN_BY_ID[chainId] : null;
      const dcFeats = chain ? [...chain.dcs.map((d) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: d.coords }, properties: { label: d.name.replace(/^.*?(DC|distribution centre|central DC|central fresh DC|frozen DC)\s*/i, 'DC '), color: chain.color } })),
        { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: chain.hq.coords }, properties: { label: 'Head office', color: '#111827' } }] : [];
      (m.getSource('dcs') as GeoJSONSource).setData({ type: 'FeatureCollection', features: dcFeats });
    };
    if (ready.current) apply(); else m.once(READY, apply);
  }, [stores, chainId, store]);

  // ---- camera: back out to the planet without a chain, down to the Netherlands with one (and back there when the store is cleared)
  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => {
      if (latest.current.lens === 'product') return;
      if (!chainId) {
        flyToGlobe(m);
      } else if (!store) {
        setGlobe(m, true);
        m.fitBounds(NL_BOUNDS, { padding: hudPad(m, dockRef.current, 60), pitch: 0, bearing: 0, duration: 2600, essential: true });
      }
    };
    if (ready.current) apply(); else if (chainId) m.once(READY, apply);
  }, [chainId, store]);

  // ---- selected store marker
  useEffect(() => {
    const m = map.current; if (!m) return;
    marker.current?.remove(); marker.current = null;
    if (store) {
      const chain = CHAIN_BY_ID[store.properties.chain];
      const elm = document.createElement('div'); elm.className = 'store-marker';
      elm.style.setProperty('--c', chain.color);
      const shock = document.createElement('span'); shock.className = 'sm-shock';
      const body = document.createElement('span'); body.className = 'sm-body';
      const emoji = document.createElement('span'); emoji.className = 'sm-emoji'; emoji.textContent = '🛒';
      body.append(emoji);
      elm.append(shock, body);
      marker.current = new Marker({ element: elm, anchor: 'bottom' }).setLngLat(store.geometry.coordinates as [number, number]).addTo(m);
      if (!computed) boardView(m, store, dockRef.current, 2200);
    }
  }, [store]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- route (hidden while the journey animation draws its own)
  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => {
      const legs = computed ? computed.steps.filter((s) => s.kind === 'leg').map((s) => ({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: s.path }, properties: { index: s.index, color: MODES[s.mode].color, mode: s.mode } })) : [];
      const nodes = computed ? computed.steps.filter((s) => s.kind === 'node').map((s) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: s.coords }, properties: { index: s.index, label: s.place.name.split(',')[0], major: s.step.role === 'origin' || s.step.role === 'store' } })) : [];
      (m.getSource('legs') as GeoJSONSource).setData({ type: 'FeatureCollection', features: legs });
      (m.getSource('nodes') as GeoJSONSource).setData({ type: 'FeatureCollection', features: nodes });
      const hide = journeyActive || lens === 'product';
      for (const id of [...ROUTE_LAYERS, ...PICKER_LAYERS]) m.setLayoutProperty(id, 'visibility', hide ? 'none' : 'visible');
      // the journey and the store picker live on the globe; only a very wide route overview goes flat
      if (!computed || journeyActive) setGlobe(m, true);
      marker.current?.getElement().classList.toggle('hidden', hide);
      if (computed && !hide) {
        fitTo(m, routeCoords(computed), hudPad(m, dockRef.current, 150), 12, 1200);
      }
    };
    if (ready.current) apply(); else m.once(READY, apply);
  }, [computed, journeyActive, lens]);

  // ---- active step highlight (hover)
  useEffect(() => {
    const m = map.current; if (!m || !ready.current || !m.getLayer('legs-active')) return;
    m.setFilter('legs-active', ['==', ['get', 'index'], activeStep ?? -1]);
  }, [activeStep]);

  // ---- zoom to a step (click)
  useEffect(() => {
    const m = map.current; if (!m || !ready.current) return;
    if (focusStep && computed) {
      const s = computed.steps.find((x) => x.index === focusStep.index);
      if (s?.kind === 'node') m.easeTo({ center: s.coords, zoom: Math.max(m.getZoom(), 9), padding: hudPad(m, dockRef.current, 150) });
      else if (s?.kind === 'leg') fitTo(m, s.path, hudPad(m, dockRef.current, 150), 11, 800);
    }
  }, [focusStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- hotbar hover: sketch the product's route, mark where it grows, and frame it (local or across the world)
  useEffect(() => {
    const m = map.current; if (!m || !ready.current) return;
    window.clearTimeout(previewTimer.current);
    if (preview) {
      previewTimer.current = window.setTimeout(() => {
        const pad = hudPad(m, dockRef.current, PREVIEW_BOTTOM);
        if (m.getContainer().clientWidth >= 820) pad.right = PREVIEW_RIGHT;
        // routes too wide for one side of the globe (New Zealand) go flat here too, so the whole route fits
        fitTo(m, routeCoords(preview), pad, 10, 900, { essential: false });
      }, PREVIEW_DELAY_MS);
    } else if (!journeyActive) {
      // the pointer left the aisle: back to the route on show, or to the board around the store
      previewTimer.current = window.setTimeout(() => {
        const now = latest.current;
        if (now.journeyActive) return;
        if (now.computed) fitTo(m, routeCoords(now.computed), hudPad(m, dockRef.current, 150), 12, 900);
        else if (now.store) boardView(m, now.store, dockRef.current, 1000);
      }, PREVIEW_RETURN_MS);
    }
    const legs = preview ? preview.steps.filter((s) => s.kind === 'leg').map((s) => ({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: s.path }, properties: { color: MODES[s.mode].color } })) : [];
    (m.getSource('preview') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: legs });
    previewPin.current?.remove(); previewPin.current = null;
    const origin = preview?.steps[0];
    if (preview && origin?.kind === 'node') {
      const elm = document.createElement('div'); elm.className = 'preview-pin';
      const ring = document.createElement('span'); ring.className = 'pp-ring';
      const dot = document.createElement('span'); dot.className = 'pp-dot'; dot.textContent = preview.product.emoji;
      const label = document.createElement('span'); label.className = 'pp-label'; label.textContent = `Grown in ${preview.route.origin.region}`;
      elm.append(ring, dot, label);
      previewPin.current = new Marker({ element: elm, anchor: 'center' }).setLngLat(origin.coords).addTo(m);
    }
  }, [preview]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- product lens: draw the lifecycle and frame it, or go back to the globe / the supermarket story
  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => {
      overlay.current?.show(lifecycle);
      overlay.current?.setFocus(null);
      if (lifecycle) fitTo(m, lifecycleCoords(lifecycle, null), hudPad(m, dockRef.current, 150), 9, 1400);
      else if (lens === 'product') flyToGlobe(m);
      else restoreSupermarketView(m, latest.current, dockRef.current);
    };
    if (ready.current) apply(); else m.once(READY, apply);
  }, [lifecycle, lens]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current; if (!m || !ready.current || !lifecycle) return;
    overlay.current?.setFocus(lcFocus);
    fitTo(m, lifecycleCoords(lifecycle, lcFocus), hudPad(m, dockRef.current, 150), 9, 1000);
  }, [lcFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { overlay.current?.setVisible(!journeyActive); }, [journeyActive]);

  // ---- clouds on/off
  useEffect(() => {
    if (clouds.current) { clouds.current.enabled = fxClouds; map.current?.triggerRepaint(); }
  }, [fxClouds]);

  return <div ref={el} className="map" />;
}

/** Back in the supermarket lens: return to wherever that story was. */
function restoreSupermarketView(m: MapLibreMap, now: { chainId: string | null; store: StoreFeature | null; computed: ComputedRoute | null }, dock: boolean) {
  if (!now.chainId) flyToGlobe(m);
  else if (!now.store) m.fitBounds(NL_BOUNDS, { padding: hudPad(m, dock, 60), pitch: 0, bearing: 0, duration: 1600, essential: true });
  else if (now.computed) fitTo(m, routeCoords(now.computed), hudPad(m, dock, 150), 12, 1400);
  else boardView(m, now.store, dock, 1400);
}

/** The start screen: the whole planet, turning. */
function flyToGlobe(m: MapLibreMap) {
  setGlobe(m, true);
  const c = m.getContainer();
  m.flyTo({ center: GLOBE_CENTER, zoom: landingZoom(c.clientWidth, c.clientHeight), pitch: 0, bearing: 0, padding: LANDING_PAD, duration: 2400, essential: true });
}

/** What to frame for a lifecycle: everything, one country's distribution, or one grocer's. */
function lifecycleCoords(lc: Lifecycle, focus: LcFocus): Position[] {
  const flows = !focus || focus.kind === 'europe' ? lc.flows : lc.flows.filter((f) => (focus.kind === 'market' ? f.grocer.market : f.grocer.id) === focus.id);
  const out: Position[] = [];
  for (const f of flows) out.push(...(focus ? f.outbound : [...f.inbound, ...f.outbound]));
  return out.length ? out : lc.flows.flatMap((f) => f.inbound);
}

/** Every point along a route's legs. */
function routeCoords(c: ComputedRoute): Position[] {
  const coords: Position[] = [];
  for (const s of c.steps) if (s.kind === 'leg') coords.push(...s.path);
  return coords;
}

/** The board: Europe and the seas around the store, so the routes of hovered products have room. */
function boardView(m: MapLibreMap, store: StoreFeature, dock: boolean, duration: number) {
  const [lng, lat] = store.geometry.coordinates;
  const phone = m.getContainer().clientWidth < 820;
  setGlobe(m, true);
  m.flyTo({ center: phone ? [lng, lat - 5] : [lng + 2, lat - 9], zoom: phone ? 3 : 3.5, pitch: 0, bearing: 0, padding: hudPad(m, dock, 150), duration, essential: true });
}

/**
 * Fit the view to a set of (possibly antimeridian-unwrapped) coordinates. MapLibre's fitBounds
 * normalises longitudes, which breaks routes that run from New Zealand eastwards to Europe, and does
 * not know the globe's curvature; fitCam handles both. A route wider than GLOBE_MAX_SPAN cannot be
 * seen on one hemisphere, so it is shown on the flat (mercator) map instead. Non-essential moves jump
 * instead of animating for people who prefer reduced motion.
 */
function fitTo(m: MapLibreMap, coords: Position[], pad: Pad, maxZoom: number, duration: number, { essential = true } = {}) {
  if (!coords.length) return;
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coords) { minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon); minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); }
  const el = m.getContainer();
  if (maxLon - minLon <= GLOBE_MAX_SPAN) {
    setGlobe(m, true);
    const cam = fitCam(coords, el.clientWidth, el.clientHeight, pad, maxZoom);
    m.easeTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: 0, padding: pad, duration, essential });
    return;
  }
  setGlobe(m, false);
  const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360));
  const invMercY = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
  const w = Math.max(50, el.clientWidth - pad.left - pad.right), h = Math.max(50, el.clientHeight - pad.top - pad.bottom);
  const dx = Math.max(1e-6, (maxLon - minLon) / 360), dy = Math.max(1e-6, (mercY(maxLat) - mercY(minLat)) / (2 * Math.PI));
  const zoom = Math.max(0.5, Math.min(maxZoom, Math.log2(w / (512 * dx)), Math.log2(h / (512 * dy))));
  const center: [number, number] = [(minLon + maxLon) / 2, invMercY((mercY(minLat) + mercY(maxLat)) / 2)];
  m.easeTo({ center, zoom, pitch: 0, bearing: 0, padding: pad, duration, essential });
}

function setGlobe(m: MapLibreMap, globe: boolean) {
  const cur = (m.getProjection()?.type ?? 'mercator') as string;
  if ((cur === 'globe') !== globe) m.setProjection({ type: globe ? 'globe' : 'mercator' });
}
