import type { ComputedRoute } from '../model/compute';
import { gradeOf } from './grade';

export interface Badge { id: string; icon: string; name: string; hint: string }

/** Every badge that can be earned, in display order. */
export const BADGES: Badge[] = [
  { id: 'local', icon: '🏡', name: 'Local hero', hint: 'Travelled less than 300 km' },
  { id: 'low', icon: '🌱', name: 'Light footprint', hint: 'CO2e grade A' },
  { id: 'fair', icon: '🧑‍🌾', name: 'Fair share', hint: 'The farmer gets 30% or more of the shelf price' },
  { id: 'globe', icon: '🧭', name: 'Globetrotter', hint: 'Travelled more than 10,000 km' },
  { id: 'equator', icon: '🌐', name: 'Equator crosser', hint: 'Grown in the southern hemisphere' },
  { id: 'ocean', icon: '🚢', name: 'Ocean crossing', hint: 'More than 3,000 km at sea' },
  { id: 'flyer', icon: '✈️', name: 'Frequent flyer', hint: 'Part of the journey by air' },
  { id: 'ferry', icon: '⛴️', name: 'Sea legs', hint: 'Crossed by ferry' },
  { id: 'rail', icon: '🚆', name: 'Rail rider', hint: 'Travelled by train' },
  { id: 'ripe', icon: '🌡️', name: 'Ripening room', hint: 'Ripened on arrival' },
  { id: 'slow', icon: '🐢', name: 'Slow food', hint: 'More than 20 days from harvest to shelf' },
  { id: 'fast', icon: '⚡', name: 'Speed run', hint: 'On the shelf less than 6 days after harvest' },
  { id: 'heavy', icon: '🏋️', name: 'Heavyweight', hint: 'CO2e grade E' },
];
const BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b]));

/** The badges a computed route earns. */
export function badgesFor(c: ComputedRoute): Badge[] {
  const ids: string[] = [];
  const grade = gradeOf(c.co2e.total).grade;
  const origin = c.steps[0];
  const sea = (c.byMode.reefer_ship?.km ?? 0);
  if (c.totalKm < 300) ids.push('local');
  if (grade === 'A') ids.push('low');
  if (c.cost.farmGate / c.cost.shelf >= 0.3) ids.push('fair');
  if (c.totalKm > 10_000) ids.push('globe');
  if (origin.kind === 'node' && origin.place.coords[1] < 0) ids.push('equator');
  if (sea > 3000) ids.push('ocean');
  if (c.byMode.air) ids.push('flyer');
  if (c.byMode.ferry) ids.push('ferry');
  if (c.byMode.rail) ids.push('rail');
  if (c.steps.some((s) => s.kind === 'node' && s.step.role === 'ripening')) ids.push('ripe');
  if (c.totalDays > 20) ids.push('slow');
  if (c.totalDays < 6) ids.push('fast');
  if (grade === 'E') ids.push('heavy');
  return BADGES.filter((b) => ids.includes(b.id)).map((b) => BY_ID[b.id]);
}
