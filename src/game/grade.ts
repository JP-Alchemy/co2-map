/**
 * A CO2e grade per kilogram of food, from farm to shelf. The bands are fixed (not relative to the product's
 * category), so an A is low-carbon in absolute terms: potatoes and local vegetables sit there, most fruit
 * is B, milk and avocados C, eggs and heated-greenhouse peppers D, and air freight, fish and meat E.
 */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

export const GRADES: { grade: Grade; max: number; label: string; color: string; ink: string }[] = [
  { grade: 'A', max: 0.5, label: 'Very low', color: '#22c55e', ink: '#052e16' },
  { grade: 'B', max: 1, label: 'Low', color: '#a3e635', ink: '#1a2e05' },
  { grade: 'C', max: 2, label: 'Medium', color: '#facc15', ink: '#422006' },
  { grade: 'D', max: 4, label: 'High', color: '#fb923c', ink: '#431407' },
  { grade: 'E', max: Infinity, label: 'Very high', color: '#f43f5e', ink: '#4c0519' },
];

/** Grade for a total footprint in kg CO2e per kg of product. */
export function gradeOf(kgPerKg: number) {
  return GRADES.find((g) => kgPerKg < g.max) ?? GRADES[GRADES.length - 1];
}
