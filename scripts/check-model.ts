// Runs the model for every product × route × chain against one sample store per chain and prints a summary.
import { CHAINS, PLACES, PRODUCTS, PRODUCERS } from '../src/data';
import { computeRoute, fmtKg } from '../src/model/compute';
import { buildLifecycle } from '../src/model/lifecycle';
import type { Place } from '../src/types';

const sampleStore: Place = { id: 'store_test', name: 'Test store, Utrecht', kind: 'store', country: 'NL', coords: [5.12, 52.09], confidence: 'verified' };
let errors = 0;
for (const p of PRODUCTS) {
  for (const r of p.routes) {
    for (const pid of r.producerIds) if (!PRODUCERS[pid]) { console.error(`✗ ${p.id}/${r.id}: unknown producer ${pid}`); errors++; }
    for (const s of r.steps) if (s.kind === 'node' && !PLACES[s.placeId]) { console.error(`✗ ${p.id}/${r.id}: unknown place ${s.placeId}`); errors++; }
    for (const chain of CHAINS) {
      try {
        const c = computeRoute(p, r, chain, sampleStore, PLACES);
        const bad = [c.co2e.total, c.cost.shelf, c.totalKm, c.totalDays].some((v) => !Number.isFinite(v));
        if (bad) { console.error(`✗ ${p.id}/${r.id}/${chain.id}: NaN`); errors++; }
        if (chain.id === 'ah') {
          const modes = Object.entries(c.byMode).map(([m, v]) => `${m}:${Math.round(v.km)}`).join(' ');
          console.log(`${p.emoji} ${p.id.padEnd(10)} ${r.id.padEnd(14)} co2e=${fmtKg(c.co2e.total).padStart(6)} (grow ${fmtKg(c.co2e.production)}, tr ${fmtKg(c.co2e.transport)}, st ${fmtKg(c.co2e.storage)})  km=${Math.round(c.totalKm).toString().padStart(6)} days=${c.totalDays.toFixed(1).padStart(5)}  retail€=${c.cost.retailMargin.toFixed(2)}  ${modes}`);
        }
      } catch (e) { console.error(`✗ ${p.id}/${r.id}/${chain.id}: ${(e as Error).message}`); errors++; }
    }
  }
}
// product lifecycles: every month's volume must add up to 100% and every flow must have finite numbers
for (const p of PRODUCTS) {
  for (let month = 1; month <= 12; month++) {
    const lc = buildLifecycle(p, month);
    const vol = lc.flows.reduce((s, f) => s + f.volume, 0);
    if (Math.abs(vol - 1) > 1e-6) { console.error(`✗ lifecycle ${p.id}/${month}: volume adds up to ${vol}`); errors++; }
    for (const f of lc.flows) if (![f.computed.co2e.total, f.computed.totalKm, f.volume].every(Number.isFinite)) { console.error(`✗ lifecycle ${p.id}/${month}: NaN in ${f.key}`); errors++; }
  }
  const lc = buildLifecycle(p, 9);
  console.log(`${p.emoji} ${p.id.padEnd(10)} Sep: ${lc.origins.length} origin(s) → ${lc.total.grocers} grocers in ${lc.total.markets} countries, ${fmtKg(lc.total.co2)} kg CO2e/kg on average  ` + lc.markets.map((m) => `${m.market} ${Math.round(m.volume * 100)}%`).join(' '));
}
console.log(errors ? `\n${errors} errors` : '\nall routes OK');
process.exit(errors ? 1 : 0);
