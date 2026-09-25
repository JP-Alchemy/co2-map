import { useMemo, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import type { Chain, StoreProps } from '../types';
import { haversineKm } from '../model/geo';
import { fmtDistance, LOCATE_HELP, tripHint } from '../model/near';
import { useApp, type StoreFeature } from '../store';
import { ConfidenceBadge } from './ui';

export function ChainPanel({ chain, stores }: { chain: Chain; stores: FeatureCollection<Point, StoreProps> | null }) {
  const setStore = useApp((s) => s.setStore);
  const here = useApp((s) => s.here);
  const locating = useApp((s) => s.locating);
  const locateError = useApp((s) => s.locateError);
  const findMe = useApp((s) => s.findMe);
  const [q, setQ] = useState('');
  // once we know where the player is, this chain's stores closest to them
  const closest = useMemo(() => {
    if (!stores || !here) return null;
    return stores.features.filter((f) => f.properties.chain === chain.id)
      .map((f) => ({ store: f as StoreFeature, km: haversineKm(here.coords, f.geometry.coordinates as [number, number]) }))
      .sort((a, b) => a.km - b.km).slice(0, 3);
  }, [stores, here, chain.id]);
  const matches = useMemo(() => {
    if (!stores || q.trim().length < 2) return [] as StoreFeature[];
    const needle = q.trim().toLowerCase();
    return stores.features.filter((f) => f.properties.chain === chain.id && [f.properties.city, f.properties.street, f.properties.postcode, f.properties.name].some((v) => v?.toLowerCase().includes(needle))).slice(0, 25) as StoreFeature[];
  }, [stores, q, chain.id]);

  return (
    <div className="panel">
      <p className="desc">{chain.description}</p>
      <div className="kv"><span>Owner</span><b>{chain.parent}</b></div>
      <div className="kv"><span>Head office</span><b>{chain.hq.name.replace(/^.*?, /, '')}</b></div>
      <h4>Distribution centres <small>(black-ringed dots on the map)</small></h4>
      <ul className="dc-list">
        {chain.dcs.map((d) => (
          <li key={d.id}><span>{d.name}{d.fresh ? '' : <em> · ambient only</em>}</span><ConfidenceBadge level={d.confidence} /></li>
        ))}
      </ul>
      <p className="desc small">{chain.freshSupply.description} <ConfidenceBadge level={chain.freshSupply.confidence} /></p>
      <h4>Choose a store</h4>
      <p className="hint">Click any dot on the map, or search by town or street.</p>
      {closest ? (
        <>
          <h5>Closest to {here?.source === 'search' ? here.label : 'you'}</h5>
          <ul className="store-list near-closest">
            {closest.map((h) => (
              <li key={h.store.properties.osm}>
                <button onClick={() => setStore(h.store)}>
                  <b>{h.store.properties.name} <em>{fmtDistance(h.km)} · {tripHint(h.km)}</em></b>
                  <small>{[h.store.properties.street, h.store.properties.city].filter(Boolean).join(', ') || 'address not tagged in OSM'}</small>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <button className="near-gps" disabled={locating || !stores} onClick={() => findMe(false)}>{locating ? 'Finding you…' : `📍 Find the ${chain.name} nearest me`}</button>
      )}
      {!closest && !locating && locateError && <p className="hint">{LOCATE_HELP[locateError]}</p>}
      <input className="search" placeholder="e.g. Utrecht, Haarlemmerdijk, 3011" value={q} onChange={(e) => setQ(e.target.value)} />
      {matches.length > 0 && (
        <ul className="store-list">
          {matches.map((f) => (
            <li key={f.properties.osm}>
              <button onClick={() => setStore(f)}>
                <b>{f.properties.name}</b>
                <small>{[f.properties.street, f.properties.postcode, f.properties.city].filter(Boolean).join(', ') || 'address not tagged in OSM'}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && matches.length === 0 && <p className="hint">No {chain.name} store matches "{q}". Try the town name.</p>}
    </div>
  );
}
