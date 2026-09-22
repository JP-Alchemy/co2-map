import type { Producer } from '../types';

/**
 * Producers are real organisations or growing regions. Descriptions only state publicly
 * documented facts about what they grow and where. Whether a specific chain buys from a
 * specific producer is usually commercially confidential, so the link between a producer
 * and a route is `likely` or `extrapolated` unless the retailer states it publicly.
 */
export const PRODUCERS: Record<string, Producer> = {};
const add = (p: Producer) => { PRODUCERS[p.id] = p; };

// ---- Netherlands
add({ id: 'harvest_house', name: 'Harvest House', kind: 'cooperative', country: 'NL', region: 'Westland (ZH)', confidence: 'verified', url: 'https://www.harvesthouse.nl',
  description: 'Growers association of roughly 60 greenhouse companies in the Westland and surroundings, selling tomatoes, peppers and cucumbers to retailers across Europe.' });
add({ id: 'growers_united', name: 'Growers United', kind: 'cooperative', country: 'NL', region: 'Westland / Limburg', confidence: 'verified', url: 'https://www.growersunited.nl',
  description: 'Cooperative formed from Van Nature and ZON fruit & vegetables; markets greenhouse vegetables from members in the Westland, Bleiswijk and North Limburg.' });
add({ id: 'duijvestijn', name: 'Duijvestijn Tomaten', kind: 'grower', country: 'NL', region: 'Pijnacker (ZH)', confidence: 'verified', url: 'https://www.duijvestijntomaten.nl',
  description: 'Family tomato nursery near Pijnacker that heats its greenhouses with geothermal energy, giving one of the lowest footprints for a heated Dutch tomato.' });
add({ id: 'westland_growers', name: 'Westland greenhouse growers', kind: 'region', country: 'NL', region: 'Westland (ZH)', confidence: 'verified',
  description: 'The densest greenhouse cluster in the world: around 2,500 ha of glass between The Hague and Rotterdam, producing tomatoes, peppers, cucumbers and strawberries.' });
add({ id: 'zundert_growers', name: 'Brabant soft-fruit growers', kind: 'region', country: 'NL', region: 'Zundert / Breda (NB)', confidence: 'verified',
  description: 'Family farms around Zundert and Breda grow strawberries in tunnels and on gutters; many sell through the Veiling Zaltbommel auction or FruitMasters.' });
add({ id: 'fruitmasters', name: 'Royal FruitMasters', kind: 'cooperative', country: 'NL', region: 'Geldermalsen (GLD)', confidence: 'verified', url: 'https://www.fruitmasters.com',
  description: 'Cooperative of about 400 Dutch fruit growers, mainly in the Betuwe, with sorting, cold storage and packing in Geldermalsen. Largest supplier of Dutch Elstar apples.' });
add({ id: 'betuwe_growers', name: 'Betuwe apple growers', kind: 'region', country: 'NL', region: 'Betuwe (GLD)', confidence: 'verified',
  description: 'The river area between the Waal and the Rhine is the heart of Dutch pome fruit growing. Elstar is picked in September and stored under controlled atmosphere until early summer.' });
add({ id: 'flevoland_growers', name: 'Flevoland arable farmers', kind: 'region', country: 'NL', region: 'Flevopolder', confidence: 'verified',
  description: 'Reclaimed polder land with deep fertile clay; the province grows a large share of Dutch ware potatoes and onions on farms of 50 to 100 ha.' });
add({ id: 'leo_de_kock', name: 'Leo de Kock & Zn', kind: 'company', country: 'NL', region: 'Purmerend (NH)', confidence: 'likely', url: 'https://www.leodekock.nl',
  description: 'Potato washing and packing company in Purmerend that supplies pre-packed table potatoes to Dutch supermarkets.' });
add({ id: 'limburg_softfruit', name: 'Limburg blueberry growers', kind: 'region', country: 'NL', region: 'Noord-Limburg', confidence: 'verified',
  description: 'The sandy soils of North Limburg and eastern Brabant host most Dutch blueberry plantations, harvested from late June to September.' });
add({ id: 'zeeland_beans', name: 'Zeeland and Flevoland bean growers', kind: 'region', country: 'NL', region: 'Zeeland / Flevoland', confidence: 'verified',
  description: 'Open-field green beans are sown from May and machine-harvested from July to September for the fresh market and for freezing.' });
add({ id: 'friesland_dairy', name: 'Frisian dairy farmers', kind: 'region', country: 'NL', region: 'Friesland', confidence: 'verified',
  description: 'Family dairy farms averaging about 110 cows on grass and maize, delivering milk daily to cooperative and private dairies.' });
add({ id: 'aware', name: 'Royal A-ware', kind: 'company', country: 'NL', region: 'Heerenveen (FR)', confidence: 'likely', url: 'https://www.royal-aware.com',
  description: 'Family-owned dairy company that opened a fresh-milk plant in Heerenveen in 2018 to supply Dutch supermarkets with private-label milk.' });
add({ id: 'frieslandcampina', name: 'FrieslandCampina', kind: 'cooperative', country: 'NL', region: 'Nijkerk (GLD)', confidence: 'likely', url: 'https://www.frieslandcampina.com',
  description: 'Farmer-owned dairy cooperative of roughly 14,000 member farms. Its Nijkerk site packs fresh milk and dairy drinks for the Dutch market.' });
add({ id: 'gelderse_vallei_poultry', name: 'Gelderse Vallei poultry farmers', kind: 'region', country: 'NL', region: 'Gelderse Vallei', confidence: 'verified',
  description: 'The area around Barneveld, Ede and Lunteren is the traditional centre of Dutch poultry farming, with broiler houses of 20,000 to 60,000 birds.' });
add({ id: 'plukon', name: 'Plukon Food Group', kind: 'company', country: 'NL', region: 'Wezep (GLD)', confidence: 'likely', url: 'https://www.plukon.com',
  description: 'One of the largest poultry processors in Europe, headquartered in Wezep with Dutch plants in Wezep, Dedemsvaart, Goor and Blokker. Supplies chicken to Dutch retail.' });
add({ id: 'barneveld_eggs', name: 'Barneveld laying-hen farms', kind: 'region', country: 'NL', region: 'Barneveld (GLD)', confidence: 'verified',
  description: 'Free-range and barn laying-hen farms; the average Dutch layer farm keeps around 50,000 hens.' });
add({ id: 'kwetters', name: 'Kwetters Eieren', kind: 'company', country: 'NL', region: 'Veen (NB)', confidence: 'likely', url: 'https://www.kwetters.nl',
  description: 'Large Dutch egg packing station that grades and packs eggs from contracted farms for supermarkets.' });
add({ id: 'urk_fish', name: 'Urk fish processors', kind: 'region', country: 'NL', region: 'Urk (FL)', confidence: 'verified',
  description: 'Urk is the Dutch fish-processing capital; several plants fillet and portion Norwegian salmon for retail packs.' });

// ---- Spain, Italy, Morocco
add({ id: 'unica', name: 'Unica Group', kind: 'cooperative', country: 'ES', region: 'Almería', confidence: 'verified', url: 'https://www.unicagroup.es',
  description: 'Second-tier cooperative of Almería growers selling vegetables from the "sea of plastic", the 30,000 ha of unheated greenhouses around El Ejido.' });
add({ id: 'almeria_growers', name: 'Almería greenhouse growers', kind: 'region', country: 'ES', region: 'Poniente Almeriense', confidence: 'verified',
  description: 'Family-run unheated plastic greenhouses of 1 to 3 ha, supplying Europe with winter tomatoes, peppers and cucumbers.' });
add({ id: 'freson_de_palos', name: 'Fresón de Palos', kind: 'cooperative', country: 'ES', region: 'Palos de la Frontera, Huelva', confidence: 'verified', url: 'https://www.fresondepalos.es',
  description: 'Large strawberry cooperative in Huelva, the region that grows most of Europe\'s winter and spring strawberries under plastic tunnels.' });
add({ id: 'anecoop', name: 'Anecoop', kind: 'cooperative', country: 'ES', region: 'Valencia', confidence: 'verified', url: 'https://www.anecoop.com',
  description: 'Spain\'s largest fruit and vegetable cooperative group, marketing citrus from Valencian growers.' });
add({ id: 'trops', name: 'Trops', kind: 'cooperative', country: 'ES', region: 'Vélez-Málaga', confidence: 'verified', url: 'https://www.trops.es',
  description: 'Cooperative of avocado and mango growers on the Axarquía coast of Málaga, the main avocado region of mainland Europe.' });
add({ id: 'puglia_grapes', name: 'Puglia table-grape growers', kind: 'region', country: 'IT', region: 'Bari province, Puglia', confidence: 'verified',
  description: 'Italy grows most of Europe\'s table grapes; the belt around Noicattaro and Rutigliano is harvested from July to November.' });
add({ id: 'latina_kiwi', name: 'Kiwi Latina growers', kind: 'region', country: 'IT', region: 'Agro Pontino, Lazio', confidence: 'verified',
  description: 'The Latina plain south of Rome holds Europe\'s largest kiwifruit area; the fruit carries the "Kiwi Latina" protected geographical indication.' });
add({ id: 'souss_growers', name: 'Souss-Massa vegetable growers', kind: 'region', country: 'MA', region: 'Agadir', confidence: 'verified',
  description: 'Irrigated farms and greenhouses around Agadir grow green beans and tomatoes for Europe from November to May.' });

// ---- Africa
add({ id: 'vegpro', name: 'Vegpro Kenya', kind: 'company', country: 'KE', region: 'Naivasha', confidence: 'verified',
  description: 'Large Kenyan grower and packer of fine beans and prepared vegetables, farming around Naivasha and contracting smallholders.' });
add({ id: 'kenya_smallholders', name: 'Kenyan smallholder bean farmers', kind: 'region', country: 'KE', region: 'Central and Rift Valley', confidence: 'verified',
  description: 'Tens of thousands of smallholders on plots under 1 ha grow fine beans under contract for exporters, picked by hand.' });
add({ id: 'kakuzi', name: 'Kakuzi PLC', kind: 'company', country: 'KE', region: 'Murang\'a County', confidence: 'verified', url: 'https://www.kakuzi.co.ke',
  description: 'Listed agricultural company growing Hass avocados on its estate near Makuyu and buying from surrounding smallholders.' });
add({ id: 'hex_river', name: 'Hex River Valley grape growers', kind: 'region', country: 'ZA', region: 'Western Cape', confidence: 'verified',
  description: 'South Africa\'s largest table-grape district, harvested from December to April, packed on-farm and trucked to Cape Town.' });
add({ id: 'srcc', name: 'Sundays River Citrus Company', kind: 'company', country: 'ZA', region: 'Kirkwood, Eastern Cape', confidence: 'verified', url: 'https://www.srcc.co.za',
  description: 'Grower-owned citrus packer and exporter in the Sundays River Valley, the biggest citrus-producing region in South Africa.' });

// ---- Americas
add({ id: 'asoguabo', name: 'AsoGuabo', kind: 'cooperative', country: 'EC', region: 'El Guabo, El Oro', confidence: 'verified', url: 'https://www.asoguabo.com.ec',
  description: 'Association of small banana producers in El Oro province, one of the first Fairtrade-certified banana cooperatives, exporting mainly to Europe.' });
add({ id: 'el_oro_growers', name: 'El Oro banana plantations', kind: 'region', country: 'EC', region: 'El Oro / Los Ríos', confidence: 'verified',
  description: 'Ecuador is the world\'s largest banana exporter; plantations range from 5 ha family plots to 500 ha estates shipping from Guayaquil and Puerto Bolívar.' });
add({ id: 'camposol', name: 'Camposol', kind: 'company', country: 'PE', region: 'Virú, La Libertad', confidence: 'verified', url: 'https://www.camposol.com.pe',
  description: 'Peru\'s largest agro-exporter, growing blueberries and avocados on irrigated desert land in the Chavimochic scheme.' });
add({ id: 'peru_hass', name: 'Peruvian Hass avocado growers', kind: 'region', country: 'PE', region: 'Ica / La Libertad', confidence: 'verified',
  description: 'Irrigated coastal desert orchards; Peru is the second-largest avocado exporter and supplies Europe from May to September.' });
add({ id: 'piura_mango', name: 'Piura mango growers', kind: 'region', country: 'PE', region: 'Tambogrande, Piura', confidence: 'verified',
  description: 'Kent mangoes from the San Lorenzo valley, harvested December to March and shipped from Paita.' });
add({ id: 'petrolina_mango', name: 'São Francisco valley mango growers', kind: 'region', country: 'BR', region: 'Petrolina / Juazeiro', confidence: 'verified',
  description: 'Irrigated fruit district on the São Francisco river producing mangoes almost year-round, with a peak from September to December.' });

// ---- Oceania, Norway
add({ id: 'zespri', name: 'Zespri growers', kind: 'cooperative', country: 'NZ', region: 'Bay of Plenty', confidence: 'verified', url: 'https://www.zespri.com',
  description: 'Grower-owned marketer for about 2,800 New Zealand kiwifruit orchards, most of them around Te Puke, shipping to Europe via Zeebrugge.' });
add({ id: 'hawkes_bay_apples', name: 'Hawke\'s Bay apple growers', kind: 'region', country: 'NZ', region: 'Hawke\'s Bay', confidence: 'verified',
  description: 'New Zealand\'s main apple district, harvested February to April and exported through the port of Napier.' });
add({ id: 'salmar', name: 'SalMar', kind: 'company', country: 'NO', region: 'Frøya, Trøndelag', confidence: 'verified', url: 'https://www.salmar.no',
  description: 'One of the world\'s largest farmed-salmon producers, headquartered on the island of Frøya with sea cages along the mid-Norwegian coast.' });
add({ id: 'norway_salmon', name: 'Mid-Norway salmon farms', kind: 'region', country: 'NO', region: 'Trøndelag coast', confidence: 'verified',
  description: 'Atlantic salmon grown 14 to 18 months in sea cages, harvested at 4 to 5 kg and trucked fresh to the continent within 24 hours.' });
