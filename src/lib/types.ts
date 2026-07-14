// Shared CT + contract types for the Retailer Onboarding app.
// Field keys mirror the shared data contract (see CLAUDE.md / docs/02-data-model.md) EXACTLY.

export interface CtReference {
  typeId: string;
  id: string;
}
export interface CtLocalizedString {
  [locale: string]: string;
}
export interface CtPagedQueryResponse<T> {
  results: T[];
  total: number;
  count: number;
  offset: number;
}

// ---- Enums from the store-programme custom type ----
export type ProgrammeTierKey = 'STANDARD' | 'DIGITAL_PLUS' | 'TRADE_ENABLED' | 'PILOT';
export type BannerKey = 'IGA' | 'CELLARBRATIONS' | 'BOTTLE_O' | 'TOTAL_TOOLS' | 'MITRE10';
export type LifecycleState = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'OFFBOARDED';
export type AuState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT';

// Pillars (grouping of banners)
export type Pillar = 'food' | 'liquor' | 'hardware';

// ---- store-programme custom fields (snake_case, literal contract keys) ----
export interface StoreProgrammeFields {
  programme_tier?: ProgrammeTierKey;
  banner?: BannerKey;
  opt_in_date?: string;
  coveo_source_id?: string;
  braze_segment_id?: string;
  rapid_delivery_enabled?: boolean;
  lifecycle_state?: LifecycleState;
  activation_date?: string;
  product_feed_ref?: string;
  pricing_feed_ref?: string;
  inventory_feed_ref?: string;
  owner_key?: string;
  street_address?: string;
  suburb?: string;
  state?: AuState;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  opening_hours?: string;
}

export interface StoreProductSelectionRef {
  productSelection: CtReference;
  active: boolean;
}

export interface StoreData {
  id: string;
  key: string;
  version: number;
  name?: CtLocalizedString;
  languages: string[];
  countries?: { code: string }[];
  distributionChannels: CtReference[];
  supplyChannels: CtReference[];
  productSelections: StoreProductSelectionRef[];
  custom?: {
    type: CtReference;
    fields: StoreProgrammeFields;
  };
}

// ---- programme-tiers custom object ----
export interface TierFeatures {
  search: boolean;
  clickCollect: boolean;
  rapidDelivery: boolean;
  personalisation: boolean;
  loyaltyEarnBurn: boolean;
  b2bTrade: boolean;
  jobCodes: boolean;
  accountingExport: boolean;
}
export interface ProgrammeTierValue {
  label: string;
  allowedPillars: Pillar[];
  features: TierFeatures;
}
export interface ProgrammeTierObject {
  id: string;
  version: number;
  container: 'programme-tiers';
  key: ProgrammeTierKey;
  value: ProgrammeTierValue;
}

// ---- retailer-owners custom object ----
export interface OwnerContact {
  name: string;
  email: string;
  phone: string;
}
export interface RetailerOwnerValue {
  displayName: string;
  abn: string;
  primaryContact: OwnerContact;
  stores: string[];
}
export interface RetailerOwnerObject {
  id: string;
  version: number;
  container: 'retailer-owners';
  key: string;
  value: RetailerOwnerValue;
}

export interface ChannelData {
  id: string;
  key: string;
  name?: CtLocalizedString;
  roles: string[];
}

// ---- catalogue / ranging ----
export interface CatalogProduct {
  id: string;
  key?: string;
  name: string;
  sku?: string;
  image?: string;
  categoryIds: string[];
}

export interface CategoryLite {
  id: string;
  key?: string;
  name: string;
  parentId?: string;
}
