import type { NodeRole } from '../types';

export const ROLE_LABEL: Record<NodeRole, string> = { origin: 'Grown here', packing: 'Packed', processing: 'Processed', port: 'Port', airport: 'Airport', import: 'Importer', ripening: 'Ripened', dc: 'Distribution centre', store: 'Your store' };
export const ROLE_ICON: Record<NodeRole, string> = { origin: '🌱', packing: '📦', processing: '🏭', port: '⚓', airport: '🛫', import: '🏢', ripening: '🌡️', dc: '🏬', store: '🛒' };
