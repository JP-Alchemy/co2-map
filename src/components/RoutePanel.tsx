import { Fragment } from 'react';
import { MODES, PLACES, PRODUCERS, STORAGE } from '../data';
import { fmtDuration, fmtEur, fmtKg, fmtKm, inSeason, MONTHS, type ComputedRoute } from '../model/compute';
import { useApp } from '../store';
import type { Product, SupplyRoute } from '../types';
import { Bar, ConfidenceBadge, Flag, Tile } from './ui';

const ROLE_LABEL: Record<string, string> = { origin: 'Grown here', packing: 'Packed', processing: 'Processed', port: 'Port', airport: 'Airport', import: 'Importer', ripening: 'Ripened', dc: 'Distribution centre', store: 'Your store' };
const ROLE_ICON: Record<string, string> = { origin: '🌱', packing: '📦', processing: '🏭', port: '⚓', airport: '🛫', import: '🏢', ripening: '🌡️', dc: '🏬', store: '🛒' };
const CAR_KG_PER_KM = 0.16;

interface Props {
  product: Product;
  route: SupplyRoute | null;
  computed: ComputedRoute | null;
  activeStep: number | null;
  onHover: (i: number | null) => void;
  onFocus: (i: number) => void;
}

export function RoutePanel({ product, route, computed, activeStep, onHover, onFocus }: Props) {
  const month = useApp((s) => s.month);
  const setMonth = useApp((s) => s.setMonth);
  const setRoute = useApp((s) => s.setRoute);
  const useRoads = useApp((s) => s.useRoads);
  const setUseRoads = useApp((s) => s.setUseRoads);
  const live = product.routes.filter((r) => inSeason(r, month));
  const options = live.length ? live : product.routes;

  return (
    <div className="panel route-panel">
      <div className="prod-head">
        <span className="prod-emoji big">{product.emoji}</span>
        <div>
          <b>{product.name}</b>
          <small>{product.pack.label} · about {fmtEur(route?.shelfPriceEur ?? product.shelfPriceEur)}</small>
        </div>
      </div>
      <p className="desc">{product.description}</p>

      <div className="month-row">
        <label>Shopping in</label>
        <select value={month} onChange={(e) => setMonth(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        {!live.length && <small className="warn">not usually stocked in {MONTHS[month - 1]}; showing all origins</small>}
      </div>

      <div className="route-tabs">
        {options.map((r) => (
          <button key={r.id} className={r.id === route?.id ? 'active' : ''} onClick={() => setRoute(r.id)}>
            <Flag country={r.origin.country} /> {r.label}
            <small>{seasonLabel(r)} · ~{Math.round(r.share * 100)}% of volume</small>
          </button>
        ))}
      </div>

      {computed && route && <RouteDetail c={computed} activeStep={activeStep} onHover={onHover} onFocus={onFocus} useRoads={useRoads} setUseRoads={setUseRoads} />}
    </div>
  );
}

function seasonLabel(r: SupplyRoute) {
  const { from, to } = r.season;
  if (from === 1 && to === 12) return 'all year';
  return `${MONTHS[from - 1]} – ${MONTHS[to - 1]}`;
}

function RouteDetail({ c, activeStep, onHover, onFocus, useRoads, setUseRoads }: { c: ComputedRoute; activeStep: number | null; onHover: (i: number | null) => void; onFocus: (i: number) => void; useRoads: boolean; setUseRoads: (b: boolean) => void }) {
  const packKg = c.product.pack.kg;
  const perPack = c.co2e.total * packKg;
  const carKm = perPack / CAR_KG_PER_KM;
  const modes = Object.entries(c.byMode) as [keyof typeof MODES, { km: number; co2eKg: number }][];

  return (
    <>
      <div className="tiles">
        <Tile label={`kg CO2e per ${c.product.pack.label.split(' (')[0]}`} value={fmtKg(perPack)} sub={`${fmtKg(c.co2e.total)} per kg · like driving ${carKm < 1 ? (carKm * 1000).toFixed(0) + ' m' : carKm.toFixed(1) + ' km'} by car`} accent="#16a34a" />
        <Tile label="travelled" value={fmtKm(c.totalKm)} sub={modes.map(([m, v]) => `${MODES[m].icon} ${Math.round(v.km).toLocaleString('en-GB')}`).join('  ')} accent="#0ea5e9" />
        <Tile label="from harvest to shelf" value={fmtDuration(c.totalDays * 24)} sub="typical, including storage" accent="#f59e0b" />
        <Tile label="price on the shelf" value={fmtEur(c.cost.shelf * packKg)} sub={`farmer gets ~${fmtEur(c.cost.farmGate * packKg)} (${Math.round((100 * c.cost.farmGate) / c.cost.shelf)}%)`} accent="#8b5cf6" />
      </div>

      <h4>The journey</h4>
      <p className="hint">Hover a step to highlight it, click to zoom the map to it. <label className="toggle"><input type="checkbox" checked={useRoads} onChange={(e) => setUseRoads(e.target.checked)} /> real roads for truck legs</label></p>
      <ol className="journey" onMouseLeave={() => onHover(null)}>
        {c.steps.map((s, i) => {
          const isTail = i >= c.tailStart;
          if (s.kind === 'node') {
            const sf = STORAGE[s.step.storage];
            return (
              <li key={s.index} className={`node ${activeStep === s.index ? 'active' : ''} ${isTail ? 'tail' : ''}`} onMouseEnter={() => onHover(s.index)} onClick={() => onFocus(s.index)}>
                <span className="j-icon">{ROLE_ICON[s.step.role]}</span>
                <div className="j-body">
                  <div className="j-title"><Flag country={s.place.country} /> {s.place.name} <ConfidenceBadge level={s.place.confidence} compact /></div>
                  <div className="j-meta">{ROLE_LABEL[s.step.role]}{s.step.days > 0 && <> · {s.step.days < 1 ? `${Math.round(s.step.days * 24)} h` : `${s.step.days} day${s.step.days > 1 ? 's' : ''}`} {sf.label.toLowerCase()}</>}{s.co2eKg > 0.0005 && <> · {fmtKg(s.co2eKg)} kg CO2e/kg</>}</div>
                  {(s.step.note || s.place.note) && <div className="j-note">{s.step.note ?? s.place.note}</div>}
                </div>
              </li>
            );
          }
          const mf = MODES[s.mode];
          return (
            <li key={s.index} className={`leg ${activeStep === s.index ? 'active' : ''}`} onMouseEnter={() => onHover(s.index)} onClick={() => onFocus(s.index)} style={{ '--mode': mf.color } as never}>
              <span className="j-icon mode">{mf.icon}</span>
              <div className="j-body">
                <div className="j-title">{mf.label}{s.routed ? '' : ''}</div>
                <div className="j-meta">{fmtKm(s.distanceKm)} · {fmtDuration(s.hours)} · <b>{fmtKg(s.co2eKg)} kg CO2e/kg</b> · {fmtEur(s.costEur)}/kg</div>
                {s.step.note && <div className="j-note">{s.step.note}</div>}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="fineprint">Grey steps are {c.chain.name}'s own network: {c.chain.freshSupply.description}</p>

      <h4>Where the CO2e comes from</h4>
      <Bar total={c.co2e.total} unit="kg CO2e/kg" parts={[
        { label: 'Growing', value: c.co2e.production, color: '#16a34a' },
        { label: 'Transport', value: c.co2e.transport, color: '#0ea5e9' },
        { label: 'Storage & ripening', value: c.co2e.storage, color: '#f59e0b' },
      ]} />
      <p className="desc small">Growing: {fmtKg(c.co2e.production)} kg CO2e/kg, {c.route.production.method.toLowerCase()} <ConfidenceBadge level={c.route.production.confidence} />. Source: {c.route.production.source}.</p>

      <h4>Where the money goes (per kg)</h4>
      <Bar total={c.cost.shelf} unit="€/kg" parts={[
        { label: 'Farmer', value: c.cost.farmGate, color: '#16a34a' },
        { label: 'Packing', value: c.cost.packing, color: '#84cc16' },
        { label: 'Transport', value: c.cost.transport, color: '#0ea5e9' },
        { label: 'Storage & handling', value: c.cost.storage + c.cost.handling, color: '#f59e0b' },
        { label: 'Importer', value: c.cost.importMargin, color: '#a855f7' },
        { label: 'Retailer', value: c.cost.retailMargin, color: '#64748b' },
        { label: 'VAT', value: c.cost.vat, color: '#cbd5e1' },
      ]} />
      <p className="fineprint">Shelf price {fmtEur(c.cost.shelf)}/kg is a typical 2026 figure; the split is estimated from farm-gate prices and freight rates and is <ConfidenceBadge level="extrapolated" />.</p>

      <h4>Who grew it</h4>
      <ul className="producers">
        {c.route.producerIds.map((id) => PRODUCERS[id]).filter(Boolean).map((p) => (
          <li key={p.id}>
            <div className="p-title"><Flag country={p.country} /> {p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.name} ↗</a> : p.name} <ConfidenceBadge level={p.confidence} /></div>
            <div className="p-meta">{p.kind === 'region' ? 'Growing region' : p.kind === 'cooperative' ? 'Cooperative' : p.kind === 'grower' ? 'Grower' : 'Company'} · {p.region}</div>
            <div className="p-desc">{p.description}</div>
          </li>
        ))}
      </ul>
      <p className="fineprint">Which exact farm supplied which store on a given day is not public. Producers listed are real organisations or regions known to grow this product for this market; the link to {c.chain.name} is <ConfidenceBadge level="likely" /> unless stated.</p>

      {c.route.notes?.length ? (
        <>
          <h4>Worth knowing</h4>
          <ul className="notes">{c.route.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </>
      ) : null}

      {c.product.routes.length > 1 && (
        <>
          <h4>Compare origins for {c.product.name.toLowerCase()}</h4>
          <CompareTable c={c} />
        </>
      )}
      <p className="fineprint">Legend: <ConfidenceBadge level="verified" /> primary source · <ConfidenceBadge level="likely" /> reported, not confirmed · <ConfidenceBadge level="extrapolated" /> modelled estimate. Places in this route: {c.steps.filter((s) => s.kind === 'node').map((s) => (s.kind === 'node' ? PLACES[s.place.id]?.country ?? 'NL' : '')).filter((v, i, a) => a.indexOf(v) === i).map((cc) => <Fragment key={cc}><Flag country={cc} /> </Fragment>)}</p>
    </>
  );
}

function CompareTable({ c }: { c: ComputedRoute }) {
  const setRoute = useApp((s) => s.setRoute);
  const setMonth = useApp((s) => s.setMonth);
  return (
    <table className="compare">
      <thead><tr><th>Origin</th><th>Season</th><th>kg CO2e/kg</th></tr></thead>
      <tbody>
        {c.product.routes.map((r) => {
          const est = r.production.co2ePerKg + estTransport(r);
          return (
            <tr key={r.id} className={r.id === c.route.id ? 'active' : ''} onClick={() => { setMonth(r.season.from); setRoute(r.id); }}>
              <td><Flag country={r.origin.country} /> {r.label}</td>
              <td>{seasonLabel(r)}</td>
              <td><b>{fmtKg(r.id === c.route.id ? c.co2e.total : est)}</b>{r.id !== c.route.id && <small> ≈</small>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Quick transport estimate for the comparison table (route steps only, no chain tail). */
function estTransport(r: SupplyRoute) {
  let sum = 0;
  for (let i = 0; i < r.steps.length; i++) {
    const s = r.steps[i];
    if (s.kind !== 'leg') continue;
    const a = r.steps[i - 1], b = r.steps[i + 1];
    if (a?.kind !== 'node' || b?.kind !== 'node') continue;
    const pa = PLACES[a.placeId], pb = PLACES[b.placeId];
    if (!pa || !pb) continue;
    const pts: [number, number][] = [pa.coords, ...(s.waypoints ?? []), pb.coords];
    let d = s.distanceKm ?? 0;
    if (!d) for (let j = 1; j < pts.length; j++) d += hav(pts[j - 1], pts[j]);
    if (!s.distanceKm) d *= MODES[s.mode].detour;
    sum += (d * MODES[s.mode].co2ePerTkm) / 1000;
  }
  return sum + 0.02; // + typical domestic tail
}
function hav(a: [number, number], b: [number, number]) {
  const R = 6371, r = (x: number) => (x * Math.PI) / 180;
  const s = Math.sin(r(b[1] - a[1]) / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(r(b[0] - a[0]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
