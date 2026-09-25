import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Marker, type GeoJSONSource, type Map as MapLibreMap, type MapLibreEvent } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { MODES } from '../data';
import { CAR_KG_PER_KM } from '../data/factors';
import { ROLE_ICON, ROLE_LABEL } from '../data/labels';
import {
  COST_PARTS, buildTimeline, camAt, co2Of, costOf, fmtCo2, fmtFuel, fmtKmNum, fmtTime, legFraction, legPartial, legPos,
  segProgress, segmentIndexAt, totalsAt, type Segment, type Timeline, type Totals,
} from '../journey/timeline';
import { MODE_BLURB, vehicleSvg } from '../journey/vehicles';
import { clamp01, type Cam, type Pad } from '../map/camera';
import { fmtEur, type ComputedRoute } from '../model/compute';
import type { TransportMode } from '../types';
import { Flag } from './ui';

/**
 * Plays a product's journey on the globe (remount it, e.g. with a new key, to start over): the camera flies to the farm, a little vehicle for each mode
 * of transport drives, sails or flies each leg while its trail lights up, every stop pops up as it is
 * reached, and a ledger counts up distance, time, CO2e, fuel and money for one retail pack.
 */

interface Props {
  map: MapLibreMap;
  computed: ComputedRoute;
  /** jump to a step (sidebar click); the counter makes repeated clicks re-trigger */
  seek: { index: number; n: number } | null;
  onStep: (index: number | null) => void;
  onClose: () => void;
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const SOURCES = ['jr-ghost', 'jr-done', 'jr-live'];
const LAYERS = ['jr-ghost', 'jr-done-glow', 'jr-done-casing', 'jr-done-line', 'jr-live-glow', 'jr-live-casing', 'jr-live-line'];

function hudPad(w: number): Pad {
  if (w < 720) return { top: 110, bottom: 96, left: 28, right: 28 };
  return { top: 150, bottom: 118, left: 70, right: Math.min(340, w * 0.32) };
}
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
function currentCam(m: MapLibreMap): Cam {
  const c = m.getCenter();
  return { center: [c.lng, c.lat], zoom: m.getZoom(), pitch: m.getPitch() };
}
const shortName = (name: string) => name.split(',')[0];
/** A stop's pin: hidden until reached, big while there, a small dot afterwards (the store stays big). */
const pinState = (s: Segment, t: number, last: boolean) => (t < s.t0 ? 'hidden' : t < s.t1 || last ? 'active' : 'done');
const stepIndexOf = (s: Segment) => s.node?.index ?? s.leg?.index ?? null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, ...kids: (Node | string)[]) {
  const e = document.createElement(tag);
  e.className = cls;
  e.append(...kids);
  return e;
}

interface VehicleRig {
  marker: Marker; root: HTMLElement; inner: HTMLElement; lift: HTMLElement; turn: HTMLElement; body: HTMLElement; shadow: HTMLElement;
  key: number; heading: { x: number; y: number } | null; flip: boolean; shown: boolean;
}
interface Pin { seg: Segment; el: HTMLElement; marker: Marker; state: string; last: boolean }

export function JourneyPlayer({ map, computed, seek, onStep, onClose }: Props) {
  // with reduced motion the journey opens on its final frame; play is one click away
  const [reduced] = useState(reducedMotion);
  const [size, setSize] = useState(() => ({ w: map.getContainer().clientWidth, h: map.getContainer().clientHeight }));
  const [start] = useState<Cam>(() => currentCam(map));
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const [speed, setSpeed] = useState(1);
  const [follow, setFollow] = useState(true);

  const tl = useMemo(() => buildTimeline(computed, start, { w: size.w, h: size.h, pad: hudPad(size.w) }), [computed, start, size]);

  const tRef = useRef(reduced ? Number.MAX_VALUE : 0);
  const playingRef = useRef(!reduced);
  const speedRef = useRef(1);
  const followRef = useRef(true);
  const tlRef = useRef<Timeline>(tl);
  const dirty = useRef(true);
  const vehRef = useRef<VehicleRig | null>(null);
  const pinsRef = useRef<Pin[]>([]);
  const onStepRef = useRef(onStep);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onStepRef.current = onStep; onCloseRef.current = onClose; }, [onStep, onClose]);
  useEffect(() => { tlRef.current = tl; dirty.current = true; }, [tl]);

  const control = useMemo(() => ({
    play(on: boolean) {
      if (on && tRef.current >= tlRef.current.total - 1e-3) tRef.current = 0;
      playingRef.current = on; setPlaying(on); dirty.current = true;
    },
    seekTo(time: number) {
      tRef.current = Math.max(0, Math.min(tlRef.current.total, time));
      followRef.current = true; setFollow(true); dirty.current = true;
    },
    setSpeed(s: number) { speedRef.current = s; setSpeed(s); },
    follow() { followRef.current = true; setFollow(true); dirty.current = true; },
  }), []);

  // ---- jump to a step clicked in the sidebar
  useEffect(() => {
    if (!seek) return;
    const s = tlRef.current.segments.find((x) => stepIndexOf(x) === seek.index);
    if (s) control.seekTo(s.t0 + 0.001);
  }, [seek, control]);

  // ---- map layers, vehicle marker, interaction
  useEffect(() => {
    const m = map;
    for (const s of SOURCES) m.addSource(s, { type: 'geojson', data: EMPTY });
    const line = { 'line-cap': 'round', 'line-join': 'round' } as const;
    m.addLayer({ id: 'jr-ghost', type: 'line', source: 'jr-ghost', layout: line, paint: { 'line-color': '#ffffff', 'line-opacity': 0.45, 'line-width': 1.6, 'line-dasharray': [0.6, 2.2] } });
    for (const [src, glow] of [['jr-done', 0.35], ['jr-live', 0.7]] as const) {
      m.addLayer({ id: `${src}-glow`, type: 'line', source: src, layout: line, paint: { 'line-color': ['get', 'color'], 'line-width': 16, 'line-blur': 10, 'line-opacity': glow } });
      m.addLayer({ id: `${src}-casing`, type: 'line', source: src, layout: line, paint: { 'line-color': '#020617', 'line-width': 6.5, 'line-opacity': 0.7 } });
      m.addLayer({ id: `${src}-line`, type: 'line', source: src, layout: line, paint: { 'line-color': ['get', 'color'], 'line-width': 3.6 } });
    }

    const body = el('div', 'jveh-body');
    const turn = el('div', 'jveh-turn', body);
    const lift = el('div', 'jveh-lift', turn);
    const shadow = el('div', 'jveh-shadow');
    const inner = el('div', 'jveh-inner', shadow, lift);
    const root = el('div', 'jveh', inner);
    const marker = new Marker({ element: root, anchor: 'center', subpixelPositioning: true }).setLngLat([0, 0]).addTo(m);
    vehRef.current = { marker, root, inner, lift, turn, body, shadow, key: -1, heading: null, flip: false, shown: false };

    const onMoveStart = (e: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>) => {
      if (e.originalEvent) { followRef.current = false; setFollow(false); }
    };
    const onResize = () => setSize({ w: m.getContainer().clientWidth, h: m.getContainer().clientHeight });
    m.on('movestart', onMoveStart);
    m.on('resize', onResize);
    return () => {
      m.off('movestart', onMoveStart);
      m.off('resize', onResize);
      marker.remove();
      vehRef.current = null;
      try {
        for (const id of LAYERS) if (m.getLayer(id)) m.removeLayer(id);
        for (const s of SOURCES) if (m.getSource(s)) m.removeSource(s);
        m.getContainer().classList.remove('jr-finale');
        // hand the camera back without the HUD's padding (the map view may immediately take over)
        m.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 500 });
      } catch { /* map already torn down */ }
    };
  }, [map]);

  // ---- route preview and stop pins for this timeline
  useEffect(() => {
    const legs = tl.segments.filter((s) => s.kind === 'leg');
    (map.getSource('jr-ghost') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: legs.map((s) => lineFeature(s, s.leg!.path)) });
    const nodes = tl.segments.filter((s) => s.kind === 'node');
    // new pins start in the state the playhead implies, so a rebuilt timeline (e.g. road geometry arriving) doesn't re-pop them
    const now = Math.min(tRef.current, tl.total);
    const pins: Pin[] = nodes.map((s, i) => {
      const n = s.node!;
      const label = el('span', 'jpin-label', el('b', '', shortName(n.place.name)), el('small', '', ROLE_LABEL[n.step.role]));
      const root = el('div', 'jpin', el('div', 'jpin-inner', el('span', 'jpin-pulse'), el('span', 'jpin-dot', ROLE_ICON[n.step.role]), label));
      const last = i === nodes.length - 1;
      const state = pinState(s, now, last);
      root.dataset.state = state;
      root.dataset.role = n.step.role;
      if (i === 0 || last) root.dataset.major = '1';
      const marker = new Marker({ element: root, anchor: 'center' }).setLngLat(n.coords).addTo(map);
      return { seg: s, el: root, marker, state, last };
    });
    pinsRef.current = pins;
    dirty.current = true;
    return () => { for (const p of pins) p.marker.remove(); };
  }, [tl, map]);

  // ---- the frame loop: advance the playhead and pose everything on the map
  useEffect(() => {
    let raf = 0, last = performance.now();
    let doneKey = '', liveOn = false, lastStep: number | null | undefined, lastTl: Timeline | null = null;

    const setSrc = (id: string, data: FeatureCollection) => (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);

    const poseVehicle = (seg: Segment, p: number) => {
      const v = vehRef.current;
      if (!v) return;
      if (seg.kind !== 'leg') {
        if (v.shown) { v.inner.style.opacity = '0'; v.shown = false; }
        return;
      }
      const leg = seg.leg!;
      if (v.key !== seg.t0) {
        v.body.innerHTML = vehicleSvg(leg.mode, MODES[leg.mode].color);
        v.root.dataset.mode = leg.mode;
        v.key = seg.t0; v.heading = null;
      }
      const f = legFraction(p);
      v.marker.setLngLat(legPos(seg, f));
      // heading on screen, from a short window around the vehicle, smoothed so wiggly roads don't flicker
      const a = map.project(legPos(seg, Math.max(0, f - 0.025))), b = map.project(legPos(seg, Math.min(1, f + 0.025)));
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      if (len > 0.5) {
        const h = { x: dx / len, y: dy / len };
        v.heading = v.heading ? { x: v.heading.x + (h.x - v.heading.x) * 0.18, y: v.heading.y + (h.y - v.heading.y) * 0.18 } : h;
      }
      const hd = v.heading ?? { x: 1, y: 0 };
      if (hd.x < -0.25) v.flip = true; else if (hd.x > 0.25) v.flip = false;
      let rot = (Math.atan2(hd.y, v.flip ? -hd.x : hd.x) * 180) / Math.PI;
      const lim = leg.mode === 'reefer_ship' || leg.mode === 'ferry' ? 9 : 26;
      rot = Math.max(-lim, Math.min(lim, rot));
      let alt = 0;
      if (leg.mode === 'air') {
        alt = Math.sin(Math.PI * f) * 34;
        rot = Math.max(-32, Math.min(32, rot - 14 * Math.cos(Math.PI * f)));
      }
      const vis = clamp01(Math.min(p, 1 - p) / 0.07);
      v.inner.style.opacity = String(vis);
      v.inner.style.transform = `scale(${0.5 + 0.5 * vis})`;
      v.lift.style.transform = `translateY(${-alt}px)`;
      v.turn.style.transform = `scaleX(${v.flip ? -1 : 1}) rotate(${rot.toFixed(2)}deg)`;
      v.shadow.style.transform = `scale(${1 - alt / 70})`;
      v.shadow.style.opacity = String(0.55 - alt / 90);
      v.shown = true;
    };

    const apply = (t: number) => {
      const tl = tlRef.current;
      const i = segmentIndexAt(tl, t);
      const seg = tl.segments[i];
      const p = segProgress(seg, t);

      if (followRef.current) {
        const cam = camAt(tl, t);
        map.jumpTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: 0, padding: tl.view.pad });
      }

      let done = 0;
      for (const s of tl.segments) if (s.kind === 'leg' && t >= s.t1) done++;
      const key = `${done}`;
      if (key !== doneKey || tl !== lastTl) {
        doneKey = key;
        setSrc('jr-done', { type: 'FeatureCollection', features: tl.segments.filter((s) => s.kind === 'leg' && t >= s.t1).map((s) => lineFeature(s, s.leg!.path)) });
      }
      if (seg.kind === 'leg') {
        setSrc('jr-live', { type: 'FeatureCollection', features: [lineFeature(seg, legPartial(seg, legFraction(p)))] });
        liveOn = true;
      } else if (liveOn) {
        setSrc('jr-live', EMPTY);
        liveOn = false;
      }
      lastTl = tl;

      poseVehicle(seg, p);

      for (const pin of pinsRef.current) {
        const state = pinState(pin.seg, t, pin.last);
        if (state !== pin.state) { pin.el.dataset.state = state; pin.state = state; }
      }
      map.getContainer().classList.toggle('jr-finale', seg.kind === 'outro');

      const step = stepIndexOf(seg);
      if (step !== lastStep) { lastStep = step; onStepRef.current(step); }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const tl = tlRef.current;
      if (playingRef.current) {
        tRef.current = Math.min(tl.total, tRef.current + dt * speedRef.current);
        if (tRef.current >= tl.total) { playingRef.current = false; setPlaying(false); }
        dirty.current = true;
      }
      if (dirty.current) {
        dirty.current = false;
        tRef.current = Math.min(tRef.current, tl.total);
        apply(tRef.current);
        setT(tRef.current);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); onStepRef.current(null); };
  }, [map]);

  // ---- keyboard: space to pause, arrows to hop between stops, escape to leave
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === ' ' && tag === 'BUTTON') return; // the focused button handles its own space press
      const tl = tlRef.current, now = tRef.current;
      if (e.key === ' ') { e.preventDefault(); control.play(!playingRef.current); }
      else if (e.key === 'Escape') onCloseRef.current();
      else if (e.key === 'ArrowRight') { const s = tl.segments.find((x) => x.t0 > now + 0.01); control.seekTo(s ? s.t0 + 0.001 : tl.total); }
      else if (e.key === 'ArrowLeft') { const s = [...tl.segments].reverse().find((x) => x.t0 < now - 0.6); control.seekTo(s ? s.t0 + 0.001 : 0); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [control]);

  const i = segmentIndexAt(tl, t);
  const seg = tl.segments[i];
  const p = segProgress(seg, t);
  const tot = totalsAt(tl, t);
  const finished = seg.kind === 'outro' && p > 0.25;

  return (
    <div className="jr-hud">
      <Caption c={computed} tl={tl} seg={seg} index={i} />
      <Ledger c={computed} tl={tl} tot={tot} seg={seg} p={p} index={i} />
      {finished && <Summary c={computed} tl={tl} onReplay={() => control.play(true)} onClose={onClose} />}
      {!follow && <button className="jr-follow" onClick={control.follow}>🎥 Follow the journey</button>}
      <Scrubber c={computed} tl={tl} t={t} playing={playing} speed={speed}
        onPlay={() => control.play(!playing)} onSeek={control.seekTo} onSpeed={() => control.setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1)}
        onSkip={() => control.seekTo(tl.segments[tl.segments.length - 1].t0 + 0.001)} onClose={onClose} />
    </div>
  );
}

function lineFeature(s: Segment, coords: LineString['coordinates']): Feature<LineString> {
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { color: MODES[s.leg!.mode].color, mode: s.leg!.mode } };
}

// ------------------------------------------------------------------ caption (top left)
function Caption({ c, tl, seg, index }: { c: ComputedRoute; tl: Timeline; seg: Segment; index: number }) {
  const origin = c.steps[0].kind === 'node' ? c.steps[0].place : null;
  const store = c.steps[c.steps.length - 1];
  const storeName = store.kind === 'node' ? store.place.name : '';
  let kicker: ReactNode, icon: ReactNode, title: ReactNode, sub: ReactNode, note: ReactNode = null, accent = '#22c55e';
  if (seg.kind === 'intro') {
    kicker = 'The journey of';
    icon = c.product.emoji;
    title = c.product.pack.label;
    sub = <>from {c.route.origin.region} <Flag country={c.route.origin.country} /> to {shortName(storeName)}</>;
    note = origin?.note ?? c.route.label;
  } else if (seg.kind === 'outro') {
    kicker = 'On the shelf';
    icon = '🛒';
    title = `${c.chain.name}, ${storeName.split(', ').slice(1).join(', ') || shortName(storeName)}`;
    sub = `${fmtKmNum(tl.final.km).v} km and ${fmtTime(tl.final.hours).v} ${fmtTime(tl.final.hours).u} after it was picked`;
  } else if (seg.kind === 'node') {
    const n = seg.node!;
    kicker = `Step ${seg.ordinal} of ${tl.steps} · ${ROLE_LABEL[n.step.role]}`;
    icon = ROLE_ICON[n.step.role];
    title = shortName(n.place.name);
    sub = <><Flag country={n.place.country} /> {n.place.name.split(', ').slice(1).join(', ') || n.place.country}{n.days > 0 && <> · {n.days < 1 ? `${Math.round(n.days * 24)} h` : `${n.days} day${n.days > 1 ? 's' : ''}`} here</>}</>;
    note = n.step.note ?? n.place.note;
    accent = n.step.role === 'store' ? c.chain.color : '#e2e8f0';
  } else {
    const l = seg.leg!;
    const mf = MODES[l.mode];
    kicker = `Step ${seg.ordinal} of ${tl.steps} · ${mf.label}`;
    icon = <span className="jr-mode-icon" style={{ background: mf.color }}>{mf.icon}</span>;
    title = <>{shortName(l.from.name)} <span className="jr-arrow">→</span> {shortName(l.to.name)}</>;
    sub = `${fmtKmNum(l.distanceKm).v} km · ${fmtTime(l.hours).v} ${fmtTime(l.hours).u} · ${Math.round(l.distanceKm / Math.max(1, l.hours))} km/h`;
    note = l.step.note ?? MODE_BLURB[l.mode];
    accent = mf.color;
  }
  return (
    <div className="jr-caption" key={index} style={{ '--accent': accent } as CSSProperties}>
      <div className="jr-kicker">{kicker}</div>
      <div className="jr-title"><span className="jr-title-icon">{icon}</span><span>{title}</span></div>
      <div className="jr-sub">{sub}</div>
      {note && <div className="jr-note">{note}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ ledger (right)
function Ledger({ c, tl, tot, seg, p, index }: { c: ComputedRoute; tl: Timeline; tot: Totals; seg: Segment; p: number; index: number }) {
  const fin = tl.final;
  const km = fmtKmNum(tot.km), time = fmtTime(tot.hours), co2 = fmtCo2(co2Of(tot)), fuel = fmtFuel(tot.fuelL);
  const d = seg.delta;
  // "+…" chips for what the current stop or leg adds, visible while it lands
  const chipsOn = seg.kind === 'leg' || (seg.kind === 'node' && p > 0.06 && p < 0.92);
  const chip = (v: number, text: string) => (chipsOn && v > 1e-6 && /[1-9]/.test(text) ? <span className="jr-chip" key={index}>+{text}</span> : null);
  const costParts = COST_PARTS.filter((part) => d.cost[part.key] > 1e-6);
  const modes = (Object.keys(fin.byMode) as TransportMode[]).sort((a, b) => (fin.byMode[b] ?? 0) - (fin.byMode[a] ?? 0));
  return (
    <div className="jr-ledger">
      <div className="jr-ledger-head">
        <span className="jr-ledger-emoji">{c.product.emoji}</span>
        <div><b>Running total</b><small>for one {c.product.pack.label}</small></div>
      </div>
      <Row icon="🛣️" label="Distance" v={km.v} u={km.u} chip={chip(d.km, `${fmtKmNum(d.km).v} km`)}>
        <Stack total={fin.km} parts={modes.map((m) => ({ key: m, value: tot.byMode[m] ?? 0, color: MODES[m].color }))} />
        <div className="jr-modes">{modes.map((m) => <span key={m} style={{ '--c': MODES[m].color } as CSSProperties}><i />{MODES[m].icon} {Math.round(tot.byMode[m] ?? 0).toLocaleString('en-GB')}</span>)}</div>
      </Row>
      <Row icon="⏱️" label="Since harvest" v={time.v} u={time.u} chip={chip(d.hours, `${fmtTime(d.hours).v} ${fmtTime(d.hours).u}`)}>
        <Stack total={fin.hours} parts={[{ key: 'h', value: tot.hours, color: '#fbbf24' }]} />
      </Row>
      <Row icon="☁️" label={<>CO<sub>2</sub>e</>} v={co2.v} u={co2.u} chip={chip(d.grow + d.transport + d.storage, `${fmtCo2(d.grow + d.transport + d.storage).v} ${fmtCo2(d.grow + d.transport + d.storage).u}`)}>
        <Stack total={co2Of(fin)} parts={[{ key: 'g', value: tot.grow, color: '#22c55e' }, { key: 't', value: tot.transport, color: '#38bdf8' }, { key: 's', value: tot.storage, color: '#fbbf24' }]} />
        <div className="jr-legend"><span style={{ '--c': '#22c55e' } as CSSProperties}><i />growing</span><span style={{ '--c': '#38bdf8' } as CSSProperties}><i />transport</span><span style={{ '--c': '#fbbf24' } as CSSProperties}><i />cooling</span></div>
      </Row>
      <Row icon="⛽" label="Fuel burned" v={fuel.v} u={fuel.u} hint="diesel-eq." chip={chip(d.fuelL, `${fmtFuel(d.fuelL).v} ${fmtFuel(d.fuelL).u}`)}>
        <Stack total={fin.fuelL} parts={[{ key: 'f', value: tot.fuelL, color: '#fb7185' }]} />
      </Row>
      <Row icon="💶" label="Price so far" v={fmtEur(costOf(tot))} u={`of ${fmtEur(costOf(fin))}`}
        chip={chip(costOf(d), `${fmtEur(costOf(d))}${costParts.length === 1 ? ' ' + costParts[0].short : ''}`)}>
        <Stack total={costOf(fin)} parts={COST_PARTS.map((part) => ({ key: part.key, value: tot.cost[part.key], color: part.color }))} />
      </Row>
    </div>
  );
}

function Row({ icon, label, v, u, hint, chip, children }: { icon: string; label: ReactNode; v: string; u: string; hint?: string; chip: ReactNode; children?: ReactNode }) {
  return (
    <div className="jr-row">
      <div className="jr-row-top">
        <span className="jr-row-icon">{icon}</span>
        <span className="jr-row-label">{label}{hint && <small> {hint}</small>}</span>
        {chip}
      </div>
      <div className="jr-row-value"><b>{v}</b> <span>{u}</span></div>
      {children}
    </div>
  );
}

function Stack({ total, parts }: { total: number; parts: { key: string; value: number; color: string }[] }) {
  return (
    <div className="jr-stack">
      {parts.map((p) => <i key={p.key} style={{ width: `${total > 0 ? (100 * p.value) / total : 0}%`, background: p.color }} />)}
    </div>
  );
}

// ------------------------------------------------------------------ summary (finale)
function Summary({ c, tl, onReplay, onClose }: { c: ComputedRoute; tl: Timeline; onReplay: () => void; onClose: () => void }) {
  const fin = tl.final;
  const co2 = co2Of(fin);
  const carKm = co2 / CAR_KG_PER_KM;
  const shelf = costOf(fin);
  const farmer = fin.cost.farmer;
  const transportShare = co2 > 0 ? Math.round((100 * fin.transport) / co2) : 0;
  const days = fin.hours / 24;
  return (
    <div className="jr-summary">
      <div className="jr-kicker">Journey complete</div>
      <h3>{c.product.emoji} {fmtKmNum(fin.km).v} km in {days >= 2 ? `${days.toFixed(1)} days` : `${Math.round(fin.hours)} hours`}</h3>
      <ul>
        <li><b>{fmtCo2(co2).v} {fmtCo2(co2).u} CO<sub>2</sub>e</b> — like driving {carKm < 1 ? `${Math.round(carKm * 1000)} m` : `${carKm.toFixed(1)} km`} in a petrol car. {transportShare}% of it is transport.</li>
        <li><b>{fmtEur(shelf)}</b> on the shelf; the farmer gets {fmtEur(farmer)} ({Math.round((100 * farmer) / Math.max(shelf, 1e-6))}%).</li>
      </ul>
      <div className="jr-actions">
        <button onClick={onReplay}>↺ Replay</button>
        <button className="primary" onClick={onClose}>Explore the route →</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ timeline scrubber (bottom)
function Scrubber({ c, tl, t, playing, speed, onPlay, onSeek, onSpeed, onSkip, onClose }: {
  c: ComputedRoute; tl: Timeline; t: number; playing: boolean; speed: number;
  onPlay: () => void; onSeek: (t: number) => void; onSpeed: () => void; onSkip: () => void; onClose: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const pct = (100 * t) / tl.total;
  const seekFrom = (e: ReactPointerEvent) => {
    const r = track.current!.getBoundingClientRect();
    onSeek(clamp01((e.clientX - r.left) / r.width) * tl.total);
  };
  const segs = (
    <div className="jr-segs">
      {tl.segments.map((s, i) => {
        const w = (s.t1 - s.t0) / tl.total;
        if (s.kind === 'leg') {
          const mf = MODES[s.leg!.mode];
          return <div key={i} className="jr-seg s-leg" style={{ flexGrow: w, '--c': mf.color } as CSSProperties} title={`${mf.label}: ${shortName(s.leg!.from.name)} → ${shortName(s.leg!.to.name)}`}>{w > 0.07 && <span>{mf.icon}</span>}</div>;
        }
        if (s.kind === 'node') return <div key={i} className="jr-seg s-node" style={{ flexGrow: w }} title={`${ROLE_LABEL[s.node!.step.role]}: ${s.node!.place.name}`}><i /></div>;
        return <div key={i} className={`jr-seg s-${s.kind}`} style={{ flexGrow: w }} />;
      })}
    </div>
  );
  return (
    <div className="jr-bar">
      <button className="jr-btn play" onClick={onPlay} aria-label={playing ? 'Pause' : 'Play'} title="Play / pause (space)">
        {playing
          ? <svg viewBox="0 0 16 16"><rect x="3" y="2.5" width="3.6" height="11" rx="1" /><rect x="9.4" y="2.5" width="3.6" height="11" rx="1" /></svg>
          : <svg viewBox="0 0 16 16"><path d="M4 2.6v10.8a.8.8 0 0 0 1.2.7l8.6-5.4a.8.8 0 0 0 0-1.4L5.2 1.9A.8.8 0 0 0 4 2.6z" /></svg>}
      </button>
      <div className="jr-track" ref={track}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seekFrom(e); }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFrom(e); }}>
        {segs}
        <div className="jr-played" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>{segs}</div>
        <div className="jr-head" style={{ left: `${pct}%` }}><span>{c.product.emoji}</span></div>
      </div>
      <button className="jr-btn text speed" onClick={onSpeed} title="Playback speed">{speed}×</button>
      <button className="jr-btn text skip" onClick={onSkip} disabled={t >= tl.segments[tl.segments.length - 1].t0} title="Skip to the end">Skip ⏭</button>
      <button className="jr-btn close" onClick={onClose} aria-label="Close the journey" title="Close (Esc)">✕</button>
    </div>
  );
}
