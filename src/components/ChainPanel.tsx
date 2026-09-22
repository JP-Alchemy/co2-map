import { useMemo, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import type { Chain, StoreProps } from '../types';
import { useApp, type StoreFeature } from '../store';
import { ConfidenceBadge } from './ui';

export function ChainPanel({ chain, stores }: { chain: Chain; stores: FeatureCollection<Point, StoreProps> | null }) {
  const setStore = useApp((s) => s.setStore);
  const [q, setQ] = useState('');
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
