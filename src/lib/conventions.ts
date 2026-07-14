import type { BannerKey } from './types';

// Slug used in store keys per banner (see CLAUDE.md store-key convention).
const BANNER_SLUG: Record<BannerKey, string> = {
  IGA: 'iga',
  CELLARBRATIONS: 'cellarbrations',
  BOTTLE_O: 'bottle-o',
  TOTAL_TOOLS: 'total-tools',
  MITRE10: 'mitre10',
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Store key convention: {banner}-{retailer-slug} e.g. bottle-o-bondi. */
export function makeStoreKey(banner: BannerKey, retailerName: string): string {
  const slug = slugify(retailerName);
  return slug ? `${BANNER_SLUG[banner]}-${slug}` : '';
}

// Auto-generated integration ids (editable in the wizard).
export const makeCoveoSourceId = (storeKey: string) => `cveo-${storeKey}`;
export const makeBrazeSegmentId = (storeKey: string) => `braze-${storeKey}`;

// Feed reference convention — onboarding WIRES these refs; upstream systems own the data.
export const makeProductFeedRef = (storeKey: string) => `feed://products/${storeKey}`;
export const makePricingFeedRef = (storeKey: string) => `feed://pricing/${storeKey}`;
export const makeInventoryFeedRef = (storeKey: string) => `feed://inventory/${storeKey}`;

export const AU_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'] as const;

/** Monogram initials from an owner's display name, e.g. "Nguyen Retail Group" → "NR". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
