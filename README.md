# Where does my food come from?

An interactive map of the fresh-produce supply chains behind the five largest Dutch supermarket chains
(Albert Heijn, Jumbo, Lidl, ALDI, PLUS). Pick a chain, a store, and a product from the fresh aisle, and the
map shows where it was grown, how it travelled (ship, truck, air, ferry) through which ports, importers,
ripening rooms and distribution centres, and what each stage cost in kilometres, days, euros and CO2e.

It is built as a teaching tool: the goal is to make an invisible history visible, with every claim labelled
by how sure we are about it.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173. `npm run build` produces a static site in `dist/` that can be hosted anywhere
(no backend; all data is static JSON and TypeScript).

## What is real, what is modelled

| Layer | Source | Status |
| --- | --- | --- |
| Store locations (3,051) | OpenStreetMap via the Overpass API | real |
| Chain head offices and distribution centres | company sites, trade press, geocoded with Nominatim | real, each labelled `verified` or `likely` |
| Origins, ports, airports, importers, packers | public sources, geocoded | real, labelled |
| Producers | real cooperatives, companies and growing regions | real; the link to a specific chain is `likely` unless stated |
| Which DC serves a store | nearest DC of the chain that handles fresh produce | assumption |
| Seasonal origin shares | typical import patterns (CBS, trade press) | extrapolated |
| Emissions, costs, durations | route geometry × factor tables in `src/data/factors.ts` | extrapolated, order-of-magnitude |

The **About the data** page in the app explains the calculation and lists the sources.

## Project layout

```
public/data/stores.geojson     store points (chain, name, address, OSM id)
scripts/supermarkets.overpassql Overpass query used to fetch them
scripts/build-stores.mjs       raw Overpass JSON -> stores.geojson
scripts/check-model.ts         runs every product × route × chain and prints totals
src/types.ts                   data model (Place, Producer, Chain, Product, SupplyRoute, Step)
src/data/coords.json           [lon, lat] for every named place
src/data/places.ts             farms, packhouses, ports, importers, DCs; sea/air waypoints
src/data/chains.ts             the five chains, their DCs and fresh-produce supply set-up
src/data/producers.ts          who grows it
src/data/products.ts           17 products, 31 seasonal supply routes
src/data/factors.ts            emission, speed, cost and storage factors, with sources
src/model/compute.ts           turns a route + chain + store into stages with km, hours, CO2e and EUR
src/model/geo.ts               great-circle and arc geometry, antimeridian handling
src/model/routing.ts           optional real-road geometry for truck legs (public OSRM demo server)
src/components/                map, sidebar panels, directions-style route view, about page
```

## Updating the data

- **Stores**: run the query in `scripts/supermarkets.overpassql` against an Overpass server (send a User-Agent),
  save the JSON, then `node scripts/build-stores.mjs <file>`.
- **Places**: add coordinates to `coords.json` and a `p(...)` line in `places.ts`.
- **Products and routes**: edit `products.ts`. A route is a list of `n(...)` nodes and `l(...)` legs; sea and
  air legs take waypoints from the `SEA` lanes so they stay off land. Run `npx tsx scripts/check-model.ts`
  afterwards to catch unknown ids and to eyeball the totals.
- **Factors**: `factors.ts`. Keep the source list up to date.

## Licences

Store data © OpenStreetMap contributors, ODbL. Basemap by OpenFreeMap / OpenMapTiles. Everything else in this
repository is original work; use it freely with attribution.
