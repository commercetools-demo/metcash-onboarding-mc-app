import { useEffect, useMemo, useState } from 'react';
import Text from '@commercetools-uikit/text';
import SelectInput from '@commercetools-uikit/select-input';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import FlatButton from '@commercetools-uikit/flat-button';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { useCtClient } from '../lib/ctClient';
import {
  searchProductsPage,
  fetchAllProductIds,
  fetchProductsByIds,
  countProducts,
} from '../lib/catalog';
import type { CatalogProduct, CategoryLite } from '../lib/types';

const ALL = '__all__';
const PAGE = 24;

function LocalBadge() {
  return (
    <span
      title="Local / exclusive"
      style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', color: '#7a4d00',
        background: '#fdefc9', border: '1px solid #f4d78a', borderRadius: 4, padding: '1px 5px', flexShrink: 0,
      }}
    >
      LOCAL
    </span>
  );
}

function ProductCard({
  product,
  inRange,
  isLocal,
  onToggle,
}: {
  product: CatalogProduct;
  inRange: boolean;
  isLocal: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onToggle(product.id)}
      title={inRange ? 'Click to remove from range' : 'Click to add to range'}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
        border: '1px solid', borderColor: inRange ? '#b3e0c4' : '#e3e7ee',
        background: inRange ? '#f5fbf7' : '#fff', cursor: 'pointer', userSelect: 'none',
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 6, background: '#f2f4f8', flexShrink: 0,
          backgroundImage: product.image ? `url(${product.image})` : undefined,
          backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text.Detail isBold>{product.name}</Text.Detail>
          {isLocal && <LocalBadge />}
        </div>
        <Text.Detail tone="secondary">{product.sku}</Text.Detail>
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color: inRange ? '#0b8043' : '#7a8699' }}>
        {inRange ? '✓ In range' : '+ Add'}
      </span>
    </div>
  );
}

export default function CatalogEditor({
  productTypeId,
  categories,
  localCategoryId,
  inRange,
  onChange,
  totalHint,
}: {
  productTypeId: string | null;
  categories: CategoryLite[];
  localCategoryId?: string;
  inRange: Set<string>;
  onChange: (next: Set<string>) => void;
  totalHint?: number;
}) {
  const client = useCtClient();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [category, setCategory] = useState(ALL);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<'catalogue' | 'inrange'>('catalogue');

  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pillarTotal, setPillarTotal] = useState<number | undefined>(totalHint);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);

  const isLocal = (p: CatalogProduct) => !!localCategoryId && p.categoryIds.includes(localCategoryId);
  const toggle = (id: string) => {
    const next = new Set(inRange);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  };

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // reset to first page when filters change
  useEffect(() => setPage(0), [debouncedQ, category, view]);

  // pillar total (for "full range" label)
  useEffect(() => {
    if (!productTypeId) return;
    if (totalHint != null) { setPillarTotal(totalHint); return; }
    let cancelled = false;
    countProducts(client, { productTypeId }).then((t) => !cancelled && setPillarTotal(t)).catch(() => {});
    return () => { cancelled = true; };
  }, [client, productTypeId, totalHint]);

  // load current page
  useEffect(() => {
    if (!productTypeId) { setResults([]); setTotal(0); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (view === 'inrange') {
          const ids = [...inRange];
          setTotal(ids.length);
          const slice = ids.slice(page * PAGE, page * PAGE + PAGE);
          const details = await fetchProductsByIds(client, slice);
          if (!cancelled) setResults(details);
        } else {
          const { results: r, total: t } = await searchProductsPage(client, {
            productTypeId,
            categoryId: category === ALL ? undefined : category,
            text: debouncedQ,
            limit: PAGE,
            offset: page * PAGE,
          });
          if (!cancelled) { setResults(r); setTotal(t); }
        }
      } catch {
        if (!cancelled) { setResults([]); setTotal(0); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, productTypeId, category, debouncedQ, page, view]);

  const pillarCategories = useMemo(() => categories, [categories]);

  const isFull = pillarTotal != null && pillarTotal > 0 && inRange.size >= pillarTotal;
  const pageCount = Math.max(1, Math.ceil(total / PAGE));

  const carryFull = async () => {
    if (!productTypeId) return;
    setBulkBusy('full');
    try {
      const ids = await fetchAllProductIds(client, { productTypeId });
      onChange(new Set(ids));
    } finally { setBulkBusy(null); }
  };
  const addCategory = async () => {
    if (!productTypeId || category === ALL) return;
    setBulkBusy('category');
    try {
      const ids = await fetchAllProductIds(client, { productTypeId, categoryId: category });
      const next = new Set(inRange);
      ids.forEach((id) => next.add(id));
      onChange(next);
    } finally { setBulkBusy(null); }
  };

  if (!productTypeId) {
    return (
      <Text.Body tone="secondary">
        No catalogue is available for this pillar yet (products arrive via the pillar feed). The
        store can still be provisioned with an empty range.
      </Text.Body>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* summary + range mode / bulk */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 800 }}>{inRange.size}</span>
          <Text.Detail tone="secondary">
            in range{pillarTotal != null ? ` of ${pillarTotal}` : ''}
          </Text.Detail>
          {isFull && (
            <span
              style={{
                fontSize: 11, fontWeight: 800, color: '#0b8043', background: '#e7f6ee',
                border: '1px solid #b3e0c4', borderRadius: 999, padding: '1px 8px',
              }}
            >
              FULL RANGE
            </span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <SecondaryButton
          label={bulkBusy === 'full' ? 'Adding…' : `Carry full national range${pillarTotal ? ` (${pillarTotal})` : ''}`}
          onClick={carryFull}
          isDisabled={!!bulkBusy || isFull}
        />
        <FlatButton
          label="Clear range"
          onClick={() => onChange(new Set())}
          isDisabled={!!bulkBusy || inRange.size === 0}
          tone="secondary"
        />
      </div>

      {/* view toggle */}
      <div style={{ display: 'inline-flex', border: '1px solid #c9d0da', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
        {(['catalogue', 'inrange'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setView(m)}
            style={{
              border: 'none', padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: view === m ? '#1a1a1a' : '#fff', color: view === m ? '#fff' : '#475467',
            }}
          >
            {m === 'catalogue' ? 'Browse catalogue' : `In range (${inRange.size})`}
          </button>
        ))}
      </div>

      {/* filters (catalogue view only) */}
      {view === 'catalogue' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', minWidth: 180 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or SKU…"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #c9d0da', fontSize: 14, outline: 'none' }}
            />
          </div>
          <div style={{ width: 240 }}>
            <SelectInput
              value={category}
              onChange={(e) => setCategory(e.target.value as string)}
              options={[{ value: ALL, label: 'All categories' }, ...pillarCategories.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          {category !== ALL && (
            <SecondaryButton
              label={bulkBusy === 'category' ? 'Adding…' : `Add all in category (${total})`}
              onClick={addCategory}
              isDisabled={!!bulkBusy}
            />
          )}
        </div>
      )}

      {/* results */}
      <div style={{ minHeight: 200 }}>
        {loading ? (
          <div style={{ padding: 24 }}><LoadingSpinner scale="s">Loading products…</LoadingSpinner></div>
        ) : results.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Text.Detail tone="secondary">
              {view === 'inrange' ? 'No products in range yet.' : 'No products match.'}
            </Text.Detail>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {results.map((p) => (
              <ProductCard key={p.id} product={p} inRange={inRange.has(p.id)} isLocal={isLocal(p)} onToggle={toggle} />
            ))}
          </div>
        )}
      </div>

      {/* pagination */}
      {total > PAGE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <FlatButton label="‹ Prev" onClick={() => setPage((p) => Math.max(0, p - 1))} isDisabled={page === 0} />
          <Text.Detail tone="secondary">Page {page + 1} of {pageCount} · {total} products</Text.Detail>
          <FlatButton label="Next ›" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} isDisabled={page >= pageCount - 1} />
        </div>
      )}

      <Text.Detail tone="secondary">
        Click a product to add or remove it. Use search / category to find items fast, or “Carry full
        national range” to include everything.
      </Text.Detail>
    </div>
  );
}
