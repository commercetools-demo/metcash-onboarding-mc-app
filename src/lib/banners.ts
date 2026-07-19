import type { BannerKey, Pillar, ProgrammeTierKey, LifecycleState } from './types';

export interface BannerMeta {
  key: BannerKey;
  label: string;
  pillar: Pillar;
  /** Brand-ish accent colour for chips/cards (approximate banner colours). */
  color: string;
  /** Readable text colour on top of `color`. */
  onColor: string;
}

export const BANNERS: Record<BannerKey, BannerMeta> = {
  IGA: { key: 'IGA', label: 'IGA', pillar: 'food', color: '#E4002B', onColor: '#ffffff' },
  CELLARBRATIONS: { key: 'CELLARBRATIONS', label: 'Cellarbrations', pillar: 'liquor', color: '#F5A800', onColor: '#1A1A1A' },
  BOTTLE_O: { key: 'BOTTLE_O', label: 'The Bottle-O', pillar: 'liquor', color: '#D71920', onColor: '#ffffff' },
  TOTAL_TOOLS: { key: 'TOTAL_TOOLS', label: 'Total Tools', pillar: 'hardware', color: '#1A1A1A', onColor: '#FFD200' },
  MITRE10: { key: 'MITRE10', label: 'Mitre 10', pillar: 'hardware', color: '#004B87', onColor: '#ffffff' },
};

export const PILLAR_LABELS: Record<Pillar, string> = {
  food: 'Food',
  liquor: 'Liquor',
  hardware: 'Hardware',
};

export function bannersForPillar(pillar: Pillar): BannerMeta[] {
  return Object.values(BANNERS).filter((b) => b.pillar === pillar);
}

export const TIER_LABELS: Record<ProgrammeTierKey, string> = {
  STANDARD: 'Standard',
  DIGITAL_PLUS: 'Digital Plus',
  TRADE_ENABLED: 'Trade Enabled',
  PILOT: 'Pilot',
};

// Maps lifecycle state to a UI Kit Stamp tone.
export const LIFECYCLE_TONE: Record<
  LifecycleState,
  'positive' | 'information' | 'warning' | 'critical'
> = {
  ACTIVE: 'positive',
  DRAFT: 'information',
  SUSPENDED: 'warning',
  OFFBOARDED: 'critical',
};

// Hex colours for lightweight data-viz (KPI distribution bars).
export const LIFECYCLE_COLORS: Record<LifecycleState, string> = {
  ACTIVE: '#0b8043',
  DRAFT: '#5a6b87',
  SUSPENDED: '#e6a817',
  OFFBOARDED: '#c2185b',
};

export const TIER_COLORS: Record<ProgrammeTierKey, string> = {
  STANDARD: '#8a94a6',
  DIGITAL_PLUS: '#2f6bff',
  TRADE_ENABLED: '#0b8043',
  PILOT: '#8e44ad',
};

export const PILLAR_COLORS: Record<Pillar, string> = {
  food: '#E4002B',
  liquor: '#D71920',
  hardware: '#004B87',
};

export function bannerMeta(key?: string): BannerMeta | undefined {
  return key ? BANNERS[key as BannerKey] : undefined;
}
