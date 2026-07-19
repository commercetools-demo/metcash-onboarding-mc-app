import type { CtClient } from './ctClient';
import type { CtPagedQueryResponse, CatalogProduct, CategoryLite, Pillar } from './types';

/**
 * Catalogue / ranging data access — SCALE-AWARE (project now holds ~4k products).
 *
 * Ranging = choosing which EXISTING products a store carries, via its Product Selection
 * (Individual mode). This is provisioning the store's scope — we never author products/prices.
 *
 * Uses the Product Projection Search API (indexing is Activated on the project) for paginated,
 * server-side search + category/product-type filtering, so we never load thousands of products
 * into the browser at once.
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
  return data.results.find((pt) => pt.key === wantKey)?.id ?? null;
}

function loc(m?: Record<string, string>): string {
  if (!m) return '';
  return m['en-AU'] ?? m['en'] ?? Object.values(m)[0] ?? '';
}

interface ProductProjection {
  id: string;
  key?: string;
  name?: Record<string, string>;
  categories?: { id: string }[];
  masterVariant?: { sku?: string; images?: { url: string }[] };
}

function toCatalogProduct(p: ProductProjection): CatalogProduct {
  return {
    id: p.id,
    key: p.key,
    name: loc(p.name),
    sku: p.masterVariant?.sku,
    image: p.masterVariant?.images?.[0]?.url,
    categoryIds: (p.categories ?? []).map((c) => c.id),
  };
}

// ---- categories (for the range editor filter) ----
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

// ---- product projection search (paginated) ----
interface SearchArgs {
  productTypeId: string;
  categoryId?: string;
  text?: string;
  limit?: number;
  offset?: number;
}

function searchPath({ productTypeId, categoryId, text, limit = 24, offset = 0 }: SearchArgs): string {
  const params: string[] = [];
  params.push(`filter=${encodeURIComponent(`productType.id:"${productTypeId}"`)}`);
  if (categoryId) params.push(`filter=${encodeURIComponent(`categories.id:"${categoryId}"`)}`);
  if (text && text.trim()) params.push(`text.en-AU=${encodeURIComponent(text.trim())}`);
  params.push(`limit=${limit}`);
  params.push(`offset=${offset}`);
  params.push('markMatchingVariants=false');
  params.push('staged=false');
  return `/product-projections/search?${params.join('&')}`;
}

export async function searchProductsPage(
  client: CtClient,
  args: SearchArgs
): Promise<{ results: CatalogProduct[]; total: number }> {
  const data = await client.get<CtPagedQueryResponse<ProductProjection>>(searchPath(args));
  return { results: data.results.map(toCatalogProduct), total: data.total };
}

/** Total number of products for a pillar (+ optional category), via a 1-row search. */
export async function countProducts(client: CtClient, args: Omit<SearchArgs, 'limit' | 'offset'>): Promise<number> {
  const data = await client.get<CtPagedQueryResponse<ProductProjection>>(
    searchPath({ ...args, limit: 1, offset: 0 })
  );
  return data.total;
}

/** All product ids for a pillar (+ optional category) — for bulk "carry full range / add category". */
export async function fetchAllProductIds(
  client: CtClient,
  args: Omit<SearchArgs, 'limit' | 'offset'>
): Promise<string[]> {
  const ids: string[] = [];
  const PAGE = 500;
  let offset = 0;
  // guard against runaway loops
  for (let i = 0; i < 40; i++) {
    const data = await client.get<CtPagedQueryResponse<ProductProjection>>(
      searchPath({ ...args, limit: PAGE, offset })
    );
    ids.push(...data.results.map((p) => p.id));
    offset += PAGE;
    if (offset >= data.total || data.results.length === 0) break;
  }
  return ids;
}

/** Product details for a set of ids (batched) — to render the in-range list. */
export async function fetchProductsByIds(
  client: CtClient,
  ids: string[]
): Promise<CatalogProduct[]> {
  const out: CatalogProduct[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const where = encodeURIComponent(`id in (${batch.map((id) => `"${id}"`).join(',')})`);
    const data = await client.get<CtPagedQueryResponse<ProductProjection>>(
      `/product-projections?where=${where}&limit=100&staged=false`
    );
    out.push(...data.results.map(toCatalogProduct));
  }
  return out;
}

/** All products in a single category (small sets, e.g. the `local` category). */
export async function fetchProductsByCategoryId(
  client: CtClient,
  categoryId: string
): Promise<CatalogProduct[]> {
  const where = encodeURIComponent(`categories(id="${categoryId}")`);
  const data = await client.get<CtPagedQueryResponse<ProductProjection>>(
    `/product-projections?where=${where}&limit=200&staged=false`
  );
  return data.results.map(toCatalogProduct);
}

// ---- product selection assignments ----
interface SelectionProductAssignment {
  product: { id: string };
}

/** ALL product ids assigned to a store's selection (paginated). */
export async function fetchSelectionProductIds(
  client: CtClient,
  selectionKey: string
): Promise<Set<string>> {
  const ids = new Set<string>();
  const PAGE = 500;
  let offset = 0;
  try {
    for (let i = 0; i < 40; i++) {
      const data = await client.get<CtPagedQueryResponse<SelectionProductAssignment>>(
        `/product-selections/key=${selectionKey}/products?limit=${PAGE}&offset=${offset}`
      );
      data.results.forEach((a) => ids.add(a.product.id));
      offset += PAGE;
      if (offset >= data.total || data.results.length === 0) break;
    }
  } catch {
    /* selection may not exist yet */
  }
  return ids;
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
