import type { LegStep, NodeRole, NodeStep, Product, StorageType, SupplyRoute, TransportMode } from '../types';
import { W } from './places';

const n = (placeId: string, role: NodeRole, days: number, storage: StorageType, note?: string): NodeStep => ({ kind: 'node', placeId, role, days, storage, note });
const l = (mode: TransportMode, extra: Omit<LegStep, 'kind' | 'mode'> = {}): LegStep => ({ kind: 'leg', mode, ...extra });
const wp = (...pts: (readonly [number, number])[]): [number, number][] => pts.map((x) => [x[0], x[1]]);

// Sea lanes (lists of waypoints that keep the drawn route off land)
const SEA = {
  atlanticToRotterdam: wp(W.channel, W.dover, W.maasmond),
  atlanticToVlissingen: wp(W.channel, W.dover, [3.35, 51.44]),
  atlanticToZeebrugge: wp(W.channel, W.dover, [3.1, 51.4]),
  fromPanama: wp(W.panamaPac, W.panamaAtl, W.anegada),
  fromPeru: wp(W.ecuadorPac, W.colombiaPac, W.panamaPac, W.panamaAtl, W.anegada),
  fromGuayaquil: wp([-81.2, -2.0], W.colombiaPac, W.panamaPac, W.panamaAtl, W.anegada),
  fromCape: wp(W.goodHope, W.namibia, W.guinea, W.liberia, W.senegal, W.canaries, W.finisterre),
  fromMombasaViaSuez: wp(W.indianOcean, W.hornAfrica, W.aden, W.babMandeb, W.redSea, W.redSeaN, W.suezS, W.portSaid, W.crete, W.sicily, W.sardinia, W.gibraltar, W.portugal, W.finisterre),
  fromNZ: wp(W.pacificMid, W.panamaPac, W.panamaAtl, W.anegada),
  fromBrazil: wp(W.brazilAtl, W.finisterre),
};

const P = {
  poore: 'Poore & Nemecek 2018 (global LCA meta-analysis)',
  blonk: 'Blonk / RIVM Dutch food LCA database',
  wur: 'WUR Energiemonitor Glastuinbouw (NL greenhouse energy)',
  lit: 'Peer-reviewed LCA studies for this origin (range midpoint)',
};

/** Shorthand to declare a route */
function route(r: Omit<SupplyRoute, 'production'> & { co2e: number; method: string; source: string; conf?: 'verified' | 'likely' | 'extrapolated' }): SupplyRoute {
  const { co2e, method, source, conf, ...rest } = r;
  return { ...rest, production: { co2ePerKg: co2e, method, source, confidence: conf ?? 'extrapolated' } };
}

export const PRODUCTS: Product[] = [
  // -------------------------------------------------------------- TOMATO
  {
    id: 'tomato', name: 'Vine tomatoes', category: 'vegetable', emoji: '🍅',
    pack: { label: '500 g vine tomatoes', kg: 0.5 }, shelfPriceEur: 1.99,
    description: 'The Netherlands grows around 900,000 tonnes of tomatoes a year in heated glasshouses, most of them for export. In winter, Dutch supermarkets switch part of their volume to unheated Spanish greenhouses.',
    routes: [
      route({ id: 'tomato_nl', label: 'Dutch glasshouse, Westland', origin: { country: 'NL', region: 'Westland' }, season: { from: 3, to: 11 }, share: 0.85,
        producerIds: ['westland_growers', 'harvest_house', 'duijvestijn'],
        co2e: 1.6, method: 'Heated glasshouse with gas CHP and part geothermal; 55 kg/m²/yr yield', source: P.wur, conf: 'likely',
        farmGateEurPerKg: 0.95, packingEurPerKg: 0.15,
        steps: [
          n('westland', 'origin', 0, 'ambient', 'Picked on the vine at colour stage 6; placed in crates on the greenhouse path.'),
          l('truck'),
          n('harvest_house', 'packing', 1, 'chilled', 'Graded by camera, packed in 500 g flowpacks, chilled to 12 °C.'),
        ],
        notes: ['Heating is by far the largest source of emissions; a geothermal-heated nursery is at roughly 0.7 kg CO2e/kg, a gas-heated one at 2 or above.'] }),
      route({ id: 'tomato_es', label: 'Spanish greenhouse, Almería (winter)', origin: { country: 'ES', region: 'Almería' }, season: { from: 11, to: 3 }, share: 0.6,
        producerIds: ['almeria_growers', 'unica'],
        co2e: 0.45, method: 'Unheated plastic greenhouse, drip irrigation from aquifer', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 0.65, packingEurPerKg: 0.15,
        steps: [
          n('almeria', 'origin', 0, 'ambient'),
          l('truck'),
          n('unica', 'packing', 1, 'chilled', 'Graded and packed for the Dutch customer; loaded overnight.'),
        ],
        notes: ['Even with a 2,300 km truck journey the winter Spanish tomato has a lower footprint than a gas-heated Dutch one in the same month.'] }),
    ],
  },
  // -------------------------------------------------------------- BELL PEPPER
  {
    id: 'pepper', name: 'Bell peppers', category: 'vegetable', emoji: '🫑',
    pack: { label: '3 mixed peppers (450 g)', kg: 0.45 }, shelfPriceEur: 2.49,
    description: 'Red, yellow and orange peppers take about three months from planting to first harvest. The Netherlands is the largest exporter in Europe; Spain and Israel fill the winter gap.',
    routes: [
      route({ id: 'pepper_nl', label: 'Dutch glasshouse, Westland and Bleiswijk', origin: { country: 'NL', region: 'Westland' }, season: { from: 3, to: 11 }, share: 0.9,
        producerIds: ['westland_growers', 'harvest_house', 'growers_united'],
        co2e: 2.1, method: 'Heated glasshouse, gas CHP; 30 kg/m²/yr yield', source: P.wur, conf: 'likely',
        farmGateEurPerKg: 1.45, packingEurPerKg: 0.18,
        steps: [n('westland', 'origin', 0, 'ambient'), l('truck'), n('harvest_house', 'packing', 1, 'chilled', 'Sorted by colour and size, packed in trays of three.')] }),
      route({ id: 'pepper_es', label: 'Spanish greenhouse, Almería (winter)', origin: { country: 'ES', region: 'Almería' }, season: { from: 11, to: 3 }, share: 0.7,
        producerIds: ['almeria_growers', 'unica'],
        co2e: 0.5, method: 'Unheated plastic greenhouse', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 0.85, packingEurPerKg: 0.18,
        steps: [n('almeria', 'origin', 0, 'ambient'), l('truck'), n('unica', 'packing', 1, 'chilled')] }),
    ],
  },
  // -------------------------------------------------------------- STRAWBERRY
  {
    id: 'strawberry', name: 'Strawberries', category: 'fruit', emoji: '🍓',
    pack: { label: '400 g punnet', kg: 0.4 }, shelfPriceEur: 3.49,
    description: 'A fragile fruit sold within three days of picking. Dutch growers use tunnels and glass from April to October; from January the shelf is filled from Huelva in south-west Spain.',
    routes: [
      route({ id: 'strawberry_nl', label: 'Dutch tunnels and glass, Brabant', origin: { country: 'NL', region: 'Zundert / Breda' }, season: { from: 4, to: 10 }, share: 0.8,
        producerIds: ['zundert_growers', 'fruitmasters'],
        co2e: 0.9, method: 'Substrate culture in tunnels, part heated glass early season', source: P.blonk, conf: 'likely',
        farmGateEurPerKg: 3.6, packingEurPerKg: 0.25,
        steps: [
          n('zundert', 'origin', 0, 'ambient', 'Picked by hand straight into the punnet, early in the morning.'),
          l('reefer_truck'),
          n('veiling_zaltbommel', 'packing', 1, 'chilled', 'Cooled to 2 °C and sold by clock auction or fixed contract the next morning.'),
        ] }),
      route({ id: 'strawberry_es', label: 'Spanish tunnels, Huelva (winter and spring)', origin: { country: 'ES', region: 'Huelva' }, season: { from: 1, to: 5 }, share: 0.85,
        producerIds: ['freson_de_palos'],
        co2e: 0.6, method: 'Plastic tunnels, drip irrigation; includes plastic and water pumping', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 2.1, packingEurPerKg: 0.25,
        steps: [n('huelva', 'origin', 0, 'ambient'), l('truck'), n('palos', 'packing', 1, 'chilled', 'Pre-cooled to 2 °C within two hours; loaded the same evening.')],
        notes: ['Huelva strawberries reach the Netherlands in about 48 hours by refrigerated truck.', 'Water use in Doñana is a bigger local concern than the carbon footprint.'] }),
    ],
  },
  // -------------------------------------------------------------- APPLE
  {
    id: 'apple', name: 'Elstar apples', category: 'fruit', emoji: '🍎',
    pack: { label: '1 kg bag', kg: 1 }, shelfPriceEur: 2.49,
    description: 'Elstar, bred in Wageningen in the 1950s, is the Dutch national apple. Harvested in September and held in low-oxygen cold stores, it covers the shelf until early summer; then southern-hemisphere fruit takes over.',
    routes: [
      route({ id: 'apple_nl', label: 'Betuwe orchards, stored', origin: { country: 'NL', region: 'Betuwe' }, season: { from: 9, to: 6 }, share: 0.9,
        producerIds: ['betuwe_growers', 'fruitmasters'],
        co2e: 0.25, method: 'Orchard, incl. fertiliser, machinery and 1 % losses', source: P.poore, conf: 'likely',
        farmGateEurPerKg: 0.6, packingEurPerKg: 0.12,
        steps: [
          n('betuwe', 'origin', 0, 'ambient', 'Picked by hand in September into 300 kg bins.'),
          l('truck'),
          n('fruitmasters', 'packing', 120, 'chilled', 'Held in controlled-atmosphere cells at 1 °C and 1 % oxygen. Average storage time over the season is about four months.'),
        ],
        notes: ['Long cold storage adds emissions; by May a stored Dutch apple and a fresh New Zealand apple are surprisingly close.'] }),
      route({ id: 'apple_nz', label: "New Zealand, Hawke's Bay (counter-season)", origin: { country: 'NZ', region: "Hawke's Bay" }, season: { from: 5, to: 9 }, share: 0.4,
        producerIds: ['hawkes_bay_apples'],
        co2e: 0.3, method: 'Orchard', source: P.poore, conf: 'likely',
        farmGateEurPerKg: 0.8, packingEurPerKg: 0.15,
        steps: [
          n('hawkes_bay', 'origin', 0, 'ambient', 'Harvested February to April, packed and pre-cooled on site.'),
          l('truck'),
          n('napier_port', 'port', 2, 'chilled'),
          l('reefer_ship', { waypoints: [[178.5, -39.0], ...SEA.fromNZ, ...SEA.atlanticToRotterdam], hours: 24 * 38 }),
          n('port_rotterdam', 'port', 1, 'chilled'),
          l('reefer_truck'),
          n('the_greenery', 'import', 3, 'chilled', 'Repacked into 1 kg bags for the Dutch retailer.'),
        ] }),
    ],
  },
  // -------------------------------------------------------------- POTATO
  {
    id: 'potato', name: 'Potatoes', category: 'vegetable', emoji: '🥔',
    pack: { label: '2.5 kg bag', kg: 2.5 }, shelfPriceEur: 2.99,
    description: 'The most local product on this map. Ware potatoes from the Flevopolder are stored on the farm and delivered to the packer through the year.',
    routes: [
      route({ id: 'potato_nl', label: 'Flevopolder, farm-stored', origin: { country: 'NL', region: 'Flevoland' }, season: { from: 1, to: 12 }, share: 1,
        producerIds: ['flevoland_growers', 'leo_de_kock'],
        co2e: 0.2, method: 'Arable crop incl. fertiliser, machinery and farm storage ventilation', source: P.blonk, conf: 'likely',
        farmGateEurPerKg: 0.24, packingEurPerKg: 0.08,
        steps: [
          n('flevoland_farm', 'origin', 60, 'ambient', 'Lifted in autumn and kept in a ventilated barn at 5 °C; average storage before delivery is two months.'),
          l('truck'),
          n('leo_de_kock', 'packing', 1, 'ambient', 'Washed, optically sorted and packed in 2.5 kg bags.'),
        ] }),
    ],
  },
  // -------------------------------------------------------------- BANANA
  {
    id: 'banana', name: 'Bananas', category: 'fruit', emoji: '🍌',
    pack: { label: '1 kg (about 6 bananas)', kg: 1 }, shelfPriceEur: 1.79,
    description: 'The best-selling fruit in the Netherlands and one of the cheapest, despite travelling 10,000 km. Bananas are cut green, shipped at 13 °C, and ripened with ethylene near the port.',
    routes: [
      route({ id: 'banana_ec', label: 'Ecuador, El Oro province', origin: { country: 'EC', region: 'El Oro' }, season: { from: 1, to: 12 }, share: 0.6,
        producerIds: ['el_oro_growers', 'asoguabo'],
        co2e: 0.5, method: 'Plantation incl. fertiliser, fungicide spraying by air, packing plastics', source: P.poore, conf: 'likely',
        farmGateEurPerKg: 0.42, packingEurPerKg: 0.1,
        steps: [
          n('el_oro', 'origin', 0, 'ambient', 'Cut green, washed, and packed in 18 kg boxes at the plantation packing shed.'),
          l('truck'),
          n('guayaquil_port', 'port', 1, 'chilled', 'Loaded into reefer containers held at 13.3 °C.'),
          l('reefer_ship', { waypoints: [...SEA.fromGuayaquil, ...SEA.atlanticToVlissingen], hours: 24 * 14 }),
          n('port_vlissingen', 'port', 1, 'chilled'),
          l('reefer_truck'),
          n('chiquita_gorinchem', 'ripening', 5, 'ripening', 'Ripened with ethylene at 16 to 18 °C; the retailer orders a colour stage.'),
        ],
        notes: ['Sea freight dominates the distance but not the footprint: growing and ripening together emit more than the ship.'] }),
    ],
  },
  // -------------------------------------------------------------- AVOCADO
  {
    id: 'avocado', name: 'Hass avocados', category: 'fruit', emoji: '🥑',
    pack: { label: '1 ready-to-eat avocado (200 g)', kg: 0.2 }, shelfPriceEur: 1.29,
    description: 'Dutch avocado imports tripled in ten years. Fruit is picked hard and unripe, shipped for two to three weeks, and ripened to order in the Westland. Origin rotates through the year.',
    routes: [
      route({ id: 'avocado_pe', label: 'Peru, coastal desert (May to September)', origin: { country: 'PE', region: 'Ica / La Libertad' }, season: { from: 5, to: 9 }, share: 0.7,
        producerIds: ['peru_hass', 'camposol'],
        co2e: 1.3, method: 'Irrigated orchard, incl. pumping and fertiliser', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 1.25, packingEurPerKg: 0.2,
        steps: [
          n('chincha', 'origin', 0, 'ambient', 'Picked by hand at 23 % dry matter.'),
          l('truck'),
          n('callao_port', 'port', 2, 'chilled', 'Packed in 4 kg boxes, pre-cooled to 5 °C, loaded in reefer containers.'),
          l('reefer_ship', { waypoints: [...SEA.fromPeru, ...SEA.atlanticToRotterdam], hours: 24 * 20 }),
          n('port_rotterdam', 'port', 1, 'chilled'),
          l('reefer_truck'),
          n('natures_pride', 'ripening', 5, 'ripening', 'Ripened in rooms at 18 °C for 4 to 6 days, then sorted by firmness.'),
        ] }),
      route({ id: 'avocado_es', label: 'Spain, Málaga coast (November to April)', origin: { country: 'ES', region: 'Axarquía, Málaga' }, season: { from: 11, to: 4 }, share: 0.35,
        producerIds: ['trops'],
        co2e: 1.0, method: 'Irrigated orchard', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 2.3, packingEurPerKg: 0.2,
        steps: [n('malaga_avocado', 'origin', 1, 'chilled', 'Picked and packed by the Trops cooperative.'), l('reefer_truck'), n('natures_pride', 'ripening', 4, 'ripening')],
        notes: ['The closest origin to the Netherlands, but the smallest volume; Spanish fruit is often sold at a premium.'] }),
      route({ id: 'avocado_ke', label: 'Kenya, Murang\'a (March to September)', origin: { country: 'KE', region: "Murang'a County" }, season: { from: 3, to: 9 }, share: 0.25,
        producerIds: ['kakuzi'],
        co2e: 0.9, method: 'Rain-fed orchard, low input', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 0.95, packingEurPerKg: 0.2,
        steps: [
          n('muranga', 'origin', 0, 'ambient'),
          l('truck'),
          n('mombasa_port', 'port', 2, 'chilled'),
          l('reefer_ship', { waypoints: [...SEA.fromMombasaViaSuez, ...SEA.atlanticToRotterdam], hours: 24 * 28, note: 'Via the Suez Canal. Since 2024 many sailings divert around the Cape of Good Hope, adding about ten days.' }),
          n('port_rotterdam', 'port', 1, 'chilled'),
          l('reefer_truck'),
          n('natures_pride', 'ripening', 5, 'ripening'),
        ] }),
    ],
  },
  // -------------------------------------------------------------- BLUEBERRY
  {
    id: 'blueberry', name: 'Blueberries', category: 'fruit', emoji: '🫐',
    pack: { label: '125 g punnet', kg: 0.125 }, shelfPriceEur: 2.29,
    description: 'A year-round shelf built from a relay of origins. Peru dominates from August to December, Dutch and Polish fruit covers high summer, Chile, Morocco and Spain fill the gaps.',
    routes: [
      route({ id: 'blueberry_pe', label: 'Peru, La Libertad (sea freight)', origin: { country: 'PE', region: 'La Libertad' }, season: { from: 8, to: 12 }, share: 0.8,
        producerIds: ['camposol'],
        co2e: 1.2, method: 'Irrigated substrate/soil culture in desert, incl. pumping', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 4.2, packingEurPerKg: 0.6,
        steps: [
          n('trujillo', 'origin', 0, 'ambient', 'Hand-picked directly into punnets, cooled within an hour.'),
          l('reefer_truck'),
          n('paita_port', 'port', 1, 'chilled', 'Shipped in controlled-atmosphere containers at 0 °C.'),
          l('reefer_ship', { waypoints: [...SEA.fromPeru, ...SEA.atlanticToRotterdam], hours: 24 * 18 }),
          n('port_rotterdam', 'port', 1, 'chilled'),
          l('reefer_truck'),
          n('the_greenery', 'import', 2, 'chilled', 'Quality check and relabelling.'),
        ],
        notes: ['A decade ago most Peruvian berries flew; today more than 90 % go by sea in controlled-atmosphere containers, cutting the transport footprint by about 95 %.'] }),
      route({ id: 'blueberry_nl', label: 'Dutch plantations, North Limburg (summer)', origin: { country: 'NL', region: 'Noord-Limburg' }, season: { from: 6, to: 9 }, share: 0.5,
        producerIds: ['limburg_softfruit', 'fruitmasters'],
        co2e: 0.9, method: 'Open-field bushes on acid sandy soil, hand-picked', source: P.blonk, conf: 'likely',
        farmGateEurPerKg: 6.5, packingEurPerKg: 0.6,
        steps: [n('venlo_limburg', 'origin', 0, 'ambient'), l('reefer_truck'), n('fresh_park_venlo', 'packing', 1, 'chilled')] }),
    ],
  },
  // -------------------------------------------------------------- MANGO
  {
    id: 'mango', name: 'Mangoes', category: 'fruit', emoji: '🥭',
    pack: { label: '1 ready-to-eat mango (400 g)', kg: 0.4 }, shelfPriceEur: 1.79,
    description: 'Most mangoes in Dutch stores arrive by sea from Peru and Brazil and are ripened in the Netherlands. A small share of "tree-ripened" fruit is flown in and costs many times more in emissions.',
    routes: [
      route({ id: 'mango_pe', label: 'Peru, Piura (sea freight, winter)', origin: { country: 'PE', region: 'Piura' }, season: { from: 12, to: 3 }, share: 0.7,
        producerIds: ['piura_mango'],
        co2e: 0.7, method: 'Irrigated orchard', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 0.65, packingEurPerKg: 0.2,
        steps: [
          n('piura', 'origin', 0, 'ambient', 'Kent mangoes picked mature-green, hot-water treated against fruit fly.'),
          l('truck'),
          n('paita_port', 'port', 1, 'chilled'),
          l('reefer_ship', { waypoints: [...SEA.fromPeru, ...SEA.atlanticToRotterdam], hours: 24 * 18 }),
          n('port_rotterdam', 'port', 1, 'chilled'),
          l('reefer_truck'),
          n('natures_pride', 'ripening', 4, 'ripening'),
        ] }),
      route({ id: 'mango_br_sea', label: 'Brazil, Petrolina (sea freight, autumn)', origin: { country: 'BR', region: 'Petrolina / Juazeiro' }, season: { from: 9, to: 12 }, share: 0.6,
        producerIds: ['petrolina_mango'],
        co2e: 0.7, method: 'Irrigated orchard, flowering induced with growth regulators', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 0.6, packingEurPerKg: 0.2,
        steps: [
          n('petrolina', 'origin', 0, 'ambient'),
          l('truck'),
          n('suape_port', 'port', 1, 'chilled'),
          l('reefer_ship', { waypoints: [...SEA.fromBrazil, ...SEA.atlanticToRotterdam], hours: 24 * 14 }),
          n('port_rotterdam', 'port', 1, 'chilled'),
          l('reefer_truck'),
          n('natures_pride', 'ripening', 4, 'ripening'),
        ] }),
      route({ id: 'mango_br_air', label: 'Brazil, Petrolina (air freight, "tree-ripened")', origin: { country: 'BR', region: 'Petrolina / Juazeiro' }, season: { from: 9, to: 12 }, share: 0.08,
        producerIds: ['petrolina_mango'], shelfPriceEur: 2.99,
        co2e: 0.7, method: 'Irrigated orchard', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 1.2, packingEurPerKg: 0.3,
        steps: [
          n('petrolina', 'origin', 0, 'ambient', 'Picked riper than sea-freight fruit, which is why it must fly.'),
          l('truck'),
          n('recife_airport', 'airport', 1, 'chilled'),
          l('air', { hours: 14 }),
          n('ams', 'airport', 1, 'chilled'),
          l('reefer_truck'),
          n('natures_pride', 'import', 1, 'chilled'),
        ],
        notes: ['Compare with the sea-freight route: same orchard, roughly 15 times the transport emissions.'] }),
    ],
  },
  // -------------------------------------------------------------- GREEN BEANS
  {
    id: 'beans', name: 'Fine green beans', category: 'vegetable', emoji: '🫛',
    pack: { label: '400 g bag', kg: 0.4 }, shelfPriceEur: 2.29,
    description: 'Fine beans are the classic example of air-freighted vegetables. Kenyan beans fly overnight to Schiphol; Moroccan and Egyptian beans come by truck; Dutch field beans cover the summer.',
    routes: [
      route({ id: 'beans_ke', label: 'Kenya, Naivasha (air freight)', origin: { country: 'KE', region: 'Naivasha' }, season: { from: 10, to: 5 }, share: 0.5,
        producerIds: ['vegpro', 'kenya_smallholders'],
        co2e: 0.5, method: 'Irrigated field crop, hand-picked, low mechanisation', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 1.05, packingEurPerKg: 0.45,
        steps: [
          n('naivasha', 'origin', 0, 'ambient', 'Picked by hand, topped and tailed, and bagged in the packhouse next to the field.'),
          l('reefer_truck'),
          n('nairobi_jkia', 'airport', 0.5, 'chilled'),
          l('air', { hours: 9 }),
          n('ams', 'airport', 0.5, 'chilled'),
        ],
        notes: ['Air freight makes up more than 80 % of this bean\'s footprint.', 'Kenyan growers point out that their low-input farming and the jobs it creates are part of the picture too.'] }),
      route({ id: 'beans_ma', label: 'Morocco, Agadir (truck and ferry)', origin: { country: 'MA', region: 'Souss-Massa' }, season: { from: 11, to: 5 }, share: 0.4,
        producerIds: ['souss_growers'],
        co2e: 0.45, method: 'Irrigated field and greenhouse crop', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 1.15, packingEurPerKg: 0.35,
        steps: [
          n('agadir', 'origin', 1, 'chilled'),
          l('reefer_truck'),
          n('tanger_med', 'port', 0.3, 'chilled'),
          l('ferry', { hours: 2 }),
          n('algeciras', 'port', 0.2, 'chilled', 'EU customs and phytosanitary check.'),
          l('reefer_truck'),
          n('the_greenery', 'import', 1, 'chilled'),
        ] }),
      route({ id: 'beans_nl', label: 'Dutch open field, Zeeland (summer)', origin: { country: 'NL', region: 'Zeeland' }, season: { from: 7, to: 9 }, share: 0.7,
        producerIds: ['zeeland_beans'],
        co2e: 0.35, method: 'Open-field crop, machine-harvested', source: P.blonk, conf: 'likely',
        farmGateEurPerKg: 1.5, packingEurPerKg: 0.3,
        steps: [n('zeeland_beans', 'origin', 0, 'ambient'), l('reefer_truck'), n('the_greenery', 'packing', 1, 'chilled')] }),
    ],
  },
  // -------------------------------------------------------------- ORANGE
  {
    id: 'orange', name: 'Oranges', category: 'fruit', emoji: '🍊',
    pack: { label: '2 kg net', kg: 2 }, shelfPriceEur: 3.99,
    description: 'Spain supplies Europe from November to May; from June South African fruit arrives by sea and fills the shelf through the summer.',
    routes: [
      route({ id: 'orange_es', label: 'Spain, Valencia (winter)', origin: { country: 'ES', region: 'Valencia' }, season: { from: 11, to: 5 }, share: 0.9,
        producerIds: ['anecoop'],
        co2e: 0.3, method: 'Irrigated orchard', source: P.poore, conf: 'likely',
        farmGateEurPerKg: 0.38, packingEurPerKg: 0.12,
        steps: [n('valencia_citrus', 'origin', 0, 'ambient'), l('truck'), n('anecoop', 'packing', 2, 'chilled', 'Washed, waxed and packed in 2 kg nets.')] }),
      route({ id: 'orange_za', label: 'South Africa, Sundays River Valley (summer)', origin: { country: 'ZA', region: 'Eastern Cape' }, season: { from: 6, to: 10 }, share: 0.8,
        producerIds: ['srcc'],
        co2e: 0.35, method: 'Irrigated orchard', source: P.poore, conf: 'likely',
        farmGateEurPerKg: 0.5, packingEurPerKg: 0.15,
        steps: [
          n('sundays_river', 'origin', 0, 'ambient'),
          l('truck'),
          n('gqeberha_port', 'port', 2, 'chilled', 'Cold-sterilised at 0.5 °C for 22 days during the voyage against false codling moth.'),
          l('reefer_ship', { waypoints: [[23.0, -35.3], ...SEA.fromCape, ...SEA.atlanticToRotterdam], hours: 24 * 21 }),
          n('port_rotterdam', 'port', 1, 'chilled'),
          l('reefer_truck'),
          n('the_greenery', 'import', 2, 'chilled'),
        ] }),
    ],
  },
  // -------------------------------------------------------------- GRAPES
  {
    id: 'grapes', name: 'Seedless grapes', category: 'fruit', emoji: '🍇',
    pack: { label: '500 g punnet', kg: 0.5 }, shelfPriceEur: 2.99,
    description: 'Table grapes come from Italy and Greece in late summer and autumn, then from South Africa from December to April, with Chile, India and Egypt in between.',
    routes: [
      route({ id: 'grapes_it', label: 'Italy, Puglia (late summer)', origin: { country: 'IT', region: 'Puglia' }, season: { from: 7, to: 11 }, share: 0.7,
        producerIds: ['puglia_grapes'],
        co2e: 0.4, method: 'Vineyard under plastic cover', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 1.25, packingEurPerKg: 0.25,
        steps: [n('puglia_grapes', 'origin', 1, 'chilled', 'Packed in the field, pre-cooled and sulphur-padded.'), l('reefer_truck'), n('the_greenery', 'import', 1, 'chilled')] }),
      route({ id: 'grapes_za', label: 'South Africa, Hex River Valley (winter)', origin: { country: 'ZA', region: 'Western Cape' }, season: { from: 12, to: 4 }, share: 0.7,
        producerIds: ['hex_river'],
        co2e: 0.5, method: 'Irrigated vineyard', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 1.35, packingEurPerKg: 0.3,
        steps: [
          n('hex_river', 'origin', 1, 'chilled', 'Packed on the farm with sulphur dioxide pads against botrytis.'),
          l('reefer_truck'),
          n('cape_town_port', 'port', 2, 'chilled'),
          l('reefer_ship', { waypoints: [...SEA.fromCape, ...SEA.atlanticToRotterdam], hours: 24 * 18 }),
          n('port_rotterdam', 'port', 1, 'chilled'),
          l('reefer_truck'),
          n('the_greenery', 'import', 2, 'chilled'),
        ] }),
    ],
  },
  // -------------------------------------------------------------- KIWI
  {
    id: 'kiwi', name: 'Kiwifruit', category: 'fruit', emoji: '🥝',
    pack: { label: '6 kiwis (600 g)', kg: 0.6 }, shelfPriceEur: 2.79,
    description: 'Italy is the largest kiwi grower in Europe and covers November to May from cold storage. From May the New Zealand harvest arrives by ship at Zeebrugge.',
    routes: [
      route({ id: 'kiwi_it', label: 'Italy, Latina (stored)', origin: { country: 'IT', region: 'Lazio' }, season: { from: 11, to: 5 }, share: 0.8,
        producerIds: ['latina_kiwi'],
        co2e: 0.3, method: 'Irrigated orchard', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 0.85, packingEurPerKg: 0.15,
        steps: [n('latina_kiwi', 'origin', 60, 'chilled', 'Harvested in October and November, stored at 0 °C in the packhouse for on average two months.'), l('reefer_truck'), n('the_greenery', 'import', 1, 'chilled')] }),
      route({ id: 'kiwi_nz', label: 'New Zealand, Bay of Plenty (May to November)', origin: { country: 'NZ', region: 'Bay of Plenty' }, season: { from: 5, to: 11 }, share: 0.8,
        producerIds: ['zespri'],
        co2e: 0.35, method: 'Orchard', source: P.lit, conf: 'likely',
        farmGateEurPerKg: 1.35, packingEurPerKg: 0.2,
        steps: [
          n('bay_of_plenty', 'origin', 0, 'ambient', 'Harvested March to May; packed and cooled by a Zespri-registered packhouse.'),
          l('truck'),
          n('tauranga_port', 'port', 3, 'chilled', 'Loaded onto chartered reefer vessels.'),
          l('reefer_ship', { waypoints: [...SEA.fromNZ, ...SEA.atlanticToZeebrugge], hours: 24 * 35, note: 'Via the Panama Canal.' }),
          n('zespri_zeebrugge', 'port', 14, 'chilled', 'Held in Zespri cold stores and released to importers as the season progresses; average two weeks.'),
        ] }),
    ],
  },
  // -------------------------------------------------------------- SALMON
  {
    id: 'salmon', name: 'Fresh salmon fillet', category: 'fish', emoji: '🐟',
    pack: { label: '250 g fillet', kg: 0.25 }, shelfPriceEur: 5.99,
    description: 'Almost all fresh salmon in Dutch supermarkets is farmed Atlantic salmon from Norway, harvested to order and trucked south within a day. The feed, mostly soy and fish meal, drives the footprint.',
    routes: [
      route({ id: 'salmon_no', label: 'Norway, Frøya (farmed)', origin: { country: 'NO', region: 'Trøndelag' }, season: { from: 1, to: 12 }, share: 1,
        producerIds: ['salmar', 'norway_salmon'],
        co2e: 5.0, method: 'Sea-cage farming incl. feed (about 75 % of impact), per kg fillet at 60 % yield', source: P.poore, conf: 'likely',
        farmGateEurPerKg: 11.0, packingEurPerKg: 1.2,
        steps: [
          n('froya_norway', 'origin', 0, 'chilled', 'Harvested, bled, gutted and packed in ice in polystyrene boxes.'),
          l('reefer_truck', { distanceKm: 1750, hours: 30, note: 'Via Trondheim, Oslo, Sweden, Denmark and Germany.' }),
          n('urk', 'processing', 1, 'chilled', 'Filleted, portioned and packed in modified atmosphere.'),
        ] }),
    ],
  },
  // -------------------------------------------------------------- CHICKEN
  {
    id: 'chicken', name: 'Chicken breast fillet', category: 'meat', emoji: '🍗',
    pack: { label: '500 g fillet', kg: 0.5 }, shelfPriceEur: 5.49,
    description: 'Dutch supermarket chicken is almost entirely domestic and, since 2023, slower-growing "Beter Leven" breeds. Feed, mainly wheat and soy, accounts for most of the footprint.',
    routes: [
      route({ id: 'chicken_nl', label: 'Gelderse Vallei broiler farms', origin: { country: 'NL', region: 'Gelderse Vallei' }, season: { from: 1, to: 12 }, share: 1,
        producerIds: ['gelderse_vallei_poultry', 'plukon'],
        co2e: 7.0, method: 'Broiler production incl. feed with South American soy, per kg breast fillet', source: P.blonk, conf: 'likely',
        farmGateEurPerKg: 4.2, packingEurPerKg: 0.9,
        steps: [
          n('gelderse_vallei', 'origin', 0, 'ambient', 'Birds are caught at night and driven to the plant within two hours.'),
          l('truck'),
          n('plukon_wezep', 'processing', 1, 'chilled', 'Slaughtered, chilled, cut and packed the same day.'),
        ] }),
    ],
  },
  // -------------------------------------------------------------- MILK
  {
    id: 'milk', name: 'Fresh whole milk', category: 'dairy', emoji: '🥛',
    pack: { label: '1 litre carton', kg: 1.03 }, shelfPriceEur: 1.19,
    description: 'Collected every other day from farms within about 100 km of the dairy, pasteurised and packed within 24 hours. Cows, not trucks, make up almost the whole footprint.',
    routes: [
      route({ id: 'milk_nl', label: 'Frisian dairy farms', origin: { country: 'NL', region: 'Friesland' }, season: { from: 1, to: 12 }, share: 1,
        producerIds: ['friesland_dairy', 'aware', 'frieslandcampina'],
        co2e: 1.25, method: 'Farm gate incl. enteric methane, manure, feed and land use', source: P.blonk, conf: 'likely',
        farmGateEurPerKg: 0.5, packingEurPerKg: 0.12,
        steps: [
          n('friesland_dairy', 'origin', 1, 'chilled', 'Held in the farm tank at 4 °C until the milk truck comes.'),
          l('reefer_truck', { note: 'Collection round past several farms.' }),
          n('aware_heerenveen', 'processing', 1, 'chilled', 'Pasteurised at 72 °C for 15 seconds and packed in cartons.'),
        ] }),
    ],
  },
  // -------------------------------------------------------------- EGGS
  {
    id: 'eggs', name: 'Free-range eggs', category: 'eggs', emoji: '🥚',
    pack: { label: '10 eggs (about 600 g)', kg: 0.6 }, shelfPriceEur: 2.99,
    description: 'The Netherlands is Europe\'s largest egg exporter. Eggs for the domestic shelf travel a short loop: farm, packing station, distribution centre, store.',
    routes: [
      route({ id: 'eggs_nl', label: 'Barneveld free-range farms', origin: { country: 'NL', region: 'Gelderse Vallei' }, season: { from: 1, to: 12 }, share: 1,
        producerIds: ['barneveld_eggs', 'kwetters'],
        co2e: 2.0, method: 'Layer farm incl. feed and pullet rearing, per kg egg', source: P.blonk, conf: 'likely',
        farmGateEurPerKg: 1.7, packingEurPerKg: 0.35,
        steps: [
          n('barneveld', 'origin', 2, 'ambient', 'Collected daily by conveyor, stored on the farm for up to a few days.'),
          l('truck'),
          n('kwetters', 'packing', 1, 'ambient', 'Candled, graded and stamped with the producer code.'),
        ] }),
    ],
  },
];

export const PRODUCT_BY_ID: Record<string, Product> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
