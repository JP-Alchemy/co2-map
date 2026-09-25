import type { TransportMode } from '../types';

/**
 * Side-view vehicle illustrations, facing right, drawn on a 64×36 grid. `c` is the mode colour.
 * Kept as plain SVG strings so the player can swap them into a marker without React.
 */
const INK = '#0b1220';

const wheel = (x: number, y = 29, r = 4) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x}" cy="${y}" r="${r * 0.42}" fill="#cbd5e1"/>`;

const cab = (c: string) => `
  <path d="M42 10.5h9.5c1 0 1.8.4 2.4 1.1l5.6 6.6c.5.6.8 1.3.8 2.1V26a1.8 1.8 0 0 1-1.8 1.8H42z" fill="${c}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M50.6 12.8h1.6l4.8 5.7h-6.4z" fill="#bfe7ff" stroke="${INK}" stroke-width="1"/>
  <rect x="44" y="20" width="4" height="1.6" rx=".8" fill="${INK}" opacity=".55"/>
  <rect x="58.2" y="22.5" width="2.4" height="2.6" rx=".6" fill="#fde68a"/>`;

const truck = (c: string, reefer: boolean) => `
<svg viewBox="0 0 64 36" xmlns="http://www.w3.org/2000/svg">
  <g class="exhaust"><circle cx="41" cy="7" r="2.2"/><circle cx="39" cy="4" r="1.6"/></g>
  <rect x="2" y="5.5" width="38.5" height="21" rx="2.4" fill="${reefer ? '#f8fafc' : '#fcd9a8'}" stroke="${INK}" stroke-width="1.4"/>
  <rect x="2.7" y="19.8" width="37.1" height="3.2" fill="${c}"/>
  ${reefer
    ? `<g stroke="#0ea5e9" stroke-width="1.6" stroke-linecap="round"><path d="M17 8.6v8.4M13.4 10.7l7.2 4.2M13.4 14.9l7.2-4.2"/></g><rect x="36" y="7" width="3.6" height="11" rx="1" fill="#e2e8f0" stroke="${INK}" stroke-width=".8"/>`
    : `<g stroke="${INK}" stroke-width=".8" opacity=".35"><path d="M10 6v14M18 6v14M26 6v14M34 6v14"/></g>`}
  ${cab(c)}
  <rect x="2" y="26" width="58" height="2.4" rx="1.1" fill="${INK}"/>
  ${wheel(9)}${wheel(18)}${wheel(51.5)}
</svg>`;

const ship = (c: string) => `
<svg viewBox="0 0 64 36" xmlns="http://www.w3.org/2000/svg">
  <g stroke="${INK}" stroke-width=".9">
    <rect x="16" y="10" width="8.5" height="6" fill="#f8fafc"/><rect x="24.5" y="10" width="8.5" height="6" fill="#ef4444"/>
    <rect x="33" y="10" width="8.5" height="6" fill="#f8fafc"/><rect x="41.5" y="10" width="8.5" height="6" fill="#22c55e"/>
    <rect x="20" y="4" width="8.5" height="6" fill="#3b82f6"/><rect x="28.5" y="4" width="8.5" height="6" fill="#f8fafc"/>
    <rect x="37" y="4" width="8.5" height="6" fill="#f59e0b"/>
  </g>
  <rect x="5" y="3.5" width="8.5" height="12.5" rx="1" fill="#f8fafc" stroke="${INK}" stroke-width="1.2"/>
  <rect x="6.3" y="5.5" width="5.9" height="1.8" fill="${INK}"/>
  <rect x="7.2" y="0.5" width="3.4" height="3.2" fill="${c}" stroke="${INK}" stroke-width=".9"/>
  <path d="M1.5 16h59.5l-4.6 11.2H6.6z" fill="${c}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M3.9 22.2h54.6l-2.1 5H6.6z" fill="#b91c1c"/>
  <path d="M55.5 16l2.2-3h3.6l-.3 3z" fill="${c}" stroke="${INK}" stroke-width="1"/>
  <path d="M0 30.5c4 1.6 8 1.6 12 0s8-1.6 12 0 8 1.6 12 0 8-1.6 12 0 8 1.6 12 0" class="wave" fill="none" stroke="#e0f2fe" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

const plane = (c: string) => `
<svg viewBox="0 0 64 36" xmlns="http://www.w3.org/2000/svg">
  <path d="M7 17.5L3.6 4.2h5.2l8.6 11.6z" fill="${c}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M4 17.4c0-2.6 3-4 8.5-4H50c6.5 0 12 2.3 12 5.4 0 2.6-4.4 4.3-10 4.3H12.6C7.4 23.1 4 20.6 4 17.4z" fill="#f8fafc" stroke="${INK}" stroke-width="1.3"/>
  <path d="M55.2 15.2c2.6.3 4.8 1.3 5.6 2.9h-5.6z" fill="${INK}"/>
  <path d="M12 20.4h42" stroke="${c}" stroke-width="1.6"/>
  <g fill="#38bdf8">${[18, 22, 26, 30, 34, 38, 42, 46, 50].map((x) => `<circle cx="${x}" cy="17" r="1.05"/>`).join('')}</g>
  <path d="M26.5 20.2h13.5L30.4 31.6h-5.6z" fill="#cbd5e1" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
  <rect x="29.5" y="23.4" width="9" height="4.2" rx="2.1" fill="#475569" stroke="${INK}" stroke-width=".8"/>
  <path d="M4.6 16.3h9.2l-5.6 3.9H3.4z" fill="#cbd5e1" stroke="${INK}" stroke-width=".9"/>
</svg>`;

const train = (c: string) => `
<svg viewBox="0 0 64 36" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="8.5" width="27" height="15" rx="1.6" fill="#f8fafc" stroke="${INK}" stroke-width="1.3"/>
  <g stroke="${INK}" stroke-width=".7" opacity=".35"><path d="M8 9v14M14 9v14M20 9v14"/></g>
  <rect x="1.5" y="23.5" width="28" height="2.4" fill="${INK}"/>
  <path d="M29.5 24.6h3.5" stroke="${INK}" stroke-width="1.4"/>
  <path d="M33 7.5h20.5c4.6 0 8.5 4.6 8.5 9.8v7.3H33z" fill="${c}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
  <path d="M52.5 10.6c3 .2 5.2 2.6 6.2 5.6h-6.2z" fill="#bfe7ff" stroke="${INK}" stroke-width=".9"/>
  <rect x="36" y="10.5" width="5" height="4" rx=".6" fill="#bfe7ff" stroke="${INK}" stroke-width=".8"/>
  <path d="M33 19.5h29" stroke="#fef3c7" stroke-width="1.4"/>
  ${wheel(7, 27.5, 2.7)}${wheel(13, 27.5, 2.7)}${wheel(19, 27.5, 2.7)}${wheel(25, 27.5, 2.7)}
  ${wheel(38, 27.5, 2.9)}${wheel(45, 27.5, 2.9)}${wheel(52, 27.5, 2.9)}${wheel(58, 27.5, 2.9)}
  <rect x="0" y="30.6" width="64" height="1.6" rx=".8" fill="#64748b"/>
</svg>`;

const ferry = (c: string) => `
<svg viewBox="0 0 64 36" xmlns="http://www.w3.org/2000/svg">
  <rect x="17" y="2.5" width="6.5" height="6.8" fill="${c}" stroke="${INK}" stroke-width="1.1"/>
  <rect x="17" y="2.5" width="6.5" height="2" fill="${INK}"/>
  <rect x="9" y="8.8" width="44" height="9" rx="1.6" fill="#f8fafc" stroke="${INK}" stroke-width="1.3"/>
  <g fill="${INK}">${[12, 17, 22, 27, 32, 37, 42, 47].map((x) => `<rect x="${x}" y="11.6" width="3.2" height="2.2" rx=".5"/>`).join('')}</g>
  <path d="M1.5 17.6h60.5l-4.8 10H6.8z" fill="#f8fafc" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M3.4 22h56.9l-2.9 5.6H6.8z" fill="${c}"/>
  <path d="M0 30.5c4 1.6 8 1.6 12 0s8-1.6 12 0 8 1.6 12 0 8-1.6 12 0 8 1.6 12 0" class="wave" fill="none" stroke="#e0f2fe" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

export function vehicleSvg(mode: TransportMode, color: string): string {
  switch (mode) {
    case 'truck': return truck(color, false);
    case 'reefer_truck': return truck(color, true);
    case 'reefer_ship': return ship(color);
    case 'air': return plane(color);
    case 'rail': return train(color);
    case 'ferry': return ferry(color);
  }
}

/** A short line about the leg, used when the route data has no note of its own. */
export const MODE_BLURB: Record<TransportMode, string> = {
  truck: 'On the road in a curtain-sided trailer.',
  reefer_truck: 'Kept cold on the road in a refrigerated trailer.',
  reefer_ship: 'Plugged into the ship’s power in a reefer container, crossing at about 18 knots.',
  air: 'In the hold of a jet: the fastest way, and by far the most carbon per kilo.',
  rail: 'On a freight train, the low-carbon way over land.',
  ferry: 'The trailer rolls onto a ferry for the sea crossing.',
};
