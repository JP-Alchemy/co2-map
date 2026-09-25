import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { gradeOf } from '../game/grade';
import { sfx } from '../game/sound';
import { fmtKg, MONTHS } from '../model/compute';
import type { MonthStat } from '../model/useYear';
import { Flag } from './ui';

/** how long each month lasts while the year plays */
const STEP_MS = 1500;
const LONG = MONTHS.map((_, i) => new Date(2001, i, 1).toLocaleString('en-GB', { month: 'long' }));

interface Props {
  month: number;
  onChange: (month: number) => void;
  /** the product's year, one entry per month (undefined while a month is still being worked out) */
  stats?: (MonthStat | undefined)[] | null;
  /** offer "play the year" */
  playable?: boolean;
  /** only set the month when a drag ends, rather than at every month the drag passes */
  commitOnRelease?: boolean;
  /** the pointer arrived on the timeline (the bar drops its product preview) */
  onEnter?: () => void;
}

const monthOf = (p: number) => Math.min(12, Math.max(1, Math.floor(p) + 1));

/**
 * The year as a scrubber: a bar per month for the product's footprint (coloured by grade, the lowest month
 * marked) with a flag wherever its main origin changes. Drag or click to pick a month, use the arrow keys,
 * or play the year and watch the cursor sweep through the seasons.
 */
export function MonthTimeline({ month, onChange, stats, playable = true, commitOnRelease, onEnter }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const pos = useRef(month - 0.5);
  const change = useRef(onChange);
  useEffect(() => { change.current = onChange; });
  const [playing, setPlaying] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  // a bar that stops offering playback (a product was picked) stops playing too
  if (playing && !playable) setPlaying(false);
  const live = playing && playable;
  const shown = drag ?? month;

  /** cursor position in months from the start of January (0..12) */
  const place = (p: number) => { pos.current = p; root.current?.style.setProperty('--p', String(p / 12)); };
  // at rest the cursor sits in the middle of the month
  useLayoutEffect(() => { if (!live && drag === null) place(month - 0.5); }, [month, live, drag]);

  // playing: sweep through the months at a steady pace, switching as the cursor enters each one
  useEffect(() => {
    if (!live) return;
    let raf = 0, last = performance.now(), at = monthOf(pos.current);
    const frame = (now: number) => {
      const p = Math.min(12, pos.current + (now - last) / STEP_MS);
      last = now;
      place(p);
      const m = monthOf(p);
      if (m !== at) { at = m; change.current(m); sfx.tick(1 + m / 16); }
      if (p >= 12) { setPlaying(false); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live]);

  const togglePlay = () => {
    if (live) { setPlaying(false); return; }
    // from the current month on; a year that has already been played starts again in January
    if (month === 12) { place(0); onChange(1); } else place(month - 0.5);
    setPlaying(true);
    sfx.select();
  };

  const at = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * 12;
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    const p = at(e.clientX), m = monthOf(p);
    setPlaying(false);
    setDrag(m);
    place(p);
    if (!commitOnRelease && m !== month) onChange(m);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = at(e.clientX), m = monthOf(p);
    if (drag === null) { if (m !== hover) setHover(m); return; }
    place(p);
    if (m !== drag) {
      setDrag(m);
      sfx.tick(1 + m / 16);
      if (!commitOnRelease) onChange(m);
    }
  };
  const up = () => {
    if (drag === null) return;
    if (commitOnRelease && drag !== month) onChange(drag);
    setDrag(null);
  };
  const key = (e: ReactKeyboardEvent) => {
    const to = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? (month % 12) + 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? ((month + 10) % 12) + 1
      : e.key === 'Home' ? 1 : e.key === 'End' ? 12 : null;
    if (to === null) return;
    e.preventDefault();
    setPlaying(false);
    onChange(to);
  };

  // bars to scale against the product's own worst month
  const vals = (stats ?? []).map((s) => (s && Number.isFinite(s.co2) ? s.co2 : NaN));
  const finite = vals.filter((v) => Number.isFinite(v));
  const max = finite.length ? Math.max(...finite) : 0, min = finite.length ? Math.min(...finite) : 0;
  const varies = finite.length === 12 && max > min * 1.08;

  const bubbleMonth = drag ?? (live ? month : hover);
  const bs = bubbleMonth ? stats?.[bubbleMonth - 1] : undefined;
  const bg = bs && Number.isFinite(bs.co2) ? gradeOf(bs.co2) : null;
  const cur = stats?.[shown - 1];

  return (
    <div ref={root} className={`mt ${live ? 'playing' : ''} ${drag !== null ? 'dragging' : ''}`} onPointerEnter={onEnter}>
      {playable && (
        <button className={`mt-play ${live ? 'on' : ''}`} onClick={togglePlay} title={live ? 'Pause' : 'Play the year'} aria-label={live ? 'Pause' : 'Play the year'}>
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            {live ? <path d="M2 1.5h3v9H2zM7 1.5h3v9H7z" fill="currentColor" /> : <path d="M3 1.2 10.5 6 3 10.8z" fill="currentColor" />}
          </svg>
        </button>
      )}
      <div ref={track} className="mt-track" role="slider" tabIndex={0} aria-label="Month" aria-valuemin={1} aria-valuemax={12} aria-valuenow={shown}
        aria-valuetext={`${LONG[shown - 1]}${cur && Number.isFinite(cur.co2) ? `, ${fmtKg(cur.co2)} kg CO2e per kg, mostly from ${cur.country}` : ''}`}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onPointerLeave={() => setHover(null)} onKeyDown={key}>
        <div className="mt-rail"><i className="mt-fill" /></div>
        {MONTHS.map((name, i) => {
          const m = i + 1, s = stats?.[i], v = vals[i];
          const g = Number.isFinite(v) ? gradeOf(v) : null;
          const flag = s?.country && (i === 0 || stats?.[i - 1]?.country !== s.country) ? s.country : null;
          return (
            <div key={name} className={`mt-seg ${m === shown ? 'cur' : ''} ${varies && v <= min * 1.03 ? 'best' : ''} ${s && !s.inSeason ? 'off' : ''}`}>
              <span className="mt-bar-zone">
                <span className="mt-bar" style={{ '--h': g ? Math.max(0.1, v / max) : 0, '--c': g?.color } as CSSProperties} />
              </span>
              <span className="mt-label"><b className="mt-l3">{name}</b><b className="mt-l1">{name[0]}</b>{flag && <Flag country={flag} />}</span>
            </div>
          );
        })}
        <span className="mt-cursor" aria-hidden="true" />
        {bubbleMonth && (
          <span className="mt-bubble" style={drag === null && !live ? ({ '--p': (bubbleMonth - 0.5) / 12 } as CSSProperties) : undefined}>
            <b>{LONG[bubbleMonth - 1]}</b>
            {bs && bg && <>
              <span><Flag country={bs.country} /> {fmtKg(bs.co2)} kg CO₂e/kg</span>
              <em className="grade-chip" style={{ background: bg.color, color: bg.ink }}>{bg.grade}</em>
            </>}
            {bs && !bs.inSeason && <small>out of season</small>}
            {bs && varies && bs.co2 <= min * 1.03 && <small className="mt-best">lowest of the year</small>}
          </span>
        )}
      </div>
    </div>
  );
}
