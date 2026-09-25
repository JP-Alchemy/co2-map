# Where does my food come from?

An interactive map of the fresh-produce supply chains behind the five largest Dutch supermarket chains
(Albert Heijn, Jumbo, Lidl, ALDI, PLUS). Pick a chain, a store, and a product from the fresh aisle, and the
map shows where it was grown, how it travelled (ship, truck, air, ferry) through which ports, importers,
ripening rooms and distribution centres, and what each stage cost in kilometres, days, euros and CO2e.

It is built as a teaching tool: the goal is to make an invisible history visible, with every claim labelled
by how sure we are about it.

The whole app is a full-screen satellite globe under layered, ever-changing clouds, played like a small game: pick a
supermarket from the cards over the turning planet, pick a store on the map, then pick a product from the hotbar
of the fresh aisle (hover one to sketch its route and see its CO2e grade). Its journey then plays: the camera flies
to the farm, a little truck, ship, plane, train or ferry travels each leg while its trail lights up (thicker for
more carbon-heavy modes), every stop drops in, and numbers fly from the map into a running ledger of distance,
time, CO2e, fuel and money for one retail pack. The journey ends on a result screen with an A–E grade, the badges
it earned, a lower-carbon origin to try instead, and a stamp in your passport (kept in the browser). The journey
can be paused, scrubbed, sped up, skipped or replayed (space, arrow keys and Esc work too); sound is off until you
switch it on; with reduced motion the journey opens on its final frame.

**Follow a product** turns it around: hover a product in the bar to sketch its whole network and frame it, then
pick it to see its whole life for a month on one map. Supply lines run
from every origin (coloured by transport mode) to where it is dispatched, then fan out to 23 grocers in six countries
(the Netherlands, Germany, Belgium, the UK, France and Sweden), as wide as their share of the volume, with particles
flowing along all of them. A panel breaks it down by origin, country and grocer, with volume-weighted CO2e, distance
and days; click a country or grocer to zoom to its distribution, play the year to watch origins change with the
seasons, or follow any grocer's flow as a full journey. The export splits and the foreign grocers' locations are an
indicative model, labelled as such in the app.

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
src/data/markets.ts            six markets, their main grocers, and indicative export splits per product
src/data/factors.ts            emission, speed, cost and storage factors, with sources
src/model/compute.ts           turns a route + chain + store into stages with km, hours, CO2e and EUR
src/model/geo.ts               great-circle and arc geometry, antimeridian handling
src/model/routing.ts           optional real-road geometry for truck legs (public OSRM demo server)
src/model/lifecycle.ts         one product across every market: origins, flows to each grocer, totals
src/map/style.ts               satellite globe style (Esri imagery, OpenFreeMap labels, atmosphere)
src/map/clouds.ts              WebGL clouds: a deck and high cirrus on elevated spheres, parallax, evolving shapes, shadows
src/map/camera.ts              globe-aware framing and a scrubbable fly-to curve
src/journey/timeline.ts        turns a computed route into timed segments, camera poses and running totals
src/journey/vehicles.ts        side-view SVG vehicles for each transport mode
src/game/                      CO2e grade bands, badges, synthesised sound effects
src/components/JourneyPlayer.tsx  the journey animation: vehicle, trail, stop pins, ledger, particles, scrubber
src/components/ResultScreen.tsx   grade, badges, swap-to-save tip and passport at the end of a journey
src/components/Hud.tsx         trail of chips (where you are) and the settings in the corner
src/components/Hotbar.tsx      the fresh aisle as an inventory bar, with route previews on hover
src/components/LifecyclePanel.tsx  the product view's breakdown by origin, country and grocer
src/map/lifecycleOverlay.ts    the product view on the map: supply and distribution lines, particles, badges
src/components/                chain cards, dock panels (chain, store, route), about page
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

Store data © OpenStreetMap contributors, ODbL. Satellite imagery © Esri, Maxar, Earthstar Geographics. Labels,
borders and roads by OpenFreeMap / OpenMapTiles. Everything else in this
repository is original work; use it freely with attribution.
