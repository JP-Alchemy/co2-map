import { useEffect, useRef } from 'react';
import { AttributionControl, Map as MapLibreMap, Marker, NavigationControl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Point, Position } from 'geojson';
import { CHAINS, CHAIN_BY_ID, MODES } from '../data';
import { fitCam, type Pad } from '../map/camera';
import { CloudLayer } from '../map/clouds';
import { globeZoom, SATELLITE_STYLE } from '../map/style';
import type { ComputedRoute } from '../model/compute';
import { useApp, type StoreFeature } from '../store';
import type { StoreProps } from '../types';

const NL_BOUNDS: [number, number, number, number] = [3.2, 50.7, 7.3, 53.6];
/** Where the globe looks on the landing view: the Atlantic, with Europe, Africa and the Americas in sight. */
const GLOBE_CENTER: [number, number] = [-12, 28];
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
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
  onReady?: (map: MapLibreMap) => void;
}

export function MapView({ stores, computed, activeStep, focusStep, journeyActive, onReady }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const clouds = useRef<CloudLayer | null>(null);
  const ready = useRef(false);
  const marker = useRef<Marker | null>(null);
  const spin = useRef({ on: false, raf: 0 });
  const chainId = useApp((s) => s.chainId);
  const store = useApp((s) => s.store);
  const fxClouds = useApp((s) => s.fx.clouds);

  // ---- init
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new MapLibreMap({ container: el.current, style: SATELLITE_STYLE, center: GLOBE_CENTER, zoom: 1.5, attributionControl: false, maxPitch: 60 });
    // the container only gets its size once MapLibre has styled it
    m.jumpTo({ zoom: globeZoom(m.getContainer().clientWidth, m.getContainer().clientHeight) });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new AttributionControl({ compact: true, customAttribution: 'Stores © OpenStreetMap contributors' }), 'bottom-right');
    map.current = m;

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

      // animated dashes on route legs
      const seq = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
      let step = 0;
      const tick = (t: number) => {
        if (!map.current) return;
        const s = Math.floor((t / 60) % seq.length);
        if (s !== step) { step = s; if (m.getLayer('legs-dash') && m.getLayoutProperty('legs-dash', 'visibility') !== 'none') m.setPaintProperty('legs-dash', 'line-dasharray', seq[s]); }
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
      ready.current = true;
      m.fire(READY);
      onReady?.(m);
    });

    // any hand on the globe stops the landing-page spin
    const sp = spin.current;
    const stopSpin = () => { sp.on = false; };
    m.on('mousedown', stopSpin); m.on('touchstart', stopSpin); m.on('wheel', stopSpin);
    return () => { cancelAnimationFrame(sp.raf); m.remove(); map.current = null; ready.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- landing view: a slowly turning planet; picking a chain flies down to the Netherlands
  useEffect(() => {
    const m = map.current; if (!m) return;
    const sp = spin.current;
    cancelAnimationFrame(sp.raf);
    if (chainId) { sp.on = false; return; }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    sp.on = !reduced;
    let last = performance.now();
    const turn = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (sp.on && !m.isMoving()) {
        const c = m.getCenter();
        m.jumpTo({ center: [c.lng + dt * 3.2, c.lat] });
      }
      sp.raf = requestAnimationFrame(turn);
    };
    sp.raf = requestAnimationFrame(turn);
    return () => cancelAnimationFrame(sp.raf);
  }, [chainId]);

  // ---- stores + DCs by chain
  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => {
      const feats = stores && chainId ? stores.features.filter((f) => f.properties.chain === chainId) : [];
      (m.getSource('stores') as GeoJSONSource).setData({ type: 'FeatureCollection', features: feats });
      const chain = chainId ? CHAIN_BY_ID[chainId] : null;
      const dcFeats = chain ? [...chain.dcs.map((d) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: d.coords }, properties: { label: d.name.replace(/^.*?(DC|distribution centre|central DC|central fresh DC|frozen DC)\s*/i, 'DC '), color: chain.color } })),
        { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: chain.hq.coords }, properties: { label: 'Head office', color: '#111827' } }] : [];
      (m.getSource('dcs') as GeoJSONSource).setData({ type: 'FeatureCollection', features: dcFeats });
    };
    if (ready.current) apply(); else m.once(READY, apply);
  }, [stores, chainId]);

  // ---- camera: back out to the planet without a chain, down to the Netherlands with one
  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => {
      if (!chainId) {
        const c = m.getContainer();
        m.flyTo({ center: GLOBE_CENTER, zoom: globeZoom(c.clientWidth, c.clientHeight), pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 2400, essential: true });
      } else if (!useApp.getState().store) {
        m.fitBounds(NL_BOUNDS, { padding: { top: 40, bottom: 40, left: 40, right: 40 }, pitch: 0, bearing: 0, duration: 2600, essential: true });
      }
    };
    if (ready.current) apply(); else if (chainId) m.once(READY, apply);
  }, [chainId]);

  // ---- selected store marker
  useEffect(() => {
    const m = map.current; if (!m) return;
    marker.current?.remove(); marker.current = null;
    if (store) {
      const chain = CHAIN_BY_ID[store.properties.chain];
      const elm = document.createElement('div'); elm.className = 'store-marker'; elm.style.background = chain.color; elm.textContent = '🛒';
      marker.current = new Marker({ element: elm, anchor: 'center' }).setLngLat(store.geometry.coordinates as [number, number]).addTo(m);
      if (!computed) m.easeTo({ center: store.geometry.coordinates as [number, number], zoom: Math.max(m.getZoom(), 11), padding: { left: 0, top: 0, bottom: 0, right: 0 } });
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
      for (const id of [...ROUTE_LAYERS, ...PICKER_LAYERS]) m.setLayoutProperty(id, 'visibility', journeyActive ? 'none' : 'visible');
      marker.current?.getElement().classList.toggle('hidden', journeyActive);
      if (computed && !journeyActive) {
        const coords: Position[] = [];
        for (const s of computed.steps) if (s.kind === 'leg') coords.push(...s.path);
        fitTo(m, coords, { top: 60, bottom: 40, left: 40, right: 60 }, 12, 1200);
      }
    };
    if (ready.current) apply(); else m.once(READY, apply);
  }, [computed, journeyActive]);

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
      if (s?.kind === 'node') m.easeTo({ center: s.coords, zoom: Math.max(m.getZoom(), 9), padding: { left: 0, top: 0, bottom: 0, right: 0 } });
      else if (s?.kind === 'leg') fitTo(m, s.path, { top: 80, bottom: 80, left: 80, right: 80 }, 11, 800);
    }
  }, [focusStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- clouds on/off
  useEffect(() => {
    if (clouds.current) { clouds.current.enabled = fxClouds; map.current?.triggerRepaint(); }
  }, [fxClouds]);

  return <div ref={el} className="map" />;
}

/**
 * Fit the view to a set of (possibly antimeridian-unwrapped) coordinates. MapLibre's fitBounds
 * normalises longitudes, which breaks routes that run from New Zealand eastwards to Europe, and does
 * not know the globe's curvature; fitCam handles both.
 */
function fitTo(m: MapLibreMap, coords: Position[], pad: Pad, maxZoom: number, duration: number) {
  if (!coords.length) return;
  const el = m.getContainer();
  const cam = fitCam(coords, el.clientWidth, el.clientHeight, pad, maxZoom);
  m.easeTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: 0, padding: pad, duration });
}
