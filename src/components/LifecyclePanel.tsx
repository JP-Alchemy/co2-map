import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MODES } from '../data';
import { ROLE_ICON } from '../data/labels';
import { MARKET_BY_ID } from '../data/markets';
import { gradeOf } from '../game/grade';
import { fmtKg, fmtKm, MONTHS } from '../model/compute';
import type { Flow, LcFocus, Lifecycle } from '../model/lifecycle';
import { useApp } from '../store';
import type { TransportMode } from '../types';
import { ConfidenceBadge, Flag } from './ui';

interface Props {
  lc: Lifecycle;
  focus: LcFocus;
  onFocus: (f: LcFocus) => void;
  /** play one flow as a journey */
  onFollow: (flow: Flow) => void;
}

const pct = (v: number) => (v >= 0.995 ? '100%' : v < 0.01 ? '<1%' : `${Math.round(v * 100)}%`);
const days = (d: number) => (d < 2 ? `${Math.round(d * 24)} h` : `${d.toFixed(d < 10 ? 1 : 0)} days`);

function GradeChip({ co2 }: { co2: number }) {
  const g = gradeOf(co2);
  return <span className="lc-grade" style={{ background: g.color, color: g.ink }} title={`${g.label} footprint`}>{g.grade}</span>;
}

/** The product lens: one product from every field it grows in to every shelf it reaches, for a month. */
export function LifecyclePanel({ lc, focus, onFocus, onFollow }: Props) {
  const month = useApp((s) => s.month);
  const [openPick, setOpen] = useState<string | null>(lc.markets[0]?.market ?? null);
  // a country or grocer picked on the map opens its row here
  const focusMarket = focus?.kind === 'market' ? focus.id : focus?.kind === 'grocer' ? lc.markets.find((m) => m.grocers.some((g) => g.grocer.id === focus.id))?.market : undefined;
  const open = focusMarket ?? openPick;
  const rows = useRef<Record<string, HTMLLIElement | null>>({});
  useEffect(() => { if (focusMarket) rows.current[focusMarket]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [focusMarket]);

  // the mode that carries it furthest, for the transport stage's icon
  const kmByMode = new Map<TransportMode, number>();
  for (const o of lc.origins) for (const [m, v] of Object.entries(o.computed.byMode) as [TransportMode, { km: number }][]) kmByMode.set(m, (kmByMode.get(m) ?? 0) + v.km * o.weight);
  const mainMode = [...kmByMode.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'reefer_truck';
  const countries = [...new Set(lc.origins.map((o) => o.route.origin.country))];
  const hubRoles = [...new Set(lc.hubs.map((h) => h.kind))];
  const stages = [
    { icon: '🌱', n: `${countries.length}`, label: countries.length === 1 ? 'country grows it' : 'countries grow it' },
    { icon: MODES[mainMode].icon, n: lc.total.km >= 10_000 ? `${Math.round(lc.total.km / 1000)}k km` : fmtKm(lc.total.km), label: 'on average to a shelf' },
    { icon: hubRoles.includes('ripening') ? ROLE_ICON.ripening : hubRoles.includes('port') ? ROLE_ICON.port : ROLE_ICON.import, n: `${lc.hubs.length}`, label: 'ports, packers & traders' },
    { icon: '🏬', n: `${lc.total.grocers}`, label: `grocers in ${lc.total.markets} countries` },
    { icon: '🛒', n: `~${Math.round(lc.total.stores / 1000)}k`, label: 'stores they run' },
  ];

  return (
    <div className="panel lc-panel">
      <div className="lc-head">
        <span className="lc-emoji">{lc.product.emoji}</span>
        <div>
          <b>{lc.product.name}</b>
          <small>from farm to shelf across Europe in {MONTHS[month - 1]} · change the month or play the year on the timeline below</small>
        </div>
      </div>

      <ol className="lc-stages">
        {stages.map((s, i) => (
          <li key={i} style={{ animationDelay: `${i * 70}ms` }}><span className="lc-st-icon">{s.icon}</span><b>{s.n}</b><small>{s.label}</small></li>
        ))}
      </ol>

      <div className="lc-view" role="group" aria-label="What the map shows">
        <button className={!focus ? 'on' : ''} onClick={() => onFocus(null)}>🌍 Whole journey</button>
        <button className={focus?.kind === 'europe' ? 'on' : ''} onClick={() => onFocus({ kind: 'europe' })}>🚚 Distribution</button>
      </div>

      <div className="lc-avg">
        <GradeChip co2={lc.total.co2} />
        <span><b>{fmtKg(lc.total.co2)}</b> kg CO<sub>2</sub>e per kg on average · {days(lc.total.days)} from harvest to shelf</span>
      </div>

      <h4>Where it grows in {MONTHS[month - 1]}</h4>
      <ul className="lc-list">
        {lc.origins.map((o) => (
          <li key={o.route.id} className="lc-row static">
            <div className="lc-row-top"><Flag country={o.route.origin.country} /> <span className="lc-name">{o.route.label}</span><GradeChip co2={o.co2} /></div>
            <div className="lc-bar"><i style={{ width: pct(o.weight), background: '#4ade80' }} /></div>
            <div className="lc-meta">{pct(o.weight)} of supply · dispatched from {o.dispatch.name.split(',')[0]} · {fmtKg(o.co2)} kg CO<sub>2</sub>e/kg</div>
          </li>
        ))}
      </ul>

      <h4>Where it goes <small>click a country to see its grocers</small></h4>
      <ul className="lc-list">
        {lc.markets.map((m) => {
          const meta = MARKET_BY_ID[m.market];
          const isOpen = open === m.market;
          const focused = focus?.kind === 'market' && focus.id === m.market;
          const inMarket = focus?.kind === 'grocer' && m.grocers.some((g) => g.grocer.id === focus.id);
          return (
            <li key={m.market} ref={(e) => { rows.current[m.market] = e; }} className={`lc-row ${focused || inMarket ? 'focus' : ''}`} style={{ '--c': meta.color } as CSSProperties}>
              <button className="lc-row-btn" onClick={() => { setOpen(isOpen ? null : m.market); onFocus(focused ? null : { kind: 'market', id: m.market }); }}>
                <div className="lc-row-top"><Flag country={m.market} /> <span className="lc-name">{meta.name}</span><span className="lc-pct">{pct(m.volume)}</span><GradeChip co2={m.co2} /></div>
                <div className="lc-bar"><i style={{ width: pct(m.volume), background: meta.color }} /></div>
                <div className="lc-meta">{fmtKg(m.co2)} kg CO<sub>2</sub>e/kg · {fmtKm(m.km)} · {days(m.days)} · {m.grocers.length} grocer{m.grocers.length > 1 ? 's' : ''}</div>
              </button>
              {isOpen && (
                <ul className="lc-grocers">
                  {m.grocers.map((g) => {
                    const gf = focus?.kind === 'grocer' && focus.id === g.grocer.id;
                    return (
                      <li key={g.grocer.id} className={gf ? 'focus' : ''}>
                        <button className="lc-g-main" onClick={() => onFocus(gf ? { kind: 'market', id: m.market } : { kind: 'grocer', id: g.grocer.id })}>
                          <span className="lc-g-logo" style={{ background: g.grocer.color, color: g.grocer.textColor }}>{g.grocer.name[0]}</span>
                          <span className="lc-g-name">{g.grocer.name}<small>{pct(g.volume)} of the volume · ~{g.grocer.stores.toLocaleString('en-GB')} stores</small></span>
                          <span className="lc-g-co2">{fmtKg(g.co2)}<small>kg/kg</small></span>
                        </button>
                        <button className="lc-follow" onClick={() => onFollow(g.flow)} title={`Play the journey to ${g.grocer.name}`}>▶</button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <p className="fineprint">
        How the volume splits between countries and grocers is an indicative model <ConfidenceBadge level="extrapolated" />, in line with Dutch trade statistics and each country's grocery market shares.
        Grocers abroad are drawn at one representative distribution location; that is not a confirmed supplier link. The Netherlands shows its five chains only.
      </p>
    </div>
  );
}
