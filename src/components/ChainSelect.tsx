import { CHAINS } from '../data';
import { sfx } from '../game/sound';
import { useApp } from '../store';

/** The start screen: a title over the turning planet, a choice of story, and the supermarket cards. */
export function ChainSelect({ counts }: { counts: Record<string, number> }) {
  const setChain = useApp((s) => s.setChain);
  const lens = useApp((s) => s.lens);
  const setLens = useApp((s) => s.setLens);
  const findMe = useApp((s) => s.findMe);
  const pick = (l: 'grocer' | 'product') => { if (l !== lens) { sfx.select(); setLens(l); } };
  return (
    <>
      <header className="title-card" key={lens}>
        {lens === 'grocer' ? (
          <>
            <h1>Where does my <em>food</em> come from?</h1>
            <p>Pick a supermarket, a store and something from the fresh aisle, then follow it from the farm to the shelf: every truck, ship and plane, and what it cost in kilometres, CO<sub>2</sub>e and euros.</p>
          </>
        ) : (
          <>
            <h1>Where does my <em>food</em> go?</h1>
            <p>Pick a product to see its whole life at once: every field it grows in this month, the ports and traders it passes, and every grocer in six countries whose shelves it ends up on.</p>
          </>
        )}
      </header>
      <div className={`lens-toggle ${lens}`} role="tablist" aria-label="Choose a story">
        <button role="tab" aria-selected={lens === 'grocer'} className={lens === 'grocer' ? 'on' : ''} onClick={() => pick('grocer')}>🛒 Follow a supermarket</button>
        <button role="tab" aria-selected={lens === 'product'} className={lens === 'product' ? 'on' : ''} onClick={() => pick('product')}>🌍 Follow a product</button>
      </div>
      {lens === 'grocer' && (
        <section className="chain-select" aria-label="Choose a supermarket">
          <div className="cs-row">
            <button className="cs-card near" style={{ '--c': '#38bdf8' } as never}
              onMouseEnter={() => sfx.hover()} onClick={() => { sfx.select(); findMe(true); }}>
              <span className="cs-logo" aria-hidden="true">📍</span>
              <span className="cs-name">Near me</span>
              <span className="cs-stats">your <b>local</b> stores</span>
              <span className="cs-go">Use my location →</span>
            </button>
            {CHAINS.map((c, i) => (
              <button key={c.id} className="cs-card" style={{ '--c': c.color, animationDelay: `${(i + 1) * 70}ms` } as never}
                onMouseEnter={() => sfx.hover()} onClick={() => { sfx.select(); setChain(c.id); }}>
                <span className="cs-logo" style={{ background: c.color, color: c.textColor }}>{c.name[0]}</span>
                <span className="cs-name">{c.name}</span>
                <span className="cs-stats"><b>{(counts[c.id] ?? c.approxStores).toLocaleString('en-GB')}</b> stores · <b>{c.dcs.length}</b> DC{c.dcs.length > 1 ? 's' : ''}</span>
                <span className="cs-go">Fly there →</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
