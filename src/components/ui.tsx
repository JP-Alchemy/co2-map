import type { Confidence } from '../types';

export function ConfidenceBadge({ level, compact }: { level: Confidence; compact?: boolean }) {
  const label = level === 'verified' ? 'Verified' : level === 'likely' ? 'Likely' : 'Estimated';
  return <span className={`conf conf-${level}`} title={CONF_HELP[level]}>{compact ? '' : label}</span>;
}

const CONF_HELP: Record<Confidence, string> = {
  verified: 'Taken from a primary source (company, port authority, OpenStreetMap).',
  likely: 'Widely reported but not confirmed from a primary source for this exact link.',
  extrapolated: 'A modelled estimate; illustrative, not measured.',
};

export function Flag({ country }: { country: string }) {
  const cc = country.toUpperCase();
  const flag = String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  return <span className="flag" title={cc}>{flag}</span>;
}

export function Tile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="tile" style={accent ? { borderTopColor: accent } : undefined}>
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  );
}

export function Bar({ parts, total, unit }: { parts: { label: string; value: number; color: string }[]; total: number; unit: string }) {
  return (
    <div className="bar-wrap">
      <div className="bar">
        {parts.map((p) => (
          <div key={p.label} className="bar-part" style={{ width: `${(100 * p.value) / total}%`, background: p.color }} title={`${p.label}: ${p.value.toFixed(3)} ${unit}`} />
        ))}
      </div>
      <div className="bar-legend">
        {parts.map((p) => (
          <span key={p.label}><i style={{ background: p.color }} />{p.label} <b>{Math.round((100 * p.value) / total)}%</b></span>
        ))}
      </div>
    </div>
  );
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
/** A number whose digits roll like an odometer when it changes. */
export function Odo({ value }: { value: string }) {
  const chars = [...value];
  return (
    <span className="odo" role="text" aria-label={value}>
      {chars.map((ch, i) => {
        const k = chars.length - i; // keyed from the right, so digits keep rolling as the number grows
        return /\d/.test(ch)
          ? <span key={`d${k}`} className="odo-d" aria-hidden="true"><span style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>{DIGITS.map((d) => <i key={d}>{d}</i>)}</span></span>
          : <span key={`c${k}`} className="odo-c" aria-hidden="true">{ch}</span>;
      })}
    </span>
  );
}
