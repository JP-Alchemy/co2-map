import { FUEL_CO2E_PER_L, HANDLING_EUR_PER_KG, IMPORT_MARGIN, MODES, SOURCES, STORAGE } from '../data/factors';
import { useApp } from '../store';
import { ConfidenceBadge } from './ui';

export function About() {
  const setView = useApp((s) => s.setView);
  return (
    <div className="about">
      <div className="about-inner">
        <button className="close" onClick={() => setView('explore')}>✕ back to the map</button>
        <h2>How this map works</h2>
        <p>
          Most of what we eat has an invisible history: a farm, a packhouse, a port, a ship, a ripening room, a warehouse and a truck, before it sits on a shelf.
          This map makes that history visible for the fresh aisle of the five largest Dutch supermarket chains. It is a teaching tool, not an audit.
        </p>

        <h3>What is real and what is modelled</h3>
        <ul>
          <li><b>Store locations</b> are real, taken from OpenStreetMap. Stores without an address tag show the coordinates only.</li>
          <li><b>Origins, ports, importers and distribution centres</b> are real places. Each carries a label: <ConfidenceBadge level="verified" /> from a primary source, <ConfidenceBadge level="likely" /> widely reported but not confirmed for this exact link, <ConfidenceBadge level="extrapolated" /> our estimate.</li>
          <li><b>Producers</b> are real organisations or growing regions that grow the product for the Dutch market. Which farm supplied which store on a given day is commercially confidential, so that link is marked "likely" unless a retailer states it.</li>
          <li><b>Which distribution centre</b> serves your store is assumed to be the chain's nearest one that handles fresh produce.</li>
          <li><b>Numbers</b> (emissions, costs, durations) are derived from the route geometry and the factor tables below. They are reasonable order-of-magnitude estimates that make different products and origins comparable; they are not measured for a specific delivery.</li>
        </ul>

        <h3>The calculation</h3>
        <p>For every route the model adds three parts, all per kilogram of product:</p>
        <ol>
          <li><b>Growing</b>: a cradle-to-farm-gate footprint for that product from that origin, taken from published life-cycle studies.</li>
          <li><b>Transport</b>: for each leg, distance × emission factor for the mode. Sea and air legs follow great-circle paths through real canals and straits; truck legs use real road routing when available, otherwise great-circle distance × 1.25.</li>
          <li><b>Storage and ripening</b>: days at each stop × a cooling factor.</li>
        </ol>
        <p>The price split starts from a typical shelf price and subtracts VAT, an estimated farm-gate price, packing, freight at typical contract rates, storage, handling ({HANDLING_EUR_PER_KG.toFixed(2)} €/kg per stop) and an importer margin ({Math.round(IMPORT_MARGIN * 100)}%). Whatever remains is the retailer's gross margin, which covers the store, staff, waste and profit.</p>

        <p>Fuel burned is shown as litres of diesel-equivalent: the transport CO2e divided by {FUEL_CO2E_PER_L} kg CO2e per litre (DEFRA 2024, well-to-wheel). Ships burn heavy fuel oil and planes kerosene, but per litre they emit about the same, so it is a fair way to compare modes.</p>

        <h3>The journey animation</h3>
        <p>Choosing a product plays its journey on the globe. Time is compressed: each leg takes a few seconds, more for longer distances (on a logarithmic scale, so a 20 km truck hop and a 10,000 km crossing both stay watchable). The counters show the modelled values for one retail pack, adding each leg's distance, time, CO2e, fuel and freight cost as the vehicle moves, and each stop's storage, handling and margins when it is reached. The shelf price is only complete once the product reaches your store, where the retailer's margin and VAT are added. The clouds are decorative, not real weather.</p>

        <h3>Transport factors</h3>
        <table className="factors">
          <thead><tr><th>Mode</th><th>kg CO2e / tonne-km</th><th>Speed</th><th>€ / tonne-km</th></tr></thead>
          <tbody>
            {Object.values(MODES).map((m) => <tr key={m.label}><td>{m.icon} {m.label}</td><td>{m.co2ePerTkm}</td><td>{m.kmh} km/h</td><td>{m.eurPerTkm.toFixed(3)}</td></tr>)}
          </tbody>
        </table>
        <p className="small">Air freight excludes non-CO2 high-altitude effects, which would roughly double it. Refrigerated modes include the reefer unit's fuel or electricity.</p>

        <h3>Storage factors</h3>
        <table className="factors">
          <thead><tr><th>Storage</th><th>kg CO2e / kg / day</th><th>€ / kg / day</th></tr></thead>
          <tbody>
            {Object.values(STORAGE).map((s) => <tr key={s.label}><td>{s.label}</td><td>{s.co2ePerKgDay}</td><td>{s.eurPerKgDay}</td></tr>)}
          </tbody>
        </table>

        <h3>Sources</h3>
        <ul className="sources">
          {SOURCES.map((s) => <li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}
        </ul>

        <h3>Known limitations</h3>
        <ul>
          <li>Seasonal origin shares are typical patterns, not the actual purchasing of any chain in any week.</li>
          <li>Food waste along the chain (often 5 to 15 % for soft fruit) is not included; it would raise every number.</li>
          <li>Packaging, the consumer's own car trip and cooking are out of scope.</li>
          <li>Water use, biodiversity, labour conditions and pesticide use matter as much as carbon and are not shown yet.</li>
        </ul>
        <p className="small">Data is static and reviewed occasionally. Corrections are welcome: every place, producer and factor lives in a plain text file in the project.</p>
      </div>
    </div>
  );
}
