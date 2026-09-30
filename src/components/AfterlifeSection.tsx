import { useMemo, type CSSProperties } from 'react';
import { LIMIT_LABEL, PHONE_CHARGE_KWH, RESCUE, TREATMENT } from '../data/afterlife';
import { FATES } from '../data/waste';
import type { ComputedRoute } from '../model/compute';
import { computeAfterlife } from '../model/afterlife';
import { ConfidenceBadge } from './ui';

const g = (kg: number) => (kg < 1 ? `${Math.round(kg * 1000)} g` : `${kg.toFixed(2)} kg`);
const place = (name: string) => name.replace(/^.*?(distribution centre|DC)\s*/i, '').split(',')[0];

interface Props {
  c: ComputedRoute;
  /** the reverse route is drawn on the map */
  onMap: boolean;
  onToggleMap: () => void;
}

/** What happens to the food a store doesn't sell: shelf life, what the store tries first, and where the rest goes. */
export function AfterlifeSection({ c, onMap, onToggleMap }: Props) {
  const a = useMemo(() => computeAfterlife(c), [c]);
  const name = c.product.name.toLowerCase();
  const days = a.shelf?.days ?? 0;
  const k = a.perKg;
  const electricSaving = k.co2eTransport ? 1 - k.co2eElectric / k.co2eTransport : 0;

  return (
    <div className="al">
      <p className="al-lead">
        {a.shelf
          ? <>{c.product.name} can stay on the shelf for about <b>{days} day{days > 1 ? 's' : ''}</b>, limited by its {LIMIT_LABEL[a.shelf.limit]}. {a.shelf.note} </>
          : null}
        About <b>{g(a.unsoldKg)}</b> of every kilo delivered to the store isn't sold.
      </p>

      {a.shelf && (
        <div className="al-days" aria-label={`${days} days on the shelf`}>
          {Array.from({ length: Math.min(days, 21) }, (_, i) => (
            <i key={i} className={i === Math.min(days, 21) - 1 ? 'last' : ''} style={{ '--f': i / Math.max(1, Math.min(days, 21) - 1) } as CSSProperties} />
          ))}
          <span className="al-days-label">day 1</span><span className="al-days-label end">day {days}</span>
        </div>
      )}
      <ol className="al-rescue">
        {RESCUE.map((r) => <li key={r.label} title={r.note}><span>{r.icon}</span><b>{r.label}</b></li>)}
      </ol>

      <h5>Where the unsold {name} {c.product.name.endsWith('s') ? 'go' : 'goes'}</h5>
      <ul className="al-dests">
        {a.dests.map((d) => (
          <li key={d.fate} style={{ '--c': FATES[d.fate].color } as CSSProperties}>
            <span className="al-icon">{FATES[d.fate].icon}</span>
            <div>
              <div className="al-top"><b>{FATES[d.fate].label}</b><span>{Math.round(d.share * 100)}%</span></div>
              <small>
                {d.fate === 'food' ? 'collected at the store'
                  : d.facility ? <>{d.facility.name}, {d.facility.town} · {Math.round(d.tripKm)} km from the store</>
                  : d.fate === 'feed' ? <>a regional feed processor, about {Math.round(d.tripKm)} km</> : null}
                {TREATMENT[d.fate] && d.fate !== 'food' && <> · {TREATMENT[d.fate]!.what}</>}
              </small>
            </div>
          </li>
        ))}
        <li className="al-landfill" style={{ '--c': '#64748b' } as CSSProperties}>
          <span className="al-icon">🕳️</span>
          <div>
            <div className="al-top"><b>Landfill</b><span>0%</span></div>
            <small>The Netherlands bans landfilling separately collected food and other organic waste, so practically none ends up there. Where it still happens, a kilo rots into about {TREATMENT.landfill!.co2e} kg CO<sub>2</sub>e of methane.</small>
          </div>
        </li>
      </ul>

      <div className="al-trip">
        <p>🚛 On average a kilo of unsold {name} travels another <b>{Math.round(k.km)} km</b>{a.dc && <>: back to the DC in {place(a.dc.name)} on the truck that delivered it ({Math.round(a.backhaulKm)} km), then on to the plant</>}.
          That's about <b>{k.fuelMl.toFixed(1)} ml of diesel</b> and <b>{Math.round(k.co2eTransport * 1000)} g CO<sub>2</sub>e</b>.</p>
        <p>⚡ With electric trucks: <b>{Math.round(k.kWhElectric * 1000)} Wh</b> of electricity and <b>{Math.round(k.co2eElectric * 1000)} g CO<sub>2</sub>e</b> ({Math.round(electricSaving * 100)}% less), and no diesel.</p>
        <p>♻️ Treating it emits about <b>{Math.round(k.treatment * 1000)} g CO<sub>2</sub>e</b> per kilo and gives back about <b>{Math.round(k.energyKWh * 1000)} Wh</b> of electricity, enough to charge a phone {Math.round(k.energyKWh / PHONE_CHARGE_KWH)} times.
          In a landfill the same kilo would cause about {Math.round(k.landfillCo2e / Math.max(0.001, k.treatment + k.co2eTransport))} times as much.</p>
      </div>

      <button className={`al-map ${onMap ? 'on' : ''}`} onClick={onToggleMap}>{onMap ? '✕ Hide the route to the plants' : '🗺️ Show where it goes on the map'}</button>

      <p className="fineprint">
        Shelf lives, what stores try first and where the rest goes are typical Dutch practice, not this chain's own figures <ConfidenceBadge level="extrapolated" />.
        The plants are real, at approximate locations; which one handles this store's waste is our assumption (the nearest of each kind to its distribution centre).
        Treatment emissions and energy are indicative values in the range of European waste studies, not measurements of these plants.
      </p>
    </div>
  );
}
