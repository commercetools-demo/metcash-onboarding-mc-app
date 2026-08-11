import type { CtClient } from './ctClient';
import { fetchSelectionProductIds, setSelectionProducts } from './catalog';
import type {
  StoreData,
  RetailerOwnerObject,
  RetailerOwnerValue,
  ProgrammeTierObject,
  ProgrammeTierValue,
  ProgrammeTierKey,
  LifecycleState,
  StoreProgrammeFields,
  LoyaltyProgramObject,
  LoyaltyProgramValue,
} from './types';

/**
 * Write layer for the Retailer Onboarding app (MTC-O3).
 *
 * Every write goes through the MC proxy on the logged-in user's session (no secret).
 * All writes are IDEMPOTENT: upsert by key, version-based optimistic concurrency. Re-running
 * onboarding must never duplicate stores/channels/selections/owners. Mirrors the exact API
 * shapes proven in metcash-demo/scripts/seed-franchise.ts.
 *
 * Golden rule: PROVISION, don't author. We create Store scope + channels + an (empty) product
 * selection + tier + feed refs + lifecycle. We never create products or prices — those arrive
 * via the pillar feeds. (For a live demo where the storefront must show a range immediately,
 * see cloneRangeFromTemplate — clearly demo-only, it mimics what a feed would deliver.)
 */

// ---- key conventions (see CLAUDE.md) ----
export const priceChannelKey = (storeKey: string) => `${storeKey}-price`;
export const supplyChannelKey = (storeKey: string) => `${storeKey}-supply`;
export const selectionKey = (storeKey: string) => `${storeKey}-range`;

const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// ---- error helpers -----------------------------------------------------------

function statusOf(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const anyErr = err as Record<string, unknown>;
  if (typeof anyErr.statusCode === 'number') return anyErr.statusCode;
  if (typeof anyErr.status === 'number') return anyErr.status;
  const msg = err instanceof Error ? err.message : '';
  const m = msg.match(/\b(400|401|403|404|409|500)\b/);
  return m ? Number(m[1]) : undefined;
}
const isNotFound = (err: unknown) => statusOf(err) === 404;

async function getByKeyOrNull<T>(client: CtClient, path: string): Promise<T | null> {
  try {
    return await client.get<T>(path);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

// ---- channels & product selection --------------------------------------------

export async function ensureChannel(
  client: CtClient,
  key: string,
  role: 'ProductDistribution' | 'InventorySupply',
  name: string
): Promise<{ created: boolean }> {
  const existing = await getByKeyOrNull<{ id: string }>(client, `/channels/key=${key}`);
  if (existing) return { created: false };
  await client.post('/channels', { key, roles: [role], name: { 'en-AU': name } });
  return { created: true };
}

export async function ensureProductSelection(
  client: CtClient,
  key: string,
  name: string
): Promise<{ created: boolean }> {
  const existing = await getByKeyOrNull<{ id: string }>(
    client,
    `/product-selections/key=${key}`
  );
  if (existing) return { created: false };
  await client.post('/product-selections', {
    key,
    name: { 'en-AU': name },
    mode: 'Individual',
  });
  return { created: true };
}

// ---- store -------------------------------------------------------------------

export interface StoreDraftInput {
  key: string;
  name: string;
  fields: StoreProgrammeFields; // custom fields (banner, tier, feeds, owner_key, location, …)
}

/**
 * Create the store as DRAFT (or reconcile custom fields if it already exists).
 * Channels + selection must already exist (they are referenced by key).
 */
export async function ensureStoreDraft(
  client: CtClient,
  input: StoreDraftInput
): Promise<{ store: StoreData; created: boolean }> {
  const existing = await getByKeyOrNull<StoreData>(client, `/stores/key=${input.key}`);
  if (existing) {
    const current = existing.custom?.fields ?? {};
    const actions = Object.entries(input.fields)
      .filter(([k, v]) => v !== undefined && JSON.stringify(current[k as keyof StoreProgrammeFields]) !== JSON.stringify(v))
      .map(([name, value]) => ({ action: 'setCustomField', name, value }));
    if (actions.length === 0) return { store: existing, created: false };
    const updated = await client.post<StoreData>(`/stores/key=${input.key}`, {
      version: existing.version,
      actions,
    });
    return { store: updated, created: false };
  }
  const created = await client.post<StoreData>('/stores', {
    key: input.key,
    name: { 'en-AU': input.name },
    languages: ['en-AU'],
    countries: [{ code: 'AU' }],
    distributionChannels: [{ typeId: 'channel', key: priceChannelKey(input.key) }],
    supplyChannels: [{ typeId: 'channel', key: supplyChannelKey(input.key) }],
    productSelections: [
      { productSelection: { typeId: 'product-selection', key: selectionKey(input.key) }, active: true },
    ],
    custom: {
      type: { typeId: 'type', key: 'store-programme' },
      fields: { lifecycle_state: 'DRAFT', ...input.fields },
    },
  });
  return { store: created, created: true };
}

/** Set one or more custom fields on a store (version-safe). */
export async function setStoreFields(
  client: CtClient,
  storeKey: string,
  fields: Partial<StoreProgrammeFields>
): Promise<StoreData> {
  const store = await client.get<StoreData>(`/stores/key=${storeKey}`);
  const current = store.custom?.fields ?? {};
  const actions = Object.entries(fields)
    .filter(([k, v]) => JSON.stringify(current[k as keyof StoreProgrammeFields]) !== JSON.stringify(v))
    .map(([name, value]) => ({ action: 'setCustomField', name, value }));
  if (actions.length === 0) return store;
  return client.post<StoreData>(`/stores/key=${storeKey}`, {
    version: store.version,
    actions,
  });
}

export function activateStore(client: CtClient, storeKey: string): Promise<StoreData> {
  return setStoreFields(client, storeKey, {
    lifecycle_state: 'ACTIVE',
    activation_date: today(),
  });
}

export function setLifecycle(
  client: CtClient,
  storeKey: string,
  state: LifecycleState
): Promise<StoreData> {
  const fields: Partial<StoreProgrammeFields> = { lifecycle_state: state };
  if (state === 'ACTIVE') fields.activation_date = today();
  return setStoreFields(client, storeKey, fields);
}

export function updateTier(
  client: CtClient,
  storeKey: string,
  tier: ProgrammeTierKey
): Promise<StoreData> {
  return setStoreFields(client, storeKey, { programme_tier: tier });
}

// ---- owners (retailer-owners custom objects) ---------------------------------

/** Upsert an owner object. Value stored as a proper JSON object (POST /custom-objects). */
export async function upsertOwner(
  client: CtClient,
  key: string,
  value: RetailerOwnerValue
): Promise<RetailerOwnerObject> {
  return client.post<RetailerOwnerObject>('/custom-objects', {
    container: 'retailer-owners',
    key,
    value,
  });
}

/** Add a store key to an owner's stores[] (idempotent). */
export async function addStoreToOwner(
  client: CtClient,
  ownerKey: string,
  storeKey: string
): Promise<RetailerOwnerObject> {
  const owner = await client.get<RetailerOwnerObject>(
    `/custom-objects/retailer-owners/${ownerKey}`
  );
  const stores = owner.value.stores ?? [];
  if (stores.includes(storeKey)) return owner;
  return upsertOwner(client, ownerKey, { ...owner.value, stores: [...stores, storeKey] });
}

/** Remove a store key from an owner's stores[] (idempotent). */
export async function removeStoreFromOwner(
  client: CtClient,
  ownerKey: string,
  storeKey: string
): Promise<RetailerOwnerObject | null> {
  const owner = await getByKeyOrNull<RetailerOwnerObject>(
    client,
    `/custom-objects/retailer-owners/${ownerKey}`
  );
  if (!owner) return null;
  const stores = (owner.value.stores ?? []).filter((s) => s !== storeKey);
  return upsertOwner(client, ownerKey, { ...owner.value, stores });
}

// ---- programme tiers (template management, MTC-O9) ---------------------------

export async function updateTierTemplate(
  client: CtClient,
  key: ProgrammeTierKey,
  value: ProgrammeTierValue
): Promise<ProgrammeTierObject> {
  return client.post<ProgrammeTierObject>('/custom-objects', {
    container: 'programme-tiers',
    key,
    value,
  });
}

// ---- loyalty programme config (docs/27) --------------------------------------

/**
 * Upsert the loyalty programme for a banner. Full-document overwrite, last-write-wins —
 * same shape as updateTierTemplate. The storefront reads this on every request (React
 * `cache()`, no ISR), so a save here is visible on the next page load.
 */
export async function upsertLoyaltyProgram(
  client: CtClient,
  key: string,
  value: LoyaltyProgramValue
): Promise<LoyaltyProgramObject> {
  return client.post<LoyaltyProgramObject>('/custom-objects', {
    container: 'loyalty-program',
    key,
    value,
  });
}

// ---- provisioning orchestrator (the wizard's money shot) ---------------------

export type ProvStepId =
  | 'price-channel'
  | 'supply-channel'
  | 'selection'
  | 'catalogue'
  | 'store'
  | 'owner-link'
  | 'activate';

export type ProvStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface ProvStep {
  id: ProvStepId;
  label: string;
  status: ProvStepStatus;
  detail?: string;
}

export const PROVISION_STEPS: { id: ProvStepId; label: string }[] = [
  { id: 'price-channel', label: 'Create price channel' },
  { id: 'supply-channel', label: 'Create supply channel' },
  { id: 'selection', label: 'Attach product selection' },
  { id: 'catalogue', label: 'Range products (catalogue)' },
  { id: 'store', label: 'Create Store (DRAFT)' },
  { id: 'owner-link', label: 'Link to franchisee owner' },
  { id: 'activate', label: 'Activate — live in storefront' },
];

export interface ProvisionInput {
  storeKey: string;
  storeName: string;
  ownerKey: string;
  fields: StoreProgrammeFields;
  /** Product ids to range into the store's selection (default: all pillar products). */
  productIds?: string[];
}

/**
 * Run the full provisioning sequence, reporting each step's status via onStep so the
 * wizard can animate the live checklist. Idempotent end-to-end.
 */
export async function provisionStore(
  client: CtClient,
  input: ProvisionInput,
  onStep: (id: ProvStepId, status: ProvStepStatus, detail?: string) => void
): Promise<StoreData> {
  const { storeKey, storeName, ownerKey, fields } = input;

  const run = async (
    id: ProvStepId,
    fn: () => Promise<string | void>
  ): Promise<void> => {
    onStep(id, 'running');
    try {
      const detail = await fn();
      onStep(id, 'done', detail || undefined);
    } catch (err) {
      onStep(id, 'error', err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  await run('price-channel', async () => {
    const r = await ensureChannel(client, priceChannelKey(storeKey), 'ProductDistribution', `${storeName} Price`);
    return r.created ? 'created' : 'exists';
  });
  await run('supply-channel', async () => {
    const r = await ensureChannel(client, supplyChannelKey(storeKey), 'InventorySupply', `${storeName} Supply`);
    return r.created ? 'created' : 'exists';
  });
  await run('selection', async () => {
    const r = await ensureProductSelection(client, selectionKey(storeKey), `${storeName} Range`);
    return r.created ? 'created' : 'exists';
  });
  await run('catalogue', async () => {
    const ids = input.productIds ?? [];
    if (ids.length === 0) return 'empty range';
    const current = await fetchSelectionProductIds(client, selectionKey(storeKey));
    const r = await setSelectionProducts(client, selectionKey(storeKey), ids, current);
    return `${ids.length} products (${r.added} added)`;
  });
  await run('store', async () => {
    const r = await ensureStoreDraft(client, {
      key: storeKey,
      name: storeName,
      fields: { ...fields, owner_key: ownerKey },
    });
    return r.created ? 'created' : 'reconciled';
  });
  await run('owner-link', async () => {
    await addStoreToOwner(client, ownerKey, storeKey);
    return 'linked';
  });
  let finalStore!: StoreData;
  await run('activate', async () => {
    finalStore = await activateStore(client, storeKey);
    return 'ACTIVE';
  });
  return finalStore;
}

/**
 * Reset path for demo rehearsals: set a store OFFBOARDED and unlink it from its owner.
 * (Non-destructive — keeps the Store/channels so re-provisioning is instant and idempotent.)
 * For a full teardown use scripts/reset-store.mjs (dev creds).
 */
export async function deprovisionStore(
  client: CtClient,
  storeKey: string,
  ownerKey?: string
): Promise<void> {
  await setLifecycle(client, storeKey, 'OFFBOARDED');
  if (ownerKey) await removeStoreFromOwner(client, ownerKey, storeKey);
}
