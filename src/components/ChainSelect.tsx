import { CHAINS } from '../data';
import { sfx } from '../game/sound';
import { useApp } from '../store';

/** The landing screen: a title over the turning planet and a "choose your supermarket" card row. */
export function ChainSelect({ counts }: { counts: Record<string, number> }) {
  const setChain = useApp((s) => s.setChain);
  return (
    <>
      <header className="title-card">
        <h1>Where does my <em>food</em> come from?</h1>
        <p>Pick a supermarket, a store and something from the fresh aisle, then follow it from the farm to the shelf: every truck, ship and plane, and what it cost in kilometres, CO<sub>2</sub>e and euros.</p>
      </header>
      <section className="chain-select" aria-label="Choose a supermarket">
        <div className="cs-label">Choose your supermarket</div>
        <div className="cs-row">
          {CHAINS.map((c, i) => (
            <button key={c.id} className="cs-card" style={{ '--c': c.color, animationDelay: `${i * 70}ms` } as never}
              onMouseEnter={() => sfx.hover()} onClick={() => { sfx.select(); setChain(c.id); }}>
              <span className="cs-logo" style={{ background: c.color, color: c.textColor }}>{c.name[0]}</span>
              <span className="cs-name">{c.name}</span>
              <span className="cs-stats"><b>{(counts[c.id] ?? c.approxStores).toLocaleString('en-GB')}</b> stores · <b>{c.dcs.length}</b> DC{c.dcs.length > 1 ? 's' : ''}</span>
              <span className="cs-go">Fly there →</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
