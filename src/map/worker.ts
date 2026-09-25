import { setWorkerUrl } from 'maplibre-gl';
// MapLibre looks for its web worker (which parses vector tiles and GeoJSON) next to its own module file. That works
// when the dev server serves it straight from node_modules, but in the production bundle MapLibre's code lives in
// assets/index-*.js with no worker beside it, so the map would never finish loading: no labels, clouds or stores.
// Let Vite bundle the worker (with the code it shares with the main thread) as its own file and point MapLibre at it.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(workerUrl);
