import { PRODUCTS } from '../data';
import { useApp, type StoreFeature } from '../store';
import type { Chain } from '../types';

/** Dock content once a store is chosen: where it is, and what to do next. */
export function StoreCard({ chain, store }: { chain: Chain; store: StoreFeature }) {
  const passport = useApp((s) => s.passport);
  const p = store.properties;
  const done = Object.keys(passport.products).length;
  return (
    <div className="panel">
      <div className="store-head" style={{ borderColor: chain.color }}>
        <b>{p.name}</b>
        <small>{[p.street, p.postcode, p.city].filter(Boolean).join(', ') || 'Address not tagged in OpenStreetMap'}</small>
        <a className="osm" href={`https://www.openstreetmap.org/${p.osm}`} target="_blank" rel="noreferrer">View on OpenStreetMap ↗</a>
      </div>
      <p className="desc">Pick something from the fresh aisle below. Hover a product to see where it comes from; each one carries a CO<sub>2</sub>e grade from <b className="g-a">A</b> to <b className="g-e">E</b> per kilo.</p>
      <div className="passport-card">
        <div className="pc-head"><span>🛂 Your food passport</span><b>{done}/{PRODUCTS.length}</b></div>
        <div className="pc-stamps">
          {PRODUCTS.map((pr) => <span key={pr.id} className={passport.products[pr.id] ? 'got' : ''} title={pr.name}>{pr.emoji}</span>)}
        </div>
        <small>Finish a product's journey to stamp it.</small>
      </div>
    </div>
  );
}
