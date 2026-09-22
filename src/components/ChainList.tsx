import { CHAINS } from '../data';
import { useApp } from '../store';

export function ChainList({ counts }: { counts: Record<string, number> }) {
  const setChain = useApp((s) => s.setChain);
  const setView = useApp((s) => s.setView);
  return (
    <div className="panel">
      <p className="intro">
        Pick a supermarket chain, then a store, then something from the fresh aisle. The map shows where it was grown,
        how it travelled, and what that cost in money, time and CO2e. <button className="link" onClick={() => setView('about')}>How the numbers are made</button>
      </p>
      <ul className="chain-list">
        {CHAINS.map((c) => (
          <li key={c.id}>
            <button className="chain-btn" onClick={() => setChain(c.id)} style={{ '--chain': c.color } as never}>
              <span className="chain-swatch" style={{ background: c.color, color: c.textColor }}>{c.name[0]}</span>
              <span className="chain-meta">
                <b>{c.name}</b>
                <small>{counts[c.id] ?? c.approxStores} stores on the map · {c.dcs.length} distribution centre{c.dcs.length > 1 ? 's' : ''}</small>
              </span>
              <span className="chev">›</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="fineprint">Store locations come from OpenStreetMap and are real. Supply chains are modelled per product, with each fact labelled by how sure we are.</p>
    </div>
  );
}
