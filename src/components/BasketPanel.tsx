import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { CHAIN_BY_ID, PRODUCTS } from '../data';
import { CAR_KG_PER_KM } from '../data/factors';
import { gradeOf } from '../game/grade';
import { sfx } from '../game/sound';
import { computeBasket, TYPICAL_WEEK, type BasketLine } from '../model/basket';
import { fmtEur, fmtKg, MONTHS } from '../model/compute';
import { fmtMass } from '../model/waste';
import { useApp, type StoreFeature } from '../store';
import { ConfidenceBadge, Flag } from './ui';

const LONG = MONTHS.map((_, i) => new Date(2001, i, 1).toLocaleString('en-GB', { month: 'long' }));
const storeName = (s: StoreFeature) => `${CHAIN_BY_ID[s.properties.chain]?.name ?? s.properties.name}${s.properties.street ? `, ${s.properties.street}` : ''}${s.properties.city ? `, ${s.properties.city}` : ''}`;
const fmtCo2 = (kg: number) => (kg < 1 ? `${Math.round(kg * 1000)} g` : `${kg.toFixed(kg < 10 ? 2 : 1)} kg`);

/** Open a product from the basket: its store, its aisle, and its journey. */
function openProduct(store: StoreFeature, productId: string) {
  const s = useApp.getState();
  s.setLens('grocer');
  s.shopAt(store);
  s.setProduct(productId);
  s.setBasketOpen(false);
}

/** "My weekly shop": what's in the basket, what it all adds up to, and how to make it lighter. */
export function BasketPanel() {
  const basket = useApp((s) => s.basket);
  const month = useApp((s) => s.month);
  const setMonth = useApp((s) => s.setMonth);
  const current = useApp((s) => s.store);
  const setPacks = useApp((s) => s.setPacks);
  const pinOrigin = useApp((s) => s.pinOrigin);
  const addToBasket = useApp((s) => s.addToBasket);
  const setBasket = useApp((s) => s.setBasket);
  const setOpen = useApp((s) => s.setBasketOpen);
  const findMe = useApp((s) => s.findMe);
  const [confirmClear, setConfirmClear] = useState(false);
  const store = basket.store ?? current;
  const result = useMemo(() => (store && basket.items.length ? computeBasket(basket.items, store, month) : null), [basket.items, store, month]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const lines = result ? [...result.lines].sort((a, b) => b.co2 - a.co2) : [];
  const maxLine = Math.max(0, ...lines.map((l) => l.co2));
  const t = result?.totals;
  const grade = t && t.kg ? gradeOf(t.co2PerKg) : null;
  const swaps = lines.filter((l) => l.swap).sort((a, b) => b.swap!.saving - a.swap!.saving);
  const seasons = lines.filter((l) => l.season && !l.swap).sort((a, b) => b.season!.pct * b.co2 - a.season!.pct * a.co2).slice(0, 3);
  const offPicks = lines.filter((l) => l.pinnedOff);
  const inBasket = new Set(basket.items.map((i) => i.productId));
  const more = PRODUCTS.filter((p) => !inBasket.has(p.id));
  const add = (id: string) => { sfx.select(); addToBasket(id, 1, store); };

  return (
    <section className="basket-panel" aria-label="My weekly shop">
      <header className="bk-head">
        <span className="bk-icon">🧺</span>
        <div>
          <b>My weekly shop</b>
          <small>{store ? <>at {storeName(store)} · {LONG[month - 1]}</> : 'pick your store to see the numbers'}</small>
        </div>
        <button className="bk-close" onClick={() => setOpen(false)} aria-label="Close the basket" title="Close (Esc)">✕</button>
      </header>
      {store && current && current.properties.osm !== store.properties.osm && (
        <button className="bk-restore" onClick={() => setBasket({ store: current })}>🔁 Price it at {storeName(current)} instead</button>
      )}

      {!store && (
        <div className="bk-empty">
          <p>Your basket is priced at your own supermarket, so pick a store first: open a supermarket and a store, or find the ones near you.</p>
          <button className="near-gps" onClick={() => { setOpen(false); findMe(true); }}>📍 Find my store</button>
        </div>
      )}
      {store && !basket.items.length && (
        <div className="bk-empty">
          <p>Your basket is empty. Add products with the <b>+</b> on each product in the aisle, or start from a typical week's fresh shop and change it from there.</p>
          <button className="bk-typical" onClick={() => { sfx.select(); setBasket({ items: TYPICAL_WEEK.map((i) => ({ ...i })), store }); }}>🧺 Start with a typical week</button>
        </div>
      )}

      {result && t && grade && (
        <>
          <div className="bk-totals">
            <div style={{ '--c': grade.color } as CSSProperties}>
              <span>CO<sub>2</sub>e</span><b>{fmtCo2(t.co2)}</b>
              <small><em className="grade-chip" style={{ background: grade.color, color: grade.ink }}>{grade.grade}</em> {fmtKg(t.co2PerKg)} kg per kg</small>
            </div>
            <div style={{ '--c': '#8b5cf6' } as CSSProperties}><span>On the receipt</span><b>{fmtEur(t.eur)}</b><small>{t.kg.toFixed(1)} kg of fresh food</small></div>
            <div style={{ '--c': '#0ea5e9' } as CSSProperties}><span>Travelled</span><b>{Math.round(t.km).toLocaleString('en-GB')} km</b><small>all the products together</small></div>
            <div style={{ '--c': '#fb7185' } as CSSProperties}><span>Food lost on the way</span><b>{fmtMass(t.lostKg)}</b><small>{fmtEur(t.wasteEur)} of the bill pays for it</small></div>
          </div>
          <p className="bk-line">
            Like driving <b>{(t.co2 / CAR_KG_PER_KM).toFixed(0)} km</b> in a petrol car · <Flag country="NL" /> <b>{Math.round(t.localShare * 100)}%</b> grown in the Netherlands
            {t.flown > 0 && <> · ✈️ <b>{t.flown}</b> {t.flown === 1 ? 'product' : 'products'} flown in</>}
          </p>

          <YearChart byMonth={result.byMonth} month={month} onPick={setMonth} />

          {(swaps.length > 0 || offPicks.length > 0) && (
            <div className="bk-tips">
              {swaps.length > 0 && <h4>💡 Swaps that save {fmtCo2(t.saving)} CO<sub>2</sub>e this week</h4>}
              {swaps.map((l) => (
                <div key={l.product.id} className="bk-tip">
                  <span className="bk-tip-emoji">{l.product.emoji}</span>
                  <p><b>{l.product.name}</b>: <Flag country={l.swap!.route.origin.country} /> {l.swap!.route.label} instead of {l.route.label} saves <b>{fmtCo2(l.swap!.saving)}</b> ({Math.round(l.swap!.pct * 100)}% less)</p>
                  <button onClick={() => { sfx.select(); pinOrigin(l.product.id, l.swap!.route.id); }}>Swap</button>
                </div>
              ))}
              {offPicks.map((l) => (
                <div key={`off-${l.product.id}`} className="bk-tip muted">
                  <span className="bk-tip-emoji">{l.product.emoji}</span>
                  <p>The {l.product.name.toLowerCase()} origin you picked isn't in season in {LONG[month - 1]}, so this counts {l.route.label}.</p>
                  <button onClick={() => pinOrigin(l.product.id, null)}>Reset</button>
                </div>
              ))}
            </div>
          )}
          {seasons.length > 0 && (
            <div className="bk-tips">
              <h4>📅 Better another time of year</h4>
              {seasons.map((l) => (
                <div key={`s-${l.product.id}`} className="bk-tip muted">
                  <span className="bk-tip-emoji">{l.product.emoji}</span>
                  <p><b>{l.product.name}</b>: {Math.round(l.season!.pct * 100)}% lower footprint in {LONG[l.season!.month - 1]}.</p>
                  <button onClick={() => setMonth(l.season!.month)}>{MONTHS[l.season!.month - 1]}</button>
                </div>
              ))}
            </div>
          )}

          <h4>In your basket <small>biggest footprint first</small></h4>
          <ul className="bk-items">
            {lines.map((l) => <Line key={l.product.id} l={l} max={maxLine} store={store!} onPacks={(n) => setPacks(l.product.id, n)} />)}
          </ul>
        </>
      )}

      {store && more.length > 0 && (
        <div className="bk-more">
          <h4>Add more</h4>
          <div className="bk-more-row">
            {more.map((p) => <button key={p.id} onClick={() => add(p.id)} title={`Add ${p.name} (${p.pack.label})`}>{p.emoji}<span>+</span></button>)}
          </div>
        </div>
      )}

      {basket.items.length > 0 && (
        <div className="bk-foot">
          <p className="fineprint">Modelled for one typical pack of each product at this store, with the origin it usually stocks that month unless you swapped <ConfidenceBadge level="extrapolated" />. Your basket is kept in this browser only.</p>
          <button className={`bk-clear ${confirmClear ? 'sure' : ''}`} onClick={() => { if (confirmClear) { setBasket({ items: [] }); setConfirmClear(false); } else setConfirmClear(true); }} onBlur={() => setConfirmClear(false)}>
            {confirmClear ? 'Sure? Empty the basket' : 'Empty the basket'}
          </button>
        </div>
      )}
    </section>
  );
}

function Line({ l, max, store, onPacks }: { l: BasketLine; max: number; store: StoreFeature; onPacks: (n: number) => void }) {
  const g = gradeOf(l.c.co2e.total);
  return (
    <li className="bk-item">
      <button className="bk-item-main" onClick={() => openProduct(store, l.product.id)} title={`Play the journey of ${l.product.name}`}>
        <span className="bk-emoji">{l.product.emoji}</span>
        <span className="bk-name">
          <b>{l.product.name}</b>
          <small><Flag country={l.route.origin.country} /> {l.route.label} · {l.product.pack.label}</small>
        </span>
      </button>
      <span className="bk-stepper">
        <button onClick={() => onPacks(l.item.packs - 1)} aria-label={`One ${l.product.name} less`}>−</button>
        <b>{l.item.packs}</b>
        <button onClick={() => onPacks(l.item.packs + 1)} aria-label={`One ${l.product.name} more`}>+</button>
      </span>
      <span className="bk-figs">
        <span className="bk-co2"><em className="grade-chip" style={{ background: g.color, color: g.ink }}>{g.grade}</em> {fmtCo2(l.co2)}</span>
        <small>{fmtEur(l.eur)}</small>
      </span>
      <span className="bk-share"><i style={{ width: `${max ? (100 * l.co2) / max : 0}%`, background: g.color }} /></span>
    </li>
  );
}

function YearChart({ byMonth, month, onPick }: { byMonth: number[]; month: number; onPick: (m: number) => void }) {
  const max = Math.max(...byMonth), min = Math.min(...byMonth);
  // a basket that barely changes through the year has no best month to point at
  const flat = max - min < 0.02 * max;
  const best = flat ? 0 : byMonth.indexOf(min) + 1;
  const now = byMonth[month - 1];
  return (
    <div className="bk-year">
      <div className="bk-year-head">
        <b>Your basket through the year</b>
        <small>{flat ? 'about the same all year' : best === month ? 'this is its lowest month' : <>lowest in {LONG[best - 1]}: {fmtCo2(min)} ({Math.round((1 - min / now) * 100)}% less)</>}</small>
      </div>
      <div className="bk-year-bars" role="group" aria-label="The basket's footprint in each month">
        {byMonth.map((v, i) => (
          <button key={i} className={`${i + 1 === month ? 'cur' : ''} ${i + 1 === best ? 'best' : ''}`} onClick={() => onPick(i + 1)} title={`${LONG[i]}: ${fmtCo2(v)} CO2e`}>
            <i style={{ height: `${max ? 18 + (82 * v) / max : 0}%` }} />
            <span>{MONTHS[i][0]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
