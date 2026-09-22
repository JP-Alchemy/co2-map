// Converts a raw Overpass JSON export of shop=supermarket elements into public/data/stores.geojson,
// keeping only the chains defined in src/data/chains (matched on brand/name tags).
// Usage: node scripts/build-stores.mjs <raw-overpass.json>
import fs from 'node:fs';

const BRANDS = {
  ah:    /^(albert heijn( xl)?|ah( to go| xl)?)$/i,
  jumbo: /^jumbo( foodmarkt| city)?$/i,
  lidl:  /^lidl$/i,
  aldi:  /^aldi$/i,
  plus:  /^plus$/i,
};

const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const features = [];
const counts = {};
for (const el of raw.elements) {
  const t = el.tags || {};
  const label = (t.brand || t.name || '').trim();
  const chain = Object.entries(BRANDS).find(([, re]) => re.test(label))?.[0];
  if (!chain) continue;
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) continue;
  const addr = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
  features.push({
    type: 'Feature',
    id: el.id,
    geometry: { type: 'Point', coordinates: [+lon.toFixed(6), +lat.toFixed(6)] },
    properties: {
      chain,
      name: t.name || label,
      street: addr || undefined,
      city: t['addr:city'] || undefined,
      postcode: t['addr:postcode'] || undefined,
      osm: `${el.type}/${el.id}`,
    },
  });
  counts[chain] = (counts[chain] || 0) + 1;
}
const fc = { type: 'FeatureCollection', generated: new Date().toISOString().slice(0, 10), source: 'OpenStreetMap contributors (ODbL), via Overpass API', features };
fs.writeFileSync('public/data/stores.geojson', JSON.stringify(fc));
console.log('stores written:', features.length, counts);
