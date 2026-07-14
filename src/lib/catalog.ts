import type { CtClient } from './ctClient';
import type { CtPagedQueryResponse, CatalogProduct, CategoryLite, Pillar } from './types';

/**
 * Catalogue / ranging data access.
 *
 * Ranging = choosing which EXISTING products a store carries, via its Product Selection
 * (Individual mode). This is provisioning the store's scope — we still never author products
 * or prices. In production the pillar feeds keep the selection in sync; here HQ curates it.
 */

// Metcash pillar → product-type key.
const PILLAR_PRODUCT_TYPE_KEY: Record<Pillar, string> = {
  food: 'grocery',
  liquor: 'liquor',
  hardware: 'hardware',
};

interface ProductTypeLite {
  id: string;
  key?: string;
}

export async function fetchProductTypeIdForPillar(
  client: CtClient,
  pillar: Pillar
): Promise<string | null> {
  const wantKey = PILLAR_PRODUCT_TYPE_KEY[pillar];
  const data = await client.get<CtPagedQueryResponse<ProductTypeLite>>('/product-types?limit=100');
  const match = data.results.find((pt) => pt.key === wantKey);
  return match?.id ?? null;
}

interface CategoryRef { id: string }
interface Money { url: string }
interface ProductProjection {
  id: string;
  key?: string;
  name?: Record<string, string>;
  categories?: CategoryRef[];
  masterVariant?: { sku?: string; images?: { url: string }[] };
}

function loc(m?: Record<string, string>): string {
  if (!m) return '';
  return m['en-AU'] ?? m['en'] ?? Object.values(m)[0] ?? '';
}

/** All products belonging to a pillar's product type (the default candidate range). */
export async function fetchProductsByPillar(
  client: CtClient,
  pillar: Pillar
): Promise<CatalogProduct[]> {
  const productTypeId = await fetchProductTypeIdForPillar(client, pillar);
  if (!productTypeId) return []; // e.g. food/grocery not seeded yet
  const where = encodeURIComponent(`productType(id="${productTypeId}")`);
  const data = await client.get<CtPagedQueryResponse<ProductProjection>>(
    `/product-projections?where=${where}&limit=500&staged=false`
  );
  return data.results.map((p) => ({
    id: p.id,
    key: p.key,
    name: loc(p.name),
    sku: p.masterVariant?.sku,
    image: p.masterVariant?.images?.[0]?.url,
    categoryIds: (p.categories ?? []).map((c) => c.id),
  }));
}

/** Categories (for the range editor filter). */
export async function fetchCategories(client: CtClient): Promise<CategoryLite[]> {
  const data = await client.get<CtPagedQueryResponse<{
    id: string;
    key?: string;
    name?: Record<string, string>;
    parent?: { id: string };
  }>>('/categories?limit=200');
  return data.results.map((c) => ({
    id: c.id,
    key: c.key,
    name: loc(c.name),
    parentId: c.parent?.id,
  }));
}

interface SelectionProductAssignment {
  product: { id: string };
}

/** Product ids currently assigned to a store's selection (empty if the selection is new/absent). */
export async function fetchSelectionProductIds(
  client: CtClient,
  selectionKey: string
): Promise<Set<string>> {
  try {
    const data = await client.get<CtPagedQueryResponse<SelectionProductAssignment>>(
      `/product-selections/key=${selectionKey}/products?limit=500`
    );
    return new Set(data.results.map((a) => a.product.id));
  } catch (err) {
    return new Set();
  }
}

interface SelectionMeta { version: number }

/**
 * Reconcile a selection's products to `desiredIds` (idempotent diff).
 * Adds/removes only what changed, batching actions per request.
 */
export async function setSelectionProducts(
  client: CtClient,
  selectionKey: string,
  desiredIds: string[],
  currentIds: Set<string>
): Promise<{ added: number; removed: number }> {
  const desired = new Set(desiredIds);
  const toAdd = desiredIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !desired.has(id));
  if (toAdd.length === 0 && toRemove.length === 0) return { added: 0, removed: 0 };

  const actions = [
    ...toAdd.map((id) => ({ action: 'addProduct', product: { typeId: 'product', id } })),
    ...toRemove.map((id) => ({ action: 'removeProduct', product: { typeId: 'product', id } })),
  ];

  let version = (await client.get<SelectionMeta>(`/product-selections/key=${selectionKey}`)).version;
  const BATCH = 300;
  for (let i = 0; i < actions.length; i += BATCH) {
    const chunk = actions.slice(i, i + BATCH);
    const res = await client.post<SelectionMeta>(`/product-selections/key=${selectionKey}`, {
      version,
      actions: chunk,
    });
    version = res.version;
  }
  return { added: toAdd.length, removed: toRemove.length };
}
