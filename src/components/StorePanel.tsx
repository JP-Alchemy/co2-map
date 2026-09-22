import { PRODUCTS } from '../data';
import { inSeason, MONTHS } from '../model/compute';
import { useApp, type StoreFeature } from '../store';
import type { Chain } from '../types';

export function StorePanel({ chain, store }: { chain: Chain; store: StoreFeature }) {
  const setProduct = useApp((s) => s.setProduct);
  const month = useApp((s) => s.month);
  const setMonth = useApp((s) => s.setMonth);
  const p = store.properties;
  const cats: Record<string, string> = { fruit: 'Fruit', vegetable: 'Vegetables', dairy: 'Dairy', eggs: 'Eggs', meat: 'Meat', fish: 'Fish' };
  const groups = Object.keys(cats).map((c) => ({ c, items: PRODUCTS.filter((x) => x.category === c) })).filter((g) => g.items.length);

  return (
    <div className="panel">
      <div className="store-head" style={{ borderColor: chain.color }}>
        <b>{p.name}</b>
        <small>{[p.street, p.postcode, p.city].filter(Boolean).join(', ') || 'Address not tagged in OpenStreetMap'}</small>
        <a className="osm" href={`https://www.openstreetmap.org/${p.osm}`} target="_blank" rel="noreferrer">View on OpenStreetMap ↗</a>
      </div>
      <div className="month-row">
        <label>Shopping in</label>
        <select value={month} onChange={(e) => setMonth(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <small>origins change with the season</small>
      </div>
      <h4>What's in the fresh aisle?</h4>
      {groups.map((g) => (
        <div key={g.c} className="prod-group">
          <h5>{cats[g.c]}</h5>
          <div className="prod-grid">
            {g.items.map((pr) => {
              const live = pr.routes.filter((r) => inSeason(r, month));
              const origins = [...new Set((live.length ? live : pr.routes).map((r) => r.origin.country))];
              return (
                <button key={pr.id} className="prod-btn" onClick={() => setProduct(pr.id)}>
                  <span className="prod-emoji">{pr.emoji}</span>
                  <span className="prod-name">{pr.name}</span>
                  <span className="prod-origin">{origins.map((c) => String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))).join(' ')}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
