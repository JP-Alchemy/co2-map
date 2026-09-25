import { CHAIN_BY_ID, PRODUCT_BY_ID, PRODUCTS } from '../data';
import { sfx } from '../game/sound';
import { useApp } from '../store';

/** Top left: where you are in the game, as a trail of chips you can click to go back. */
export function QuestTrail() {
  const { lens, lifecycleId, chainId, store, productId, setStore, setProduct, setLens, setLifecycle, goHome } = useApp();
  const chain = chainId ? CHAIN_BY_ID[chainId] : null;
  const product = productId ? PRODUCT_BY_ID[productId] : null;
  const lcProduct = lifecycleId ? PRODUCT_BY_ID[lifecycleId] : null;
  const back = (fn: () => void) => () => { sfx.select(); fn(); };
  const home = (
    <button className={`trail-chip brand ${lens === 'grocer' ? (!chain ? 'cur' : '') : (!lcProduct ? 'cur' : '')}`} onClick={back(goHome)} title="Back to the start">
      <span className="trail-icon">🌍</span><span className="trail-text">{lens === 'grocer' ? 'Where does my food come from?' : 'Where does my food go?'}</span>
    </button>
  );
  if (lens === 'product') {
    return (
      <nav className="trail" aria-label="Where you are">
        {home}
        {lcProduct && (
          <button className="trail-chip cur" onClick={back(() => setLifecycle(lcProduct.id))}>
            <span className="trail-icon">{lcProduct.emoji}</span><span className="trail-text">{lcProduct.name} across Europe</span>
          </button>
        )}
        {store && (
          <button className="trail-chip return" onClick={back(() => setLens('grocer'))} title="Back to your supermarket">
            <span className="trail-icon">↩</span><span className="trail-text">Back to {store.properties.city ?? 'your store'}</span>
          </button>
        )}
      </nav>
    );
  }
  return (
    <nav className="trail" aria-label="Where you are">
      {home}
      {chain && (
        <button className={`trail-chip ${!store ? 'cur' : ''}`} onClick={back(() => setStore(null))} style={{ '--c': chain.color } as never}>
          <span className="trail-swatch" style={{ background: chain.color, color: chain.textColor }}>{chain.name[0]}</span><span className="trail-text">{chain.name}</span>
        </button>
      )}
      {store && (
        <button className={`trail-chip ${!product ? 'cur' : ''}`} onClick={back(() => setProduct(null))}>
          <span className="trail-icon">📍</span><span className="trail-text">{store.properties.city ?? store.properties.name}</span>
        </button>
      )}
      {product && (
        <span className="trail-chip cur"><span className="trail-icon">{product.emoji}</span><span className="trail-text">{product.name}</span></span>
      )}
    </nav>
  );
}

/** Top right: sound, effects and the about page. */
export function HudControls() {
  const fx = useApp((s) => s.fx);
  const setFx = useApp((s) => s.setFx);
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const stamps = useApp((s) => Object.keys(s.passport.products).length);
  return (
    <div className="hud-controls" role="group" aria-label="Settings">
      <span className="hud-pill passport" title="Products whose journey you have completed">🛂 {stamps}/{PRODUCTS.length}</span>
      <button className={`hud-btn ${fx.sound ? 'on' : ''}`} aria-pressed={fx.sound} title={fx.sound ? 'Sound on' : 'Sound off'}
        onClick={() => { setFx({ sound: !fx.sound }); if (!fx.sound) queueMicrotask(() => sfx.select()); }}>{fx.sound ? '🔊' : '🔇'}</button>
      <button className={`hud-btn ${fx.clouds ? 'on' : ''}`} aria-pressed={fx.clouds} title="Clouds" onClick={() => setFx({ clouds: !fx.clouds })}>☁️</button>
      <button className={`hud-btn ${fx.grain ? 'on' : ''}`} aria-pressed={fx.grain} title="Film grain" onClick={() => setFx({ grain: !fx.grain })}>🎞️</button>
      <button className="hud-btn text" onClick={() => setView(view === 'about' ? 'explore' : 'about')}>{view === 'about' ? '✕ Close' : 'ℹ️ About the data'}</button>
    </div>
  );
}
