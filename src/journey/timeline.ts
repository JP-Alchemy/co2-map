import type { Position } from 'geojson';
import { FUEL_CO2E_PER_L } from '../data/factors';
import { clamp01, ease, fitCam, flyCam, pitchFor, slerp, type Cam, type Pad } from '../map/camera';
import type { ComputedLeg, ComputedNode, ComputedRoute } from '../model/compute';
import { haversineKm } from '../model/geo';
import type { TransportMode } from '../types';

/**
 * The journey as a film: a list of timed segments (fly in, stop, leg, stop, …, fly out) built from a
 * computed route. Everything the player shows — camera, vehicle, trail, running totals — is a pure
 * function of the playhead time, so the journey can be paused, scrubbed and replayed freely.
 */

export type CostPart = 'farmer' | 'packing' | 'transport' | 'storage' | 'importer' | 'retailer' | 'vat';
export const COST_PARTS: { key: CostPart; label: string; short: string; color: string }[] = [
  { key: 'farmer', label: 'Farmer', short: 'farmer', color: '#16a34a' },
  { key: 'packing', label: 'Packing', short: 'packing', color: '#84cc16' },
  { key: 'transport', label: 'Transport', short: 'freight', color: '#0ea5e9' },
  { key: 'storage', label: 'Storage & handling', short: 'handling', color: '#f59e0b' },
  { key: 'importer', label: 'Importer', short: 'importer', color: '#a855f7' },
  { key: 'retailer', label: 'Retailer', short: 'retailer', color: '#94a3b8' },
  { key: 'vat', label: 'VAT', short: 'VAT', color: '#e2e8f0' },
];

/** Running totals for one retail pack. */
export interface Totals {
  km: number;
  hours: number;
  /** kg CO2e */
  grow: number;
  transport: number;
  storage: number;
  /** litres of fuel, diesel-equivalent */
  fuelL: number;
  cost: Record<CostPart, number>;
  byMode: Partial<Record<TransportMode, number>>;
}

export interface Segment {
  kind: 'intro' | 'node' | 'leg' | 'outro';
  t0: number;
  t1: number;
  node?: ComputedNode;
  leg?: ComputedLeg;
  /** what this segment adds, and the totals when it starts */
  delta: Totals;
  before: Totals;
  /** legs: cumulative km at each path vertex, and the camera framing of the whole leg */
  cum?: number[];
  frame?: Cam;
  /** position among the route's steps (1-based) for the caption */
  ordinal?: number;
}

export interface Timeline {
  segments: Segment[];
  total: number;
  final: Totals;
  origin: Cam;
  store: Cam;
  overview: Cam;
  start: Cam;
  view: { w: number; h: number; pad: Pad };
  packKg: number;
  steps: number;
}

export function zeroTotals(): Totals {
  return { km: 0, hours: 0, grow: 0, transport: 0, storage: 0, fuelL: 0, cost: { farmer: 0, packing: 0, transport: 0, storage: 0, importer: 0, retailer: 0, vat: 0 }, byMode: {} };
}

function addScaled(a: Totals, d: Totals, k: number): Totals {
  const out: Totals = {
    km: a.km + d.km * k, hours: a.hours + d.hours * k, grow: a.grow + d.grow * k, transport: a.transport + d.transport * k,
    storage: a.storage + d.storage * k, fuelL: a.fuelL + d.fuelL * k, cost: { ...a.cost }, byMode: { ...a.byMode },
  };
  for (const p of COST_PARTS) out.cost[p.key] += d.cost[p.key] * k;
  for (const [m, v] of Object.entries(d.byMode) as [TransportMode, number][]) out.byMode[m] = (out.byMode[m] ?? 0) + v * k;
  return out;
}

export const co2Of = (t: Totals) => t.grow + t.transport + t.storage;
export const costOf = (t: Totals) => COST_PARTS.reduce((s, p) => s + t.cost[p.key], 0);

const NODE_SECONDS = { origin: 3.0, store: 2.8, other: 1.6 };
const INTRO_SECONDS = 2.8;
const OUTRO_SECONDS = 3.2;
/** Seconds on screen for a leg: logarithmic in distance so a 20 km truck hop and a 10,000 km crossing both read well. */
export function legSeconds(km: number) {
  return Math.max(1.8, Math.min(6.2, 1.3 + 1.25 * Math.log10(1 + km / 10)));
}
/** How far the camera leans from the leg's framing towards the vehicle. */
const FOLLOW = 0.32;

export function buildTimeline(c: ComputedRoute, start: Cam, view: { w: number; h: number; pad: Pad }): Timeline {
  const kg = c.product.pack.kg;
  const nodes = c.steps.filter((s): s is ComputedNode => s.kind === 'node');
  const packing = nodes.find((n) => n.step.role === 'packing' || n.step.role === 'processing') ?? nodes[0];
  const importer = nodes.find((n) => n.step.role === 'import' || n.step.role === 'ripening') ?? nodes.find((n) => n.step.role === 'dc') ?? nodes[nodes.length - 1];

  const segments: Segment[] = [];
  let t = 0;
  let acc = zeroTotals();
  const push = (s: Omit<Segment, 't0' | 't1' | 'before'>, dur: number) => {
    const seg: Segment = { ...s, t0: t, t1: t + dur, before: acc };
    segments.push(seg);
    acc = addScaled(acc, s.delta, 1);
    t += dur;
  };

  push({ kind: 'intro', delta: zeroTotals() }, INTRO_SECONDS);
  c.steps.forEach((s, i) => {
    const d = zeroTotals();
    if (s.kind === 'node') {
      const role = s.step.role;
      d.hours = s.days * 24;
      d.storage = s.co2eKg * kg;
      d.cost.storage = s.costEur * kg;
      if (role === 'origin') { d.grow = c.co2e.production * kg; d.cost.farmer = c.cost.farmGate * kg; }
      if (s === packing) d.cost.packing = c.cost.packing * kg;
      if (s === importer) d.cost.importer = c.cost.importMargin * kg;
      if (role === 'store') { d.cost.retailer = c.cost.retailMargin * kg; d.cost.vat = c.cost.vat * kg; }
      const dur = role === 'origin' ? NODE_SECONDS.origin : role === 'store' ? NODE_SECONDS.store : NODE_SECONDS.other;
      push({ kind: 'node', node: s, delta: d, ordinal: i + 1 }, dur);
    } else {
      d.km = s.distanceKm;
      d.hours = s.hours;
      d.transport = s.co2eKg * kg;
      d.fuelL = (s.co2eKg * kg) / FUEL_CO2E_PER_L;
      d.cost.transport = s.costEur * kg;
      d.byMode[s.mode] = s.distanceKm;
      const cum = [0];
      for (let j = 1; j < s.path.length; j++) cum.push(cum[j - 1] + haversineKm(s.path[j - 1] as [number, number], s.path[j] as [number, number]));
      const frame = fitCam(s.path, view.w, view.h, view.pad, 11.5);
      push({ kind: 'leg', leg: s, delta: d, cum, frame, ordinal: i + 1 }, legSeconds(s.distanceKm));
    }
  });
  push({ kind: 'outro', delta: zeroTotals() }, OUTRO_SECONDS);

  const legs = segments.filter((s) => s.kind === 'leg');
  const originNode = nodes[0], storeNode = nodes[nodes.length - 1];
  const originZoom = Math.min(8.5, Math.max(5.5, legs[0]?.frame?.zoom ?? 7));
  const lastLegZoom = legs[legs.length - 1]?.frame?.zoom ?? 11;
  const all: Position[] = [];
  for (const l of legs) all.push(...l.leg!.path);

  return {
    segments, total: t, final: acc, start, view, packKg: kg, steps: c.steps.length,
    origin: { center: originNode.coords, zoom: originZoom, pitch: pitchFor(originZoom) },
    store: { center: storeNode.coords, zoom: Math.min(13, lastLegZoom + 0.9), pitch: pitchFor(Math.min(13, lastLegZoom + 0.9)) },
    overview: fitCam(all, view.w, view.h, view.pad, 11),
  };
}

export function segmentIndexAt(tl: Timeline, t: number) {
  const s = tl.segments;
  if (t >= tl.total) return s.length - 1;
  let lo = 0, hi = s.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s[mid].t0 <= t) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export const segProgress = (s: Segment, t: number) => clamp01((t - s.t0) / (s.t1 - s.t0));
/** Vehicle progress along a leg: eases away from and into each stop. */
export const legFraction = (p: number) => (1 - Math.cos(Math.PI * p)) / 2;
/** How much of a stop's additions have landed: they arrive early in the stop so the viewer can read them. */
const nodeFraction = (p: number) => ease.smooth(clamp01((p - 0.12) / 0.5));

export function totalsAt(tl: Timeline, t: number): Totals {
  const i = segmentIndexAt(tl, t);
  const s = tl.segments[i];
  const p = segProgress(s, t);
  const k = s.kind === 'leg' ? legFraction(p) : s.kind === 'node' ? nodeFraction(p) : 1;
  return addScaled(s.before, s.delta, k);
}

/** [lon, lat] a fraction of the way along a leg, by distance. */
export function legPos(s: Segment, f: number): [number, number] {
  const path = s.leg!.path, cum = s.cum!;
  const target = clamp01(f) * cum[cum.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) lo = mid; else hi = mid;
  }
  const span = cum[hi] - cum[lo] || 1;
  const k = (target - cum[lo]) / span;
  return [path[lo][0] + (path[hi][0] - path[lo][0]) * k, path[lo][1] + (path[hi][1] - path[lo][1]) * k];
}

/** The leg path up to fraction f, ending exactly at the vehicle. */
export function legPartial(s: Segment, f: number): Position[] {
  const path = s.leg!.path, cum = s.cum!;
  const target = clamp01(f) * cum[cum.length - 1];
  const out: Position[] = [path[0]];
  for (let j = 1; j < path.length && cum[j] < target; j++) out.push(path[j]);
  out.push(legPos(s, f));
  return out;
}

function legCam(s: Segment, f: number): Cam {
  const frame = s.frame!;
  const zoom = frame.zoom + 0.25 * Math.sin(Math.PI * f);
  return { center: slerp(frame.center, legPos(s, f), FOLLOW), zoom, pitch: pitchFor(zoom) };
}

export function camAt(tl: Timeline, t: number): Cam {
  const i = segmentIndexAt(tl, t);
  const s = tl.segments[i];
  const p = segProgress(s, t);
  const { w, h } = tl.view;
  if (s.kind === 'intro') return flyCam(tl.start, tl.origin, ease.inOutCubic(p), w, h);
  if (s.kind === 'outro') return flyCam(tl.store, tl.overview, ease.inOutCubic(p), w, h);
  if (s.kind === 'leg') return legCam(s, legFraction(p));
  const prev = tl.segments[i - 1], next = tl.segments[i + 1];
  const from = prev?.kind === 'leg' ? legCam(prev, 1) : tl.origin;
  const to = next?.kind === 'leg' ? legCam(next, 0) : tl.store;
  const hold = s.node!.step.role === 'origin' ? 0.45 : 0.2;
  const cam = flyCam(from, to, ease.inOutCubic(clamp01((p - hold) / (1 - hold))), w, h);
  // a little punch-in as the stop lands
  const punch = p < 0.3 ? Math.sin((Math.PI * p) / 0.3) * 0.16 : 0;
  return { ...cam, zoom: cam.zoom + punch };
}

// ---------------------------------------------------------------- formatting for the HUD
export function fmtCo2(kg: number) {
  if (kg < 1) return { v: Math.round(kg * 1000).toLocaleString('en-GB'), u: 'g' };
  return { v: kg.toFixed(kg < 10 ? 2 : 1), u: 'kg' };
}
export function fmtFuel(l: number) {
  if (l < 1) return { v: Math.round(l * 1000).toLocaleString('en-GB'), u: 'ml' };
  return { v: l.toFixed(2), u: 'L' };
}
export function fmtTime(hours: number) {
  if (hours < 48) return { v: hours < 10 ? hours.toFixed(1) : Math.round(hours).toString(), u: 'h' };
  return { v: (hours / 24).toFixed(1), u: 'days' };
}
export function fmtKmNum(km: number) {
  return { v: Math.round(km).toLocaleString('en-GB'), u: 'km' };
}
