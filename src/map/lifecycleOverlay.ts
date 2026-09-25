import { Marker, Popup, type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent, type ExpressionSpecification } from 'maplibre-gl';
import type { Feature, FeatureCollection, Point, Position } from 'geojson';
import { MODES } from '../data';
import { MARKET_BY_ID, type Market } from '../data/markets';
import { fmtKg } from '../model/compute';
import { haversineKm } from '../model/geo';
import type { LcFocus, Lifecycle } from '../model/lifecycle';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const SOURCES = ['lc-in', 'lc-out', 'lc-hubs', 'lc-dcs', 'lc-particles', 'lcp'];
const LAYERS = ['lc-in-casing', 'lc-in', 'lc-out', 'lc-hubs', 'lc-dcs', 'lc-p-glow', 'lc-p'];
/** Where each country's badge sits: near its grocers, spread out so the badges don't pile up on each other. */
const BADGE_AT: Record<Market, [number, number]> = { NL: [5.9, 53.45], BE: [3.2, 50.3], DE: [10.3, 51.4], GB: [-2.7, 53.7], FR: [2.2, 47.3], SE: [15.4, 58.6] };
/** Particles on the map at most, spread over the flows by volume. */
const MAX_PARTICLES = 380;

interface Stream { path: Position[]; cum: number[]; period: number; color: string; market: Market; grocer: string }
interface Particle { s: number; phase: number; f: Feature<Point, { color: string; market: string; grocer: string }> }

const pctOf = (v: number) => (v < 0.01 ? '<1%' : `${Math.round(v * 100)}%`);

/** The supply lines (by mode, as wide as the origin's share) and distribution lines (by country, as wide as the flow) of a lifecycle. */
function networkFeatures(lc: Lifecycle): Feature[] {
  const feats: Feature[] = [];
  for (const o of lc.origins) {
    const cut = o.route.steps.length;
    for (const s of o.computed.steps) {
      if (s.kind !== 'leg' || s.index >= cut) continue;
      feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: s.path }, properties: { color: MODES[s.mode].color, w: 2 + 7 * Math.sqrt(o.weight), part: 'in' } });
    }
  }
  for (const f of lc.flows) {
    if (f.outbound.length < 2) continue;
    feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: f.outbound }, properties: { color: MARKET_BY_ID[f.grocer.market].color, w: 0.8 + 11 * Math.sqrt(f.volume), part: 'out', market: f.grocer.market, grocer: f.grocer.id } });
  }
  return feats;
}

/**
 * Draws a product's lifecycle on the map: supply lines from each origin to its dispatch point (coloured
 * by transport mode), distribution lines from there to every grocer (coloured by country, as wide as
 * their share), glowing particles flowing along all of them, and pins for origins and countries.
 */
export class LifecycleOverlay {
  private markers: Marker[] = [];
  /** a hovered product's network, sketched over (and instead of) the one on show */
  private previewMarkers: Marker[] = [];
  private previewing = false;
  private particles: Particle[] = [];
  private streams: Stream[] = [];
  private raf = 0;
  private visible = true;
  private popup = new Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'hud-popup', maxWidth: '260px' });
  onFocus: (f: LcFocus) => void = () => {};
  private m: MapLibreMap;

  constructor(m: MapLibreMap) {
    this.m = m;
    for (const s of SOURCES) m.addSource(s, { type: 'geojson', data: EMPTY });
    const line = { 'line-cap': 'round', 'line-join': 'round' } as const;
    m.addLayer({ id: 'lc-in-casing', type: 'line', source: 'lc-in', layout: line, paint: { 'line-color': '#020617', 'line-width': ['+', ['get', 'w'], 3], 'line-opacity': 0.6 } });
    m.addLayer({ id: 'lc-in', type: 'line', source: 'lc-in', layout: line, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'w'], 'line-opacity': 0.9 } });
    m.addLayer({ id: 'lc-out', type: 'line', source: 'lc-out', layout: line, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'w'], 'line-opacity': 0.5 } });
    m.addLayer({ id: 'lc-hubs', type: 'circle', source: 'lc-hubs', paint: { 'circle-color': '#fff', 'circle-radius': 4.5, 'circle-stroke-color': '#0f172a', 'circle-stroke-width': 2.5 } });
    m.addLayer({ id: 'lc-dcs', type: 'circle', source: 'lc-dcs', paint: { 'circle-color': ['get', 'color'], 'circle-radius': ['get', 'r'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.6, 'circle-opacity': 1, 'circle-stroke-opacity': 1 } });
    m.addLayer({ id: 'lc-p-glow', type: 'circle', source: 'lc-particles', paint: { 'circle-color': ['get', 'color'], 'circle-radius': 6.5, 'circle-blur': 1, 'circle-opacity': 0.55 } });
    m.addLayer({ id: 'lc-p', type: 'circle', source: 'lc-particles', paint: { 'circle-color': '#fff', 'circle-radius': 2.1, 'circle-opacity': 0.95, 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 1.2 } });
    // the hover preview: the same network drawn lighter, with marching dashes (animated by the map view)
    m.addLayer({ id: 'lcp-glow', type: 'line', source: 'lcp', layout: line, paint: { 'line-color': ['get', 'color'], 'line-width': ['+', ['*', ['get', 'w'], 1.6], 6], 'line-blur': 8, 'line-opacity': 0.45 } });
    m.addLayer({ id: 'lcp-line', type: 'line', source: 'lcp', layout: line, paint: { 'line-color': ['get', 'color'], 'line-width': ['max', 1.6, ['*', ['get', 'w'], 0.7]], 'line-opacity': ['case', ['==', ['get', 'part'], 'in'], 0.95, 0.8] } });
    m.addLayer({ id: 'lcp-dash', type: 'line', source: 'lcp', layout: line, paint: { 'line-color': '#fff', 'line-width': 1.4, 'line-opacity': 0.85, 'line-dasharray': [0, 4, 3] } });

    const hover = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]; if (!f) return;
      m.getCanvas().style.cursor = f.layer.id === 'lc-dcs' ? 'pointer' : '';
      const p = f.properties as { label: string; sub: string };
      const body = document.createElement('div');
      const b = document.createElement('b'); b.textContent = p.label;
      const s = document.createElement('small'); s.textContent = p.sub;
      body.append(b, s);
      this.popup.setLngLat((f.geometry as Point).coordinates as [number, number]).setDOMContent(body).addTo(m);
    };
    const leave = () => { m.getCanvas().style.cursor = ''; this.popup.remove(); };
    for (const id of ['lc-dcs', 'lc-hubs']) { m.on('mousemove', id, hover); m.on('mouseleave', id, leave); }
    // zoomed out, the country badges shrink to their flags so they don't pile up
    m.on('zoom', () => this.compact());
    m.on('click', 'lc-dcs', (e: MapLayerMouseEvent) => {
      const g = e.features?.[0]?.properties?.grocer as string | undefined;
      if (g) this.onFocus({ kind: 'grocer', id: g });
    });
  }

  /** Show a lifecycle (or nothing). */
  show(lc: Lifecycle | null) {
    this.clearMarkers();
    this.popup.remove();
    const set = (id: string, fc: FeatureCollection) => (this.m.getSource(id) as GeoJSONSource | undefined)?.setData(fc);
    if (!lc) {
      for (const s of SOURCES) if (s !== 'lcp') set(s, EMPTY);
      this.streams = []; this.particles = [];
      this.stop();
      return;
    }

    // supply: each origin's legs up to the dispatch point, by mode; distribution: on to each grocer, by country
    const net = networkFeatures(lc);
    set('lc-in', { type: 'FeatureCollection', features: net.filter((f) => f.properties!.part === 'in') });
    set('lc-out', { type: 'FeatureCollection', features: net.filter((f) => f.properties!.part === 'out') });

    set('lc-hubs', {
      type: 'FeatureCollection',
      features: lc.hubs.map((h) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: flowCoordsOf(lc, h.id) ?? h.coords }, properties: { label: h.name, sub: hubLabel(h.kind) } })),
    });

    // one dot per grocer distribution centre, sized by volume
    const dcVol = new Map<string, { f: (typeof lc.flows)[number]; v: number }>();
    for (const f of lc.flows) {
      const k = `${f.grocer.id}|${f.dc.id}`;
      const cur = dcVol.get(k);
      dcVol.set(k, { f, v: (cur?.v ?? 0) + f.volume });
    }
    const gTotals = new Map(lc.markets.flatMap((m) => m.grocers.map((g) => [g.grocer.id, g])));
    set('lc-dcs', {
      type: 'FeatureCollection',
      features: [...dcVol.values()].map(({ f, v }) => {
        const g = gTotals.get(f.grocer.id);
        const end = f.outbound[f.outbound.length - 1] ?? f.dc.coords;
        return {
          type: 'Feature', geometry: { type: 'Point', coordinates: end },
          properties: {
            color: f.grocer.color, r: 3.5 + 9 * Math.sqrt(v), market: f.grocer.market, grocer: f.grocer.id,
            label: `${f.grocer.name} · ${MARKET_BY_ID[f.grocer.market].name}`,
            sub: `${pctOf(g?.volume ?? v)} of the volume · ${fmtKg(g?.co2 ?? f.computed.co2e.total)} kg CO₂e/kg · ${f.dc.name}`,
          },
        };
      }),
    });

    // origins and country badges
    for (const o of lc.origins) {
      const at = o.computed.steps[0].kind === 'node' ? o.computed.steps[0].coords : o.route.steps[0];
      const el = document.createElement('div'); el.className = 'lc-origin';
      const dot = document.createElement('span'); dot.className = 'lc-o-dot'; dot.textContent = lc.product.emoji;
      const lab = document.createElement('span'); lab.className = 'lc-o-label';
      lab.textContent = `${flagOf(o.route.origin.country)} ${o.route.origin.region} · ${pctOf(o.weight)}`;
      el.append(dot, lab);
      this.markers.push(new Marker({ element: el, anchor: 'center' }).setLngLat(at as [number, number]).addTo(this.m));
    }
    for (const mk of lc.markets) {
      const meta = MARKET_BY_ID[mk.market];
      // MapLibre positions the marker element with a transform, so the badge's own animations live on a child
      const el = document.createElement('div'); el.className = 'lc-badge-pin';
      el.dataset.market = mk.market;
      const btn = document.createElement('button'); btn.className = 'lc-badge'; btn.type = 'button';
      btn.style.setProperty('--c', meta.color);
      const flag = document.createElement('span'); flag.className = 'lc-b-flag'; flag.textContent = flagOf(mk.market);
      const name = document.createElement('span'); name.className = 'lc-b-name'; name.textContent = meta.name;
      const pct = document.createElement('b'); pct.textContent = pctOf(mk.volume);
      btn.append(flag, name, pct);
      btn.addEventListener('click', () => this.onFocus({ kind: 'market', id: mk.market }));
      el.append(btn);
      this.markers.push(new Marker({ element: el, anchor: 'center' }).setLngLat(BADGE_AT[mk.market]).addTo(this.m));
    }

    this.compact();

    this.applyVisibility();

    // particles: a stream per flow from its farm all the way to the grocer
    this.streams = lc.flows.map((f) => {
      const path = [...f.inbound, ...f.outbound.slice(1)];
      const cum = [0];
      for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversineKm(path[i - 1] as [number, number], path[i] as [number, number]));
      const km = cum[cum.length - 1];
      return { path, cum, period: 6 + 2.2 * Math.log10(1 + km / 50), color: MARKET_BY_ID[f.grocer.market].color, market: f.grocer.market, grocer: f.grocer.id };
    });
    const want = lc.flows.map((f) => Math.max(1, Math.round(f.volume * 140)));
    const scale = Math.min(1, MAX_PARTICLES / want.reduce((s, v) => s + v, 0));
    this.particles = [];
    this.streams.forEach((st, s) => {
      const k = Math.max(1, Math.round(want[s] * scale));
      for (let i = 0; i < k; i++) {
        this.particles.push({ s, phase: (i + Math.random() * 0.8) / k, f: { type: 'Feature', geometry: { type: 'Point', coordinates: st.path[0] }, properties: { color: st.color, market: st.market, grocer: st.grocer } } });
      }
    });
    this.start();
  }

  /** Highlight a country or a grocer; everything else fades back. */
  setFocus(f: LcFocus) {
    const m = this.m;
    const focus = f && f.kind !== 'europe' ? f : null;
    const on: ExpressionSpecification | boolean = focus ? ['==', ['get', focus.kind], focus.id] : true;
    const pick = (a: number, b: number) => (focus ? ['case', on, a, b] as ExpressionSpecification : a);
    m.setPaintProperty('lc-out', 'line-opacity', pick(0.85, 0.06));
    m.setPaintProperty('lc-dcs', 'circle-opacity', pick(1, 0.2));
    m.setPaintProperty('lc-dcs', 'circle-stroke-opacity', pick(1, 0.2));
    m.setPaintProperty('lc-p', 'circle-opacity', pick(0.95, 0.08));
    m.setPaintProperty('lc-p-glow', 'circle-opacity', pick(0.6, 0.04));
    m.setPaintProperty('lc-in', 'line-opacity', focus ? 0.55 : 0.9);
    for (const el of this.markers) {
      const b = el.getElement();
      if (b.dataset.market) b.firstElementChild?.classList.toggle('dim', !!focus && !(focus.kind === 'market' ? focus.id === b.dataset.market : false));
    }
  }

  setVisible(v: boolean) {
    this.visible = v;
    this.applyVisibility();
  }

  /**
   * Sketch a hovered product's whole network (or clear the sketch): supply and distribution lines,
   * where it grows and which countries it reaches. The lifecycle on show steps aside meanwhile.
   */
  preview(lc: Lifecycle | null) {
    for (const mk of this.previewMarkers) mk.remove();
    this.previewMarkers = [];
    (this.m.getSource('lcp') as GeoJSONSource | undefined)?.setData(lc ? { type: 'FeatureCollection', features: networkFeatures(lc) } : EMPTY);
    this.previewing = !!lc;
    this.applyVisibility();
    if (!lc) return;
    for (const o of lc.origins) {
      const at = o.computed.steps[0].kind === 'node' ? o.computed.steps[0].coords : o.route.steps[0];
      const el = document.createElement('div'); el.className = 'preview-pin';
      const ring = document.createElement('span'); ring.className = 'pp-ring';
      const dot = document.createElement('span'); dot.className = 'pp-dot'; dot.textContent = lc.product.emoji;
      const label = document.createElement('span'); label.className = 'pp-label';
      label.textContent = `${flagOf(o.route.origin.country)} ${o.route.origin.region}${lc.origins.length > 1 ? ` · ${pctOf(o.weight)}` : ''}`;
      el.append(ring, dot, label);
      this.previewMarkers.push(new Marker({ element: el, anchor: 'center' }).setLngLat(at as [number, number]).addTo(this.m));
    }
    for (const mk of lc.markets) {
      const el = document.createElement('div'); el.className = 'lc-badge-pin preview';
      const chip = document.createElement('span'); chip.className = 'lc-badge';
      chip.style.setProperty('--c', MARKET_BY_ID[mk.market].color);
      const flag = document.createElement('span'); flag.className = 'lc-b-flag'; flag.textContent = flagOf(mk.market);
      const pct = document.createElement('b'); pct.textContent = pctOf(mk.volume);
      chip.append(flag, pct);
      el.append(chip);
      this.previewMarkers.push(new Marker({ element: el, anchor: 'center' }).setLngLat(BADGE_AT[mk.market]).addTo(this.m));
    }
  }

  destroy() { this.stop(); this.clearMarkers(); this.preview(null); this.popup.remove(); }

  /** The lifecycle on show is drawn unless a journey is playing over it or another product is being previewed. */
  private applyVisibility() {
    const v = this.visible && !this.previewing;
    for (const id of LAYERS) if (this.m.getLayer(id)) this.m.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
    for (const mk of this.markers) mk.getElement().style.display = v ? '' : 'none';
    if (v) this.start(); else this.stop();
  }

  private compact() {
    const small = this.m.getZoom() < 4;
    for (const mk of this.markers) { const el = mk.getElement(); if (el.dataset.market) el.classList.toggle('compact', small); }
  }
  private clearMarkers() { for (const mk of this.markers) mk.remove(); this.markers = []; }
  private stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  private start() {
    if (this.raf || !this.visible || this.previewing || !this.particles.length) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const src = this.m.getSource('lc-particles') as GeoJSONSource | undefined;
    const tick = (now: number) => {
      const t = now / 1000;
      for (const p of this.particles) {
        const st = this.streams[p.s];
        const f = still ? p.phase : (t / st.period + p.phase) % 1;
        p.f.geometry.coordinates = along(st, f);
      }
      src?.setData({ type: 'FeatureCollection', features: this.particles.map((p) => p.f) });
      this.raf = still ? 0 : requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
}

/** Point a fraction of the way along a stream, by distance. */
function along(st: Stream, f: number): Position {
  const { path, cum } = st;
  const target = f * cum[cum.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= target) lo = mid; else hi = mid; }
  const k = (target - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
  return [path[lo][0] + (path[hi][0] - path[lo][0]) * k, path[lo][1] + (path[hi][1] - path[lo][1]) * k];
}

/** The drawn (possibly antimeridian-unwrapped) position of a place on a lifecycle's routes. */
function flowCoordsOf(lc: Lifecycle, placeId: string): Position | null {
  for (const f of lc.flows) for (const s of f.computed.steps) if (s.kind === 'node' && s.place.id === placeId) return s.coords;
  return null;
}

function hubLabel(kind: string) {
  return ({ port: 'Port', airport: 'Airport', importer: 'Importer / trader', ripening: 'Ripening centre', packhouse: 'Packhouse', processor: 'Processor', cooperative: 'Cooperative / auction' } as Record<string, string>)[kind] ?? 'Handling point';
}

function flagOf(cc: string) {
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
