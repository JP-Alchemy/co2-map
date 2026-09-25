import { useEffect, useState } from 'react';
import { PRODUCTS } from '../data';
import { MARKET_BY_ID } from '../data/markets';
import { gradeOf } from '../game/grade';
import { sfx } from '../game/sound';
import { fmtKg, MONTHS } from '../model/compute';
import { buildLifecycle, type Lifecycle } from '../model/lifecycle';
import { useLifecycleYear } from '../model/useYear';
import { useApp } from '../store';
import { MonthTimeline } from './MonthTimeline';
import { Flag } from './ui';

interface Summary { co2: number; markets: number; origins: string[] }

/**
 * Lifecycle summaries for every product, built one product per frame so the bar never blocks. A new month
 * replaces the old one's tiles as they are ready, so playing the year doesn't blank the aisle each month.
 */
function useSummaries(month: number) {
  const [items, setItems] = useState<Record<string, Summary>>({});
  useEffect(() => {
    let i = 0, raf = 0;
    const step = () => {
      const p = PRODUCTS[i++];
      if (!p) return;
      const lc = buildLifecycle(p, month);
      const s: Summary = { co2: lc.total.co2, markets: lc.total.markets, origins: [...new Set(lc.origins.map((o) => o.route.origin.country))] };
      setItems((all) => ({ ...all, [p.id]: s }));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [month]);
  return items;
}

const CATS: [string, string][] = [['fruit', 'Fruit'], ['vegetable', 'Veg'], ['dairy', 'Dairy'], ['eggs', 'Eggs'], ['meat', 'Meat'], ['fish', 'Fish']];

const pct = (v: number) => (v < 0.01 ? '<1%' : `${Math.round(v * 100)}%`);

/** The product lens's aisle: pick a product to see its whole journey across Europe, hover one to sketch it. */
export function ProductBar({ onPreview }: { onPreview: (lc: Lifecycle | null) => void }) {
  const month = useApp((s) => s.month);
  const setMonth = useApp((s) => s.setMonth);
  const current = useApp((s) => s.lifecycleId);
  const setLifecycle = useApp((s) => s.setLifecycle);
  const items = useSummaries(month);
  const [hover, setHover] = useState<{ lc: Lifecycle; x: number } | null>(null);

  const enter = (id: string, target: HTMLElement) => {
    const p = PRODUCTS.find((x) => x.id === id)!;
    const lc = buildLifecycle(p, month);
    const bar = target.closest('.hotbar')!.getBoundingClientRect(), r = target.getBoundingClientRect();
    // keep the tooltip over the bar even for the first and last tiles
    setHover({ lc, x: Math.max(170, Math.min(bar.width - 170, r.left + r.width / 2 - bar.left)) });
    onPreview(lc);
    sfx.hover();
  };
  const leave = () => { setHover(null); onPreview(null); };
  const tip = hover?.lc;
  const tipGrade = tip ? gradeOf(tip.total.co2) : null;
  // the timeline shows the year of the product under the pointer, else of the one on the map
  const year = useLifecycleYear(tip?.product ?? (current ? PRODUCTS.find((x) => x.id === current) ?? null : null));

  return (
    <section className="hotbar" aria-label="Products" onMouseLeave={leave}>
      {tip && tipGrade && (
        <div className="hb-tip lc-tip" style={{ left: hover!.x }}>
          <b>{tip.product.emoji} {tip.product.name} in {MONTHS[tip.month - 1]}</b>
          {tip.origins.map((o) => <span key={o.route.id}><Flag country={o.route.origin.country} /> {o.route.origin.region}{tip.origins.length > 1 && <> · {pct(o.weight)}</>}</span>)}
          <span className="lc-tip-to">→ {tip.markets.slice(0, 4).map((m) => <i key={m.market} style={{ color: MARKET_BY_ID[m.market].color }}><Flag country={m.market} /> {pct(m.volume)}</i>)}{tip.markets.length > 4 && <i>+{tip.markets.length - 4}</i>}</span>
          <span className="hb-tip-row">
            <span>{tip.total.grocers} grocers · {fmtKg(tip.total.co2)} kg CO₂e/kg on average</span>
            <em className="grade-chip" style={{ background: tipGrade.color, color: tipGrade.ink }}>{tipGrade.grade}</em>
          </span>
        </div>
      )}
      <MonthTimeline month={month} onChange={setMonth} stats={year} onEnter={leave} />
      <div className="hb-side">
        <span className="hb-hint">Pick a product<br />to see where it all goes</span>
      </div>
      <div className="hb-scroll">
        {CATS.map(([cat, label]) => {
          const group = PRODUCTS.filter((p) => p.category === cat);
          if (!group.length) return null;
          return (
            <div key={cat} className="hb-group">
              <span className="hb-group-label">{label}</span>
              {group.map((p) => {
                const it = items[p.id];
                const g = it ? gradeOf(it.co2) : null;
                return (
                  <button key={p.id} className={`hb-tile ${p.id === current ? 'cur' : ''}`}
                    onMouseEnter={(e) => enter(p.id, e.currentTarget)} onFocus={(e) => enter(p.id, e.currentTarget)} onBlur={leave}
                    onClick={() => { sfx.select(); leave(); setLifecycle(p.id); }}
                    aria-label={`${p.name}${g ? `, average CO2e grade ${g.grade}, sold in ${it!.markets} countries` : ''}`}>
                    <span className="hb-emoji">{p.emoji}</span>
                    <span className="hb-name">{p.name}</span>
                    <span className="hb-flags">{it ? <>{it.origins.map((c) => <Flag key={c} country={c} />)}<span className="hb-arrow">→</span><b className="hb-markets">{it.markets}</b></> : '…'}</span>
                    {g && <span className="hb-grade" style={{ background: g.color, color: g.ink }}>{g.grade}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
