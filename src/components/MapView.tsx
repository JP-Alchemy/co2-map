import { useEffect, useRef } from 'react';
import { AttributionControl, Map as MapLibreMap, Marker, NavigationControl, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Point, Position } from 'geojson';
import { CHAINS, CHAIN_BY_ID, MODES } from '../data';
import type { ComputedRoute } from '../model/compute';
import { useApp, type StoreFeature } from '../store';
import type { StoreProps } from '../types';

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const NL_BOUNDS: [number, number, number, number] = [3.2, 50.7, 7.3, 53.6];
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
/** Landing view: a globe with Europe and the Atlantic in view */
const GLOBE_VIEW = { center: [-10, 32] as [number, number], zoom: 1.8 };
/** One full rotation of the idle globe takes this long */
const SPIN_MS = 90_000;
/** Custom event fired once all sources and layers exist (typed as a built-in event name to satisfy MapLibre's typings). */
const READY = 'app-ready' as unknown as 'load';

interface Props {
  stores: FeatureCollection<Point, StoreProps> | null;
  computed: ComputedRoute | null;
  /** step highlighted on hover */
  activeStep: number | null;
  /** step the map should zoom to (set on click); the counter makes repeated clicks re-trigger */
  focusStep: { index: number; n: number } | null;
}

export function MapView({ stores, computed, activeStep, focusStep }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const ready = useRef(false);
  const marker = useRef<Marker | null>(null);
  const spin = useRef(false);
  const startSpin = useRef<() => void>(() => {});
  const stopSpin = useRef<() => void>(() => {});
  const chainId = useApp((s) => s.chainId);
  const store = useApp((s) => s.store);
  const setStore = useApp((s) => s.setStore);

  // ---- init
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new MapLibreMap({ container: el.current, style: STYLE, center: GLOBE_VIEW.center, zoom: GLOBE_VIEW.zoom, attributionControl: false });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new AttributionControl({ compact: true, customAttribution: 'Stores © OpenStreetMap contributors' }), 'bottom-right');
    map.current = m;
    if (import.meta.env.DEV) Object.assign(window, { __map: m, __spin: spin });

    // Idle spin: linear easeTo in 45° steps (the globe projection normalises a +360° target to a no-op),
    // chained from moveend while spinning is on.
    const SPIN_STEP = 45;
    const spinOnce = () => {
      if (!spin.current) return;
      const c = m.getCenter();
      m.easeTo({ center: [c.lng + SPIN_STEP, c.lat], duration: (SPIN_MS * SPIN_STEP) / 360, easing: (t) => t, essential: true });
    };
    startSpin.current = () => { if (spin.current) return; spin.current = true; spinOnce(); };
    stopSpin.current = () => { if (!spin.current) return; spin.current = false; m.stop(); };
    m.on('moveend', () => { if (spin.current) spinOnce(); });
    for (const ev of ['mousedown', 'touchstart', 'wheel'] as const) m.on(ev, () => stopSpin.current());

    m.on('style.load', () => {
      m.setProjection({ type: 'globe' });
      m.setSky({ 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] } as never);
    });

    m.on('load', () => {
      const chainColor: unknown[] = ['match', ['get', 'chain']];
      for (const c of CHAINS) chainColor.push(c.id, c.color);
      chainColor.push('#888');

      m.addSource('stores', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 45, clusterMaxZoom: 11 });
      m.addLayer({ id: 'clusters', type: 'circle', source: 'stores', filter: ['has', 'point_count'],
        paint: { 'circle-color': '#334155', 'circle-opacity': 0.85, 'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 100, 24], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
      m.addLayer({ id: 'cluster-count', type: 'symbol', source: 'stores', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 11 }, paint: { 'text-color': '#fff' } });
      m.addLayer({ id: 'stores-pt', type: 'circle', source: 'stores', filter: ['!', ['has', 'point_count']],
        paint: { 'circle-color': chainColor as never, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 8], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' } });

      m.addSource('dcs', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'dcs', type: 'circle', source: 'dcs',
        paint: { 'circle-color': ['get', 'color'], 'circle-radius': 9, 'circle-stroke-width': 3, 'circle-stroke-color': '#111827', 'circle-opacity': 0.95 } });
      m.addLayer({ id: 'dcs-label', type: 'symbol', source: 'dcs',
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#111827', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });

      m.addSource('legs', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'legs-casing', type: 'line', source: 'legs', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#fff', 'line-width': 7, 'line-opacity': 0.9 } });
      m.addLayer({ id: 'legs', type: 'line', source: 'legs', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 3.5 } });
      m.addLayer({ id: 'legs-dash', type: 'line', source: 'legs', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#fff', 'line-width': 2, 'line-opacity': 0.9, 'line-dasharray': [0, 4, 3] } });
      m.addLayer({ id: 'legs-active', type: 'line', source: 'legs', filter: ['==', ['get', 'index'], -1], layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#111827', 'line-width': 9, 'line-opacity': 0.35 } });

      m.addSource('nodes', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'nodes', type: 'circle', source: 'nodes',
        paint: { 'circle-color': '#fff', 'circle-radius': ['case', ['get', 'major'], 7, 5], 'circle-stroke-width': 3, 'circle-stroke-color': '#111827' } });
      m.addLayer({ id: 'nodes-label', type: 'symbol', source: 'nodes',
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 12 },
        paint: { 'text-color': '#111827', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });

      // animated dashes on route legs
      const seq = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
      let step = 0;
      const tick = (t: number) => {
        const s = Math.floor((t / 60) % seq.length);
        if (s !== step) { step = s; if (m.getLayer('legs-dash')) m.setPaintProperty('legs-dash', 'line-dasharray', seq[s]); }
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
      if (!useApp.getState().chainId) startSpin.current();
    });
    return () => { m.remove(); map.current = null; ready.current = false; };
  }, [setStore]);

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
      if (!chainId) {
        stopSpin.current();
        m.easeTo({ ...GLOBE_VIEW, duration: 1500, essential: true });
        m.once('moveend', () => { if (!useApp.getState().chainId) startSpin.current(); });
      } else if (!store) {
        stopSpin.current();
        setGlobe(m, true);
        m.fitBounds(NL_BOUNDS, { padding: { top: 40, bottom: 40, left: sidebarPad(), right: 40 }, duration: 2000, essential: true });
      }
    };
    if (ready.current) apply(); else m.once(READY, apply);
  }, [stores, chainId, store]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- selected store marker
  useEffect(() => {
    const m = map.current; if (!m) return;
    marker.current?.remove(); marker.current = null;
    if (store) {
      const chain = CHAIN_BY_ID[store.properties.chain];
      const elm = document.createElement('div'); elm.className = 'store-marker'; elm.style.background = chain.color; elm.textContent = '🛒';
      marker.current = new Marker({ element: elm, anchor: 'center' }).setLngLat(store.geometry.coordinates as [number, number]).addTo(m);
      if (!computed) m.easeTo({ center: store.geometry.coordinates as [number, number], zoom: Math.max(m.getZoom(), 11), padding: { left: sidebarPad(), top: 0, bottom: 0, right: 0 } });
    }
  }, [store]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- route
  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => {
      const legs = computed ? computed.steps.filter((s) => s.kind === 'leg').map((s) => ({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: s.path }, properties: { index: s.index, color: MODES[s.mode].color, mode: s.mode } })) : [];
      const nodes = computed ? computed.steps.filter((s) => s.kind === 'node').map((s) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: s.coords }, properties: { index: s.index, label: s.place.name.split(',')[0], major: s.step.role === 'origin' || s.step.role === 'store' } })) : [];
      (m.getSource('legs') as GeoJSONSource).setData({ type: 'FeatureCollection', features: legs });
      (m.getSource('nodes') as GeoJSONSource).setData({ type: 'FeatureCollection', features: nodes });
      if (!computed) setGlobe(m, true);
      if (computed) {
        const coords: Position[] = [];
        for (const s of computed.steps) if (s.kind === 'leg') coords.push(...s.path);
        fitCoords(m, coords, { top: 60, bottom: 40, left: sidebarPad() + 40, right: 60 }, 12, 1200);
      }
    };
    if (ready.current) apply(); else m.once(READY, apply);
  }, [computed]);

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
      if (s?.kind === 'node') m.easeTo({ center: s.coords, zoom: Math.max(m.getZoom(), 9), padding: { left: sidebarPad(), top: 0, bottom: 0, right: 0 } });
      else if (s?.kind === 'leg') fitCoords(m, s.path, { top: 80, bottom: 80, left: sidebarPad() + 80, right: 80 }, 11, 800);
    }
  }, [focusStep]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="map" />;
}

function sidebarPad() { return 0; } // the sidebar sits beside the map, not over it

/** Longitude span above which a route cannot be seen on one hemisphere, so the map falls back to the flat projection. */
const GLOBE_MAX_SPAN = 140;

/**
 * Fit the view to a set of (possibly antimeridian-unwrapped) coordinates. MapLibre's fitBounds
 * normalises longitudes, which breaks routes that run from New Zealand eastwards to Europe;
 * computing centre and zoom by hand keeps the route in one piece. On the globe the visible width
 * of an arc is proportional to sin(span/2), so wide routes need a different zoom than on Mercator.
 */
function fitCoords(m: MapLibreMap, coords: Position[], pad: { top: number; bottom: number; left: number; right: number }, maxZoom: number, duration: number) {
  if (!coords.length) return;
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coords) { minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon); minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); }
  const dLon = maxLon - minLon, dLat = maxLat - minLat;
  const wide = dLon > GLOBE_MAX_SPAN;
  setGlobe(m, !wide);
  const el = m.getContainer();
  const w = Math.max(50, el.clientWidth - pad.left - pad.right), h = Math.max(50, el.clientHeight - pad.top - pad.bottom);
  const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360));
  const invMercY = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
  let zoom: number;
  if (wide) {
    const dx = Math.max(1e-6, dLon / 360), dy = Math.max(1e-6, (mercY(maxLat) - mercY(minLat)) / (2 * Math.PI));
    zoom = Math.min(Math.log2(w / (512 * dx)), Math.log2(h / (512 * dy)));
  } else {
    // globe: diameter ≈ 512·2^z/π px; an arc of angle a spans ≈ diameter·sin(a/2) px at the centre of the view
    const rad = Math.PI / 180, D0 = 512 / Math.PI;
    const sx = Math.max(1e-4, Math.sin((Math.min(dLon, 179) * rad) / 2)), sy = Math.max(1e-4, Math.sin((Math.min(dLat + 6, 179) * rad) / 2));
    zoom = Math.min(Math.log2(w / (D0 * sx)), Math.log2(h / (D0 * sy))) - 0.15;
  }
  zoom = Math.max(0.5, Math.min(maxZoom, zoom));
  const center: [number, number] = [(minLon + maxLon) / 2, wide ? invMercY((mercY(minLat) + mercY(maxLat)) / 2) : (minLat + maxLat) / 2];
  m.easeTo({ center, zoom, padding: pad, duration, essential: true });
}

function setGlobe(m: MapLibreMap, globe: boolean) {
  const cur = (m.getProjection()?.type ?? 'mercator') as string;
  if ((cur === 'globe') !== globe) m.setProjection({ type: globe ? 'globe' : 'mercator' });
}
