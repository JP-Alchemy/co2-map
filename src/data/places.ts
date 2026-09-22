import type { Confidence, Place, PlaceKind } from '../types';
import coords from './coords.json';

const C = coords as unknown as Record<string, [number, number]>;

export const PLACES: Record<string, Place> = {};
function p(id: string, name: string, kind: PlaceKind, country: string, confidence: Confidence, note?: string) {
  const c = C[id];
  if (!c) throw new Error(`No coordinates for place ${id}`);
  PLACES[id] = { id, name, kind, country, coords: c, confidence, note };
}

// ---- Netherlands: growing regions, packers, importers, processors
p('westland', 'Westland greenhouses, Naaldwijk', 'greenhouse', 'NL', 'verified', 'Heated glasshouses; tomatoes and peppers are picked several times a week from March to November.');
p('pijnacker_geo', 'Geothermal greenhouse, Pijnacker', 'greenhouse', 'NL', 'verified', 'Greenhouses around Pijnacker heated with geothermal water from 2 km depth.');
p('bleiswijk', 'Bleiswijk greenhouse cluster', 'greenhouse', 'NL', 'verified');
p('harvest_house', 'Harvest House packing, Maasdijk', 'packhouse', 'NL', 'likely', 'Grower-owned sorting and packing site; produce is chilled to 10 °C within hours of picking.');
p('growers_united', 'Growers United, Maasdijk', 'cooperative', 'NL', 'verified');
p('the_greenery', 'The Greenery, Barendrecht', 'importer', 'NL', 'verified', 'Cooperative trading house for Dutch growers; also imports counter-season produce.');
p('natures_pride', "Nature's Pride, Maasdijk", 'ripening', 'NL', 'verified', 'Largest avocado and mango ripening centre in Europe; fruit is ripened to order for retailers.');
p('bakker_barendrecht', 'Bakker Barendrecht, Ridderkerk', 'importer', 'NL', 'likely', 'Dedicated fruit and vegetable supplier of Albert Heijn; sources from growers and importers and delivers to AH distribution centres.');
p('fruitmasters', 'FruitMasters, Geldermalsen', 'packhouse', 'NL', 'verified', 'Controlled-atmosphere cold stores (1 °C, low oxygen) keep apples crisp for up to nine months.');
p('betuwe', 'Betuwe orchards, Tiel', 'orchard', 'NL', 'verified');
p('veiling_zaltbommel', 'Veiling Zaltbommel', 'cooperative', 'NL', 'verified', 'Fruit and vegetable auction; strawberries are sold the morning after picking.');
p('zundert', 'Strawberry farms, Zundert', 'farm', 'NL', 'verified');
p('flevoland_farm', 'Arable farms, Dronten', 'farm', 'NL', 'verified', 'Potatoes are lifted in September and October and kept in ventilated barns on the farm.');
p('leo_de_kock', 'Leo de Kock, Purmerend', 'packhouse', 'NL', 'likely', 'Potatoes are washed, optically sorted and bagged.');
p('venlo_limburg', 'Blueberry plantations, Horst aan de Maas', 'farm', 'NL', 'verified');
p('fresh_park_venlo', 'Fresh Park Venlo', 'packhouse', 'NL', 'verified', 'Logistics park with cold stores and packers for fruit and vegetables.');
p('zeeland_beans', 'Bean fields, Goes', 'farm', 'NL', 'verified');
p('friesland_dairy', 'Dairy farms, Wommels', 'farm', 'NL', 'verified', 'Milk is cooled to 4 °C in the farm tank and collected every two days.');
p('aware_heerenveen', 'Royal A-ware dairy, Heerenveen', 'processor', 'NL', 'likely', 'Pasteurised, standardised and packed in cartons within a day of collection.');
p('fc_nijkerk', 'FrieslandCampina, Nijkerk', 'processor', 'NL', 'likely');
p('gelderse_vallei', 'Broiler farms, Lunteren', 'farm', 'NL', 'verified', 'Slower-growing breeds under the Dutch "Beter Leven" scheme reach slaughter weight in about 49 days.');
p('plukon_wezep', 'Plukon, Wezep', 'processor', 'NL', 'verified', 'Slaughter, cutting and retail packing under modified atmosphere.');
p('barneveld', 'Laying-hen farms, Barneveld', 'farm', 'NL', 'verified');
p('kwetters', 'Kwetters egg packing, Veen', 'packhouse', 'NL', 'likely', 'Eggs are candled, graded by weight and stamped with the farm code.');
p('urk', 'Fish processors, Urk', 'processor', 'NL', 'verified', 'Whole salmon is filleted, portioned and packed on ice or in vacuum.');
p('port_rotterdam', 'Port of Rotterdam, Maasvlakte', 'port', 'NL', 'verified', 'Reefer containers are plugged in on the terminal and inspected by customs and the NVWA.');
p('port_antwerp', 'Port of Antwerp', 'port', 'BE', 'verified');
p('port_vlissingen', 'Port of Vlissingen', 'port', 'NL', 'verified', 'Banana terminal with cold stores directly on the quay.');
p('chiquita_gorinchem', 'Banana ripening centre, Gorinchem', 'ripening', 'NL', 'likely', 'Green bananas are ripened with ethylene for 4 to 7 days to the colour stage the retailer orders.');
p('zespri_zeebrugge', 'Port of Zeebrugge', 'port', 'BE', 'verified', "Zespri's European hub; kiwifruit is discharged here and held in cold storage.");
p('ams', 'Schiphol Airport', 'airport', 'NL', 'verified', 'Perishables are cleared in a dedicated cool-chain terminal and trucked out the same day.');

// ---- Spain, Italy, Morocco
p('almeria', 'Greenhouses, El Ejido (Almería)', 'greenhouse', 'ES', 'verified', 'Unheated plastic greenhouses; winter production relies on sunlight only.');
p('unica', 'Unica Group packhouse, El Ejido', 'packhouse', 'ES', 'likely');
p('huelva', 'Strawberry farms, Lepe (Huelva)', 'farm', 'ES', 'verified');
p('palos', 'Fresón de Palos packhouse', 'packhouse', 'ES', 'likely', 'Strawberries are pre-cooled to 2 °C within two hours of picking.');
p('valencia_citrus', 'Citrus groves, Alzira (Valencia)', 'orchard', 'ES', 'verified');
p('anecoop', 'Anecoop packhouse, Valencia', 'packhouse', 'ES', 'likely');
p('malaga_avocado', 'Avocado orchards, Vélez-Málaga', 'orchard', 'ES', 'verified');
p('puglia_grapes', 'Vineyards, Noicattaro (Puglia)', 'orchard', 'IT', 'verified', 'Table grapes are packed in the field and pre-cooled the same day.');
p('latina_kiwi', 'Kiwi orchards, Latina (Lazio)', 'orchard', 'IT', 'verified');
p('agadir', 'Farms, Agadir (Souss-Massa)', 'farm', 'MA', 'verified');
p('tanger_med', 'Tanger Med port', 'port', 'MA', 'verified', 'Trucks board a ro-ro ferry for the 90-minute crossing to Spain.');
p('algeciras', 'Port of Algeciras', 'port', 'ES', 'verified');

// ---- Africa
p('naivasha', 'Bean farms, Naivasha', 'farm', 'KE', 'verified', 'Fine beans are picked by hand every two days and reach the packhouse within hours.');
p('nairobi_jkia', 'Nairobi Jomo Kenyatta Airport', 'airport', 'KE', 'verified', 'Loaded in the belly of overnight passenger flights or on freighters.');
p('muranga', "Avocado estates, Murang'a", 'orchard', 'KE', 'verified');
p('mombasa_port', 'Port of Mombasa', 'port', 'KE', 'verified');
p('hex_river', 'Vineyards, De Doorns (Hex River)', 'orchard', 'ZA', 'verified');
p('cape_town_port', 'Port of Cape Town', 'port', 'ZA', 'verified');
p('sundays_river', 'Citrus orchards, Kirkwood (Sundays River)', 'orchard', 'ZA', 'verified');
p('gqeberha_port', 'Port of Gqeberha (Port Elizabeth)', 'port', 'ZA', 'verified');

// ---- Americas
p('el_oro', 'Banana plantations, Machala (El Oro)', 'farm', 'EC', 'verified', 'Bunches are cut green, washed, and boxed on the plantation.');
p('guayaquil_port', 'Port of Guayaquil', 'port', 'EC', 'verified', 'Boxes are loaded into 40 ft reefer containers held at 13.3 °C.');
p('chincha', 'Avocado orchards, Chincha (Ica)', 'orchard', 'PE', 'verified');
p('callao_port', 'Port of Callao', 'port', 'PE', 'verified');
p('trujillo', 'Blueberry fields, Virú (La Libertad)', 'farm', 'PE', 'verified', 'Irrigated desert; berries are picked by hand and cooled within an hour.');
p('piura', 'Mango orchards, Tambogrande (Piura)', 'orchard', 'PE', 'verified');
p('paita_port', 'Port of Paita', 'port', 'PE', 'verified');
p('petrolina', 'Mango orchards, Petrolina', 'orchard', 'BR', 'verified');
p('suape_port', 'Port of Suape', 'port', 'BR', 'verified');
p('recife_airport', 'Recife Airport', 'airport', 'BR', 'verified');

// ---- Oceania, Norway
p('bay_of_plenty', 'Kiwifruit orchards, Te Puke', 'orchard', 'NZ', 'verified');
p('tauranga_port', 'Port of Tauranga', 'port', 'NZ', 'verified');
p('hawkes_bay', 'Apple orchards, Hastings (Hawke\'s Bay)', 'orchard', 'NZ', 'verified');
p('napier_port', 'Port of Napier', 'port', 'NZ', 'verified');
p('froya_norway', 'Salmon farms, Frøya', 'farm', 'NO', 'verified', 'Fish are pumped from the sea cage to the harvest plant, bled and packed in ice within hours.');

/** Sea and air waypoints [lon, lat] used to keep routes off land. */
export const W = {
  maasmond: [4.0, 51.98], dover: [1.6, 51.05], channel: [-5.5, 49.2], finisterre: [-10.5, 43.5],
  portugal: [-10.0, 38.5], gibraltar: [-5.6, 35.95], sardinia: [8.0, 37.8], sicily: [11.5, 37.3], crete: [24.0, 33.8],
  portSaid: [32.3, 31.4], suezS: [32.6, 29.9], redSeaN: [34.5, 26.5], redSea: [39.0, 18.0], babMandeb: [43.4, 12.6],
  aden: [51.5, 12.5], hornAfrica: [52.5, 8.0], indianOcean: [45.0, -2.0],
  goodHope: [17.5, -35.2], namibia: [8.0, -20.0], guinea: [-2.0, 3.5], liberia: [-12.0, 3.0], senegal: [-18.5, 12.0], canaries: [-19.0, 22.0],
  panamaAtl: [-79.92, 9.4], panamaPac: [-79.55, 8.9], anegada: [-63.5, 18.4], colombiaPac: [-80.5, 4.0], ecuadorPac: [-81.5, -3.0],
  brazilAtl: [-25.0, 15.0], pacificMid: [-140.0, -20.0],
} as const satisfies Record<string, readonly [number, number]>;

export const ATLANTIC_TO_ROTTERDAM: [number, number][] = [W.channel, W.dover, W.maasmond].map((x) => [...x] as [number, number]);
