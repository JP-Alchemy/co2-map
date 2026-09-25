import type { StyleSpecification } from 'maplibre-gl';

/**
 * Satellite globe basemap: Esri World Imagery under a thin vector overlay (borders, roads, place names)
 * from OpenFreeMap, rendered on a globe with an atmosphere. Everything is keyless and free to use with
 * attribution.
 */
const SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const VECTOR = 'https://tiles.openfreemap.org/planet';
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

const NAME = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];

export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS,
  projection: { type: 'globe' },
  // Sun over the viewer's left shoulder, so whichever side of the planet you look at is lit.
  light: { anchor: 'viewport', position: [1.5, 300, 35] },
  sky: {
    'sky-color': '#0b1d3a',
    'horizon-color': '#6fb6ff',
    'fog-color': '#a9d4ff',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.4,
    'fog-ground-blend': 0.8,
    // full atmosphere around the planet, fading out once you are close to the ground
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0],
  },
  sources: {
    satellite: {
      type: 'raster', tiles: [SATELLITE], tileSize: 256, maxzoom: 19,
      attribution: 'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    },
    openmaptiles: {
      type: 'vector', url: VECTOR,
      attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    { id: 'space', type: 'background', paint: { 'background-color': '#04070f' } },
    {
      id: 'satellite', type: 'raster', source: 'satellite',
      paint: {
        // a touch darker and punchier than the raw imagery so the coloured routes stand out
        'raster-saturation': 0.12,
        'raster-contrast': 0.08,
        'raster-brightness-max': ['interpolate', ['linear'], ['zoom'], 3, 0.92, 10, 0.8],
        'raster-fade-duration': 250,
      },
    },
    {
      id: 'roads', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 7,
      filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'class'], ['motorway', 'trunk'], '#ffd58a', '#ffffff'],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.25, 12, 0.45],
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 7, 0.6, 14, 3.5],
      },
    },
    {
      id: 'borders', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.25, 6, 0.45], 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 8, 1.4], 'line-dasharray': [3, 2] },
    },
    {
      id: 'country-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', maxzoom: 7,
      filter: ['==', ['get', 'class'], 'country'],
      layout: {
        'text-field': NAME as never, 'text-font': ['Noto Sans Bold'], 'text-transform': 'uppercase', 'text-letter-spacing': 0.18,
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 9, 5, 13], 'text-max-width': 8,
      },
      paint: { 'text-color': 'rgba(255,255,255,0.72)', 'text-halo-color': 'rgba(3,7,18,0.7)', 'text-halo-width': 1.2 },
    },
    {
      id: 'city-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', minzoom: 5,
      filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
      layout: {
        'text-field': NAME as never, 'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 14], 'text-max-width': 8,
        'symbol-sort-key': ['get', 'rank'],
      },
      paint: { 'text-color': '#f8fafc', 'text-halo-color': 'rgba(3,7,18,0.8)', 'text-halo-width': 1.4 },
    },
  ],
};

/** Zoom at which the whole globe comfortably fills a container of the given size. */
export function globeZoom(w: number, h: number) {
  // globe radius in px ≈ 512·2^z / 2π at the equator
  return Math.max(0.6, Math.log2((Math.min(w, h) * 0.4) / (512 / (2 * Math.PI))));
}
