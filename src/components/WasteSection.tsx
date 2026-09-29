import { useMemo, type CSSProperties } from 'react';
import { FATES, REGION_LABEL, STAGES, WASTE_SOURCE } from '../data/waste';
import { fmtEur, fmtKg, type ComputedRoute } from '../model/compute';
import { computeWaste, fmtMass, type FateKg } from '../model/waste';
import { ConfidenceBadge } from './ui';

const pct = (v: number) => `${v < 0.1 ? (v * 100).toFixed(1) : Math.round(v * 100)}%`;

function Fates({ fates }: { fates: FateKg[] }) {
  return (
    <span className="wf-fates">
      {fates.map((f) => (
        <span key={f.fate} className="wf-fate" style={{ '--c': FATES[f.fate].color } as CSSProperties} title={`${FATES[f.fate].label}: ${FATES[f.fate].note}`}>
          {FATES[f.fate].icon} {FATES[f.fate].label.toLowerCase()} <b>{fmtMass(f.kg)}</b>
        </span>
      ))}
    </span>
  );
}

/** How much of a product is lost from field to plate, where it goes, and what that adds to the price and the footprint. */
export function WasteSection({ c }: { c: ComputedRoute }) {
  const w = useMemo(() => computeWaste(c), [c]);
  const name = c.product.name.toLowerCase();
  const home = w.stages.find((s) => s.stage === 'home')!;
  const eaten = 1 - home.kg;
  // one bar for the whole harvest: what each stage loses, and what is finally eaten
  const parts = [...w.stages.map((s) => ({ key: s.stage, kg: s.kg, color: STAGES[s.stage].color, label: STAGES[s.stage].label })), { key: 'eaten', kg: eaten, color: '#22c55e', label: 'Eaten' }];
  const maxFate = Math.max(...w.fates.map((f) => f.kg));

  return (
    <div className="waste">
      <p className="waste-lead">
        To put <b>1 kg</b> of {name} on the shelf, about <b>{w.harvestedKg.toFixed(2)} kg</b> is harvested. Counting what is thrown away at home,
        only <b>{Math.round(w.eatenShare * 100)}%</b> of the harvest is eaten.
      </p>
      <div className="waste-funnel" role="img" aria-label={`Of ${w.harvestedKg.toFixed(2)} kg harvested, ${eaten.toFixed(2)} kg is eaten`}>
        {parts.map((p) => <i key={p.key} style={{ flexGrow: p.kg, background: p.color }} title={`${p.label}: ${fmtMass(p.kg)}`} />)}
      </div>
      <div className="waste-funnel-legend"><span>harvested {w.harvestedKg.toFixed(2)} kg</span><span>eaten {eaten.toFixed(2)} kg</span></div>

      <ul className="waste-stages">
        {w.stages.map((s) => (
          <li key={s.stage} style={{ '--c': STAGES[s.stage].color } as CSSProperties}>
            <span className="ws-icon">{STAGES[s.stage].icon}</span>
            <div className="ws-body">
              <div className="ws-top"><b>{STAGES[s.stage].label}</b><span><b>{fmtMass(s.kg)}</b> · {pct(s.rate)}</span></div>
              <small>{s.stage === 'home' ? `of every kilo bought is thrown away` : `lost of what arrives, per kilo that reaches the shelf`}</small>
              <Fates fates={s.fates} />
            </div>
          </li>
        ))}
      </ul>

      <div className="waste-cost">
        <p>💶 About <b>{fmtEur(w.lostEur)} per kg</b> ({pct(w.priceShare)} of the shelf price) pays for {name} lost after harvest: the farm price, packing, freight, cooling and handling of food that is never sold.</p>
        <p>☁️ That lost food had already caused <b>{fmtKg(w.lostCo2e)} kg CO<sub>2</sub>e</b> per kg sold, on top of the {fmtKg(c.co2e.total)} kg in the grade.</p>
        <p>🏠 What is thrown away at home costs <b>{fmtEur(w.homeEur)}</b> and <b>{fmtKg(w.homeCo2e)} kg CO<sub>2</sub>e</b> of every kilo bought.</p>
      </div>

      <h5>Where it ends up <small>best use first</small></h5>
      <ul className="waste-fates">
        {w.fates.map((f) => (
          <li key={f.fate} title={FATES[f.fate].note} style={{ '--c': FATES[f.fate].color } as CSSProperties}>
            <span className="wfl-icon">{FATES[f.fate].icon}</span>
            <span className="wfl-label">{FATES[f.fate].label}</span>
            <span className="wfl-bar"><i style={{ width: `${(100 * f.kg) / maxFate}%` }} /></span>
            <b>{fmtMass(f.kg)}</b>
          </li>
        ))}
      </ul>
      <p className="fineprint">
        Per kilo on the shelf. Loss rates are FAO's averages for {w.region === 'europe' ? 'Europe' : `${REGION_LABEL[w.region]} (farm, packing and transport) and Europe (shop and home)`}
        {' '}<ConfidenceBadge level="extrapolated" />: indicative for this product, not measured for this chain. Where the food ends up is our estimate of typical Dutch practice.
        Losses on the farm are already priced into the farm-gate price and the growing footprint, so only later losses count towards the cost and CO<sub>2</sub>e above.
        Source: <a href={WASTE_SOURCE.url} target="_blank" rel="noreferrer">{WASTE_SOURCE.label}</a>.
      </p>
    </div>
  );
}
