import { useEffect, useState } from 'react';
import { PRODUCTS } from '../data';
import { gradeOf } from '../game/grade';
import { sfx } from '../game/sound';
import { MONTHS } from '../model/compute';
import { buildLifecycle } from '../model/lifecycle';
import { useApp } from '../store';
import { Flag } from './ui';

interface Summary { co2: number; markets: number; origins: string[] }

/** Lifecycle summaries for every product, built one product per frame so the bar never blocks. */
function useSummaries(month: number) {
  const [done, setDone] = useState<{ month: number; items: Record<string, Summary> }>({ month, items: {} });
  useEffect(() => {
    let i = 0, raf = 0;
    const items: Record<string, Summary> = {};
    const step = () => {
      const p = PRODUCTS[i++];
      if (!p) return;
      const lc = buildLifecycle(p, month);
      items[p.id] = { co2: lc.total.co2, markets: lc.total.markets, origins: [...new Set(lc.origins.map((o) => o.route.origin.country))] };
      setDone({ month, items: { ...items } });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [month]);
  return done.month === month ? done.items : {};
}

const CATS: [string, string][] = [['fruit', 'Fruit'], ['vegetable', 'Veg'], ['dairy', 'Dairy'], ['eggs', 'Eggs'], ['meat', 'Meat'], ['fish', 'Fish']];

/** The product lens's aisle: pick a product to see its whole journey across Europe. */
export function ProductBar() {
  const month = useApp((s) => s.month);
  const setMonth = useApp((s) => s.setMonth);
  const current = useApp((s) => s.lifecycleId);
  const setLifecycle = useApp((s) => s.setLifecycle);
  const items = useSummaries(month);
  return (
    <section className="hotbar" aria-label="Products">
      <div className="hb-side">
        <label className="hb-month" title="Origins change with the season">
          <span>🗓</span>
          <select value={month} onChange={(e) => setMonth(+e.target.value)} aria-label="Month">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
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
                  <button key={p.id} className={`hb-tile ${p.id === current ? 'cur' : ''}`} onMouseEnter={() => sfx.hover()}
                    onClick={() => { sfx.select(); setLifecycle(p.id); }}
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
