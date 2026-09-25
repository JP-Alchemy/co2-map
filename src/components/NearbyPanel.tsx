import { useState, type FormEvent } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import { CHAIN_BY_ID } from '../data';
import { sfx } from '../game/sound';
import { FAR_KM, findPlace, fmtDistance, LOCATE_HELP, tripHint, type Hit } from '../model/near';
import { useApp } from '../store';
import type { StoreProps } from '../types';

interface Props {
  stores: FeatureCollection<Point, StoreProps> | null;
  hits: { perChain: Hit[]; more: Hit[] } | null;
  /** a store row under the pointer, to highlight on the map */
  onFocus: (osm: string | null) => void;
}

function Row({ hit, top, onFocus }: { hit: Hit; top?: boolean; onFocus: Props['onFocus'] }) {
  const shopAt = useApp((s) => s.shopAt);
  const p = hit.store.properties, chain = CHAIN_BY_ID[p.chain];
  return (
    <li>
      <button className={`near-row ${top ? 'top' : ''}`} style={{ '--c': chain.color } as never}
        onMouseEnter={() => { onFocus(p.osm); sfx.hover(); }} onMouseLeave={() => onFocus(null)} onFocus={() => onFocus(p.osm)} onBlur={() => onFocus(null)}
        onClick={() => { sfx.select(); onFocus(null); shopAt(hit.store); }}>
        <span className="near-logo" style={{ background: chain.color, color: chain.textColor }}>{chain.name[0]}</span>
        <span className="near-name">
          <b>{chain.name}{top && <em>closest</em>}</b>
          <small>{[p.street, p.city].filter(Boolean).join(', ') || 'address not tagged in OpenStreetMap'}</small>
        </span>
        <span className="near-dist"><b>{fmtDistance(hit.km)}</b><small>{tripHint(hit.km)}</small></span>
      </button>
    </li>
  );
}

/** "Near me": the supermarkets around the player, the nearest of each chain first. */
export function NearbyPanel({ stores, hits, onFocus }: Props) {
  const here = useApp((s) => s.here);
  const locating = useApp((s) => s.locating);
  const locateError = useApp((s) => s.locateError);
  const findMe = useApp((s) => s.findMe);
  const setHere = useApp((s) => s.setHere);
  const [q, setQ] = useState('');
  const [miss, setMiss] = useState<string | null>(null);
  const search = (e: FormEvent) => {
    e.preventDefault();
    if (!stores) return;
    const found = findPlace(stores, q);
    if (found) { sfx.select(); setHere(found); setMiss(null); } else setMiss(q.trim());
  };
  const far = !!hits?.perChain[0] && hits.perChain[0].km > FAR_KM;

  return (
    <div className="panel near-panel">
      {locating && <p className="near-status"><span className="near-spin" aria-hidden="true" />Finding you… your browser may ask whether to share your location.</p>}
      {!locating && locateError && <p className="near-status warn">{LOCATE_HELP[locateError]}</p>}
      {!stores && <p className="near-status"><span className="near-spin" aria-hidden="true" />Loading the store map…</p>}

      {here && hits && (
        <>
          <p className="near-where">
            Around <b>{here.source === 'gps' ? 'your location' : here.label}</b>
            {here.accuracy ? <> (±{fmtDistance(here.accuracy / 1000)})</> : null}
            <small>Your location stays on this device: the stores are looked up in the map you already loaded.</small>
          </p>
          {far && <p className="near-status warn">You seem to be outside the Netherlands. This map only has the five big Dutch chains, so these are the closest stores to you.</p>}
          <h4>Your nearest supermarkets</h4>
          <ul className="near-list">
            {hits.perChain.map((h, i) => <Row key={h.store.properties.osm} hit={h} top={i === 0 && !far} onFocus={onFocus} />)}
          </ul>
          {hits.more.length > 0 && (
            <>
              <h4>Also close by</h4>
              <ul className="near-list">
                {hits.more.map((h) => <Row key={h.store.properties.osm} hit={h} onFocus={onFocus} />)}
              </ul>
            </>
          )}
          <p className="hint">Pick one to shop there, or click any store on the map.</p>
        </>
      )}

      <form className="near-search" onSubmit={search}>
        <label htmlFor="near-q">{here ? 'Somewhere else?' : 'Or type your town or postcode'}</label>
        <div>
          <input id="near-q" className="search" value={q} onChange={(e) => { setQ(e.target.value); setMiss(null); }} placeholder="e.g. Utrecht or 3511" autoComplete="postal-code" />
          <button type="submit" disabled={!stores || q.trim().length < 2}>Search</button>
        </div>
      </form>
      {miss && <p className="hint">No store addresses match “{miss}”. Try a Dutch town or a four-digit postcode.</p>}
      {!locating && (!here || here.source === 'search') && (
        <button className="near-gps" onClick={() => { sfx.select(); findMe(true); }}>📍 {locateError ? 'Try my location again' : 'Use my location'}</button>
      )}
    </div>
  );
}
