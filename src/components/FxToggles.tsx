import { useApp } from '../store';

/** Small switches for the map's visual effects. */
export function FxToggles() {
  const fx = useApp((s) => s.fx);
  const setFx = useApp((s) => s.setFx);
  return (
    <div className="fx-toggles" role="group" aria-label="Map effects">
      <button className={fx.clouds ? 'on' : ''} aria-pressed={fx.clouds} onClick={() => setFx({ clouds: !fx.clouds })}>☁️ Clouds</button>
      <button className={fx.grain ? 'on' : ''} aria-pressed={fx.grain} onClick={() => setFx({ grain: !fx.grain })}>🎞️ Film grain</button>
    </div>
  );
}
