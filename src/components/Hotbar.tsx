import { useMemo, useState, type CSSProperties } from 'react';
import { MODES, PLACES, PRODUCTS } from '../data';
import { gradeOf } from '../game/grade';
import { sfx } from '../game/sound';
import { computeRoute, fmtKg, fmtKm, inSeason, MONTHS, pickRoute, type ComputedRoute } from '../model/compute';
import { storePlaceOf, useApp, type StoreFeature } from '../store';
import type { Chain, TransportMode } from '../types';
import { Flag } from './ui';

const CATS: [string, string][] = [['fruit', 'Fruit'], ['vegetable', 'Veg'], ['dairy', 'Dairy'], ['eggs', 'Eggs'], ['meat', 'Meat'], ['fish', 'Fish']];

interface Props {
  chain: Chain;
  store: StoreFeature;
  /** the product whose journey is on the map */
  currentId: string | null;
  /** hovering a product previews its route on the map */
  onPreview: (c: ComputedRoute | null) => void;
}

/** The fresh aisle as a game inventory: pick a product to play its journey, hover to preview the route. */
export function Hotbar({ chain, store, currentId, onPreview }: Props) {
  const month = useApp((s) => s.month);
  const setMonth = useApp((s) => s.setMonth);
  const setProduct = useApp((s) => s.setProduct);
  const passport = useApp((s) => s.passport);
  const place = useMemo(() => storePlaceOf(store), [store]);
  const [hover, setHover] = useState<{ id: string; x: number } | null>(null);

  const items = useMemo(() => PRODUCTS.map((p) => {
    const route = pickRoute(p, month);
    let c: ComputedRoute | null = null;
    try { c = computeRoute(p, route, chain, place, PLACES); } catch { c = null; }
    const live = p.routes.filter((r) => inSeason(r, month));
    const flags = [...new Set((live.length ? live : p.routes).map((r) => r.origin.country))];
    return { p, route, c, flags, grade: c ? gradeOf(c.co2e.total) : null };
  }), [chain, place, month]);

  const hovered = hover ? items.find((x) => x.p.id === hover.id) : null;
  const enter = (id: string, target: HTMLElement) => {
    const bar = target.closest('.hotbar')!.getBoundingClientRect(), r = target.getBoundingClientRect();
    // keep the tooltip over the bar even for the first and last tiles
    setHover({ id, x: Math.max(150, Math.min(bar.width - 150, r.left + r.width / 2 - bar.left)) });
    const it = items.find((x) => x.p.id === id);
    onPreview(it?.c ?? null);
    sfx.hover();
  };
  const leave = () => { setHover(null); onPreview(null); };

  return (
    <section className="hotbar" aria-label="The fresh aisle" onMouseLeave={leave}>
      {hovered?.c && hovered.grade && (
        <div className="hb-tip" style={{ left: hover!.x }}>
          <b>{hovered.p.emoji} {hovered.p.name}</b>
          <span><Flag country={hovered.route.origin.country} /> {hovered.route.label}</span>
          <span className="hb-tip-row">
            {(Object.keys(hovered.c.byMode) as TransportMode[]).map((m) => <i key={m} style={{ '--c': MODES[m].color } as CSSProperties}>{MODES[m].icon}</i>)}
            <span>{fmtKm(hovered.c.totalKm)} · {fmtKg(hovered.c.co2e.total)} kg CO₂e/kg</span>
            <em className="grade-chip" style={{ background: hovered.grade.color, color: hovered.grade.ink }}>{hovered.grade.grade}</em>
          </span>
        </div>
      )}
      <div className="hb-side">
        <label className="hb-month" title="Origins change with the season">
          <span>🗓</span>
          <select value={month} onChange={(e) => setMonth(+e.target.value)} aria-label="Shopping month">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
        <span className="hb-hint">Pick a product<br />to play its journey</span>
      </div>
      <div className="hb-scroll">
        {CATS.map(([cat, label]) => {
          const group = items.filter((x) => x.p.category === cat);
          if (!group.length) return null;
          return (
            <div key={cat} className="hb-group">
              <span className="hb-group-label">{label}</span>
              {group.map(({ p, flags, grade }) => (
                <button key={p.id} className={`hb-tile ${p.id === currentId ? 'cur' : ''}`}
                  onMouseEnter={(e) => enter(p.id, e.currentTarget)} onFocus={(e) => enter(p.id, e.currentTarget)} onBlur={leave}
                  onClick={() => { sfx.select(); leave(); setProduct(p.id); }}
                  aria-label={`${p.name}${grade ? `, CO2e grade ${grade.grade}` : ''}`}>
                  <span className="hb-emoji">{p.emoji}</span>
                  <span className="hb-name">{p.name}</span>
                  <span className="hb-flags">{flags.map((f) => <Flag key={f} country={f} />)}</span>
                  {grade && <span className="hb-grade" style={{ background: grade.color, color: grade.ink }}>{grade.grade}</span>}
                  {passport.products[p.id] && <span className="hb-stamp" title="Journey completed">✓</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
