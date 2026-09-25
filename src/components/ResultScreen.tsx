import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PLACES, PRODUCTS } from '../data';
import { CAR_KG_PER_KM } from '../data/factors';
import { badgesFor } from '../game/badges';
import { gradeOf } from '../game/grade';
import { computeRoute, fmtEur, MONTHS, type ComputedRoute } from '../model/compute';
import { useApp } from '../store';
import { Flag } from './ui';
import { useCountUp } from './useCountUp';

interface Props {
  c: ComputedRoute;
  onReplay: () => void;
  onExplore: () => void;
  onPickAnother: () => void;
  /** play the same product from another origin: route id and a month when it is in season */
  onSwap?: (routeId: string, month: number) => void;
  /** see the product across all its markets */
  onLifecycle?: () => void;
}

/**
 * The end of a journey, scored like a level: a CO2e grade, the badges it earned, a lower-carbon origin
 * to try next, and a stamp in the player's passport.
 */
export function ResultScreen({ c, onReplay, onExplore, onPickAnother, onSwap, onLifecycle }: Props) {
  const kg = c.product.pack.kg;
  const grade = gradeOf(c.co2e.total);
  const badges = useMemo(() => badgesFor(c), [c]);
  // what the passport held before this journey, to mark what is new
  const [before] = useState(() => useApp.getState().passport);
  const passport = useApp((s) => s.passport);
  const stamp = useApp((s) => s.stamp);
  useEffect(() => { stamp(c.product.id, c.route.id, grade.grade, badges.map((b) => b.id)); }, [stamp, c.product.id, c.route.id, grade.grade, badges]);
  const newProduct = !before.products[c.product.id];

  // the lowest-carbon other origin for this product, from the same store
  const swap = useMemo(() => {
    const store = c.steps[c.steps.length - 1];
    if (store.kind !== 'node') return null;
    let best: { c: ComputedRoute; saving: number } | null = null;
    for (const r of c.product.routes) {
      if (r.id === c.route.id || (r.chainIds && !r.chainIds.includes(c.chain.id))) continue;
      try {
        const alt = computeRoute(c.product, r, c.chain, store.place, PLACES);
        const saving = c.co2e.total - alt.co2e.total;
        if (saving > 0.1 * c.co2e.total && (!best || saving > best.saving)) best = { c: alt, saving };
      } catch { /* skip */ }
    }
    return best;
  }, [c]);

  const km = useCountUp(c.totalKm, 1100);
  const days = useCountUp(c.totalDays, 1100, 100);
  const co2 = useCountUp(c.co2e.total * kg, 1100, 200);
  const price = useCountUp(c.cost.shelf * kg, 1100, 300);
  const carKm = (c.co2e.total * kg) / CAR_KG_PER_KM;
  const farmerPct = Math.round((100 * c.cost.farmGate) / c.cost.shelf);
  const storeNode = c.steps[c.steps.length - 1];
  const town = storeNode.kind === 'node' ? storeNode.place.name.split(', ').slice(1).join(', ') || storeNode.place.name : '';
  const stamped = Object.keys(passport.products).length;

  return (
    <section className="result" aria-label="Journey complete">
      <div className="rs-head">
        <div className="rs-grade" style={{ '--g': grade.color, '--gi': grade.ink } as CSSProperties} title={`${grade.label} footprint: ${c.co2e.total.toFixed(2)} kg CO2e per kg`}>
          <b>{grade.grade}</b><small>CO<sub>2</sub>e grade</small>
        </div>
        <div className="rs-title">
          <div className="jr-kicker">Journey complete</div>
          <h2>{c.product.emoji} {c.product.name}</h2>
          <p><Flag country={c.route.origin.country} /> {c.route.origin.region} → {town}</p>
        </div>
      </div>

      <div className="rs-stats">
        <div><b>{Math.round(km).toLocaleString('en-GB')}</b><span>km travelled</span></div>
        <div><b>{days < 2 ? `${Math.round(days * 24)} h` : days.toFixed(1)}</b><span>{days < 2 ? 'from harvest' : 'days from harvest'}</span></div>
        <div><b>{co2 < 1 ? `${Math.round(co2 * 1000)} g` : `${co2.toFixed(2)} kg`}</b><span>CO<sub>2</sub>e per pack</span></div>
        <div><b>{fmtEur(price)}</b><span>on the shelf</span></div>
      </div>
      <p className="rs-line">
        {grade.label} footprint: {c.co2e.total.toFixed(2)} kg CO<sub>2</sub>e per kilo. Your {c.product.pack.label} is like driving{' '}
        <b>{carKm < 1 ? `${Math.round(carKm * 1000)} m` : `${carKm.toFixed(1)} km`}</b> in a petrol car; the farmer gets <b>{farmerPct}%</b> of the price.
      </p>

      {badges.length > 0 && (
        <div className="rs-block">
          <div className="rs-label">Badges earned</div>
          <div className="rs-badges">
            {badges.map((b, i) => (
              <span key={b.id} className="rs-badge" style={{ animationDelay: `${600 + i * 140}ms` }} title={b.hint}>
                <i>{b.icon}</i>{b.name}{!before.badges[b.id] && <em>NEW</em>}
              </span>
            ))}
          </div>
        </div>
      )}

      {swap ? (
        <div className="rs-swap">
          <div>
            <div className="rs-label">💡 Swap to save</div>
            <p><Flag country={swap.c.route.origin.country} /> <b>{swap.c.route.label}</b> ({seasonOf(swap.c)}) saves about <b>{Math.round((swap.saving / c.co2e.total) * 100)}%</b>: {swap.saving.toFixed(2)} kg CO<sub>2</sub>e per kilo, grade {gradeOf(swap.c.co2e.total).grade}.</p>
          </div>
          {onSwap && <button onClick={() => onSwap(swap.c.route.id, swap.c.route.season.from)}>Play it ▶</button>}
        </div>
      ) : c.product.routes.length > 1 ? (
        <div className="rs-swap best"><div><div className="rs-label">🏆 Best choice</div><p>No other origin of {c.product.name.toLowerCase()} on this shelf has a clearly lower footprint.</p></div></div>
      ) : null}

      <div className="rs-block">
        <div className="rs-label">🛂 Passport · {stamped}/{PRODUCTS.length}</div>
        <div className="rs-passport">
          {PRODUCTS.map((p) => (
            <span key={p.id} className={`${passport.products[p.id] ? 'got' : ''} ${p.id === c.product.id && newProduct ? 'new' : ''}`} title={p.name}>{p.emoji}</span>
          ))}
        </div>
      </div>

      {onLifecycle && (
        <button className="rs-lifecycle" onClick={onLifecycle}>
          <span>🌍</span><span><b>Where else does it go?</b><small>{c.product.name}: every grocer and country it reaches</small></span><i>→</i>
        </button>
      )}

      <div className="rs-actions">
        <button onClick={onReplay}>↺ Replay</button>
        <button onClick={onExplore}>🔎 Explore route</button>
        <button className="primary" onClick={onPickAnother}>🛒 Pick another</button>
      </div>
    </section>
  );
}

function seasonOf(c: ComputedRoute) {
  const { from, to } = c.route.season;
  return from === 1 && to === 12 ? 'all year' : `${MONTHS[from - 1]} – ${MONTHS[to - 1]}`;
}
