import { useEffect, useState } from 'react';

/** Counts from 0 up to `target` over `ms` once mounted (or jumps there with reduced motion). */
export function useCountUp(target: number, ms = 900, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { const id = requestAnimationFrame(() => setV(target)); return () => cancelAnimationFrame(id); }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / ms));
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}
