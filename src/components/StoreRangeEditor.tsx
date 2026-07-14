import { useEffect, useState } from 'react';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import PrimaryButton from '@commercetools-uikit/primary-button';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { useCtClient } from '../lib/ctClient';
import { selectionKey } from '../lib/ctWrites';
import {
  fetchProductsByPillar,
  fetchCategories,
  fetchSelectionProductIds,
  setSelectionProducts,
} from '../lib/catalog';
import { bannerMeta } from '../lib/banners';
import CatalogEditor from './CatalogEditor';
import type { CatalogProduct, CategoryLite, Pillar } from '../lib/types';

/**
 * Self-contained range editor for an EXISTING store: loads the pillar catalogue + the store's
 * current selection, lets HQ drag/drop to add/remove, and saves the diff (idempotent).
 * Reused both embedded in the store detail and on the standalone manage-range page.
 */
export default function StoreRangeEditor({
  storeKey,
  banner,
  onSaved,
}: {
  storeKey: string;
  banner?: string;
  onSaved?: () => void;
}) {
  const client = useCtClient();

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CategoryLite[]>([]);
  const [inRange, setInRange] = useState<Set<string>>(new Set());
  const [baseline, setBaseline] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const pillar = bannerMeta(banner)?.pillar as Pillar | undefined;
        const [prods, cats, current] = await Promise.all([
          pillar ? fetchProductsByPillar(client, pillar) : Promise.resolve([]),
          fetchCategories(client),
          fetchSelectionProductIds(client, selectionKey(storeKey)),
        ]);
        if (cancelled) return;
        setProducts(prods);
        setCategories(cats);
        setInRange(new Set(current));
        setBaseline(new Set(current));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, storeKey, banner]);

  const dirty = inRange.size !== baseline.size || [...inRange].some((id) => !baseline.has(id));

  const handleSave = async () => {
    setSaving(true);
    setFlash(null);
    try {
      const r = await setSelectionProducts(client, selectionKey(storeKey), [...inRange], baseline);
      setBaseline(new Set(inRange));
      setFlash(`Range updated — ${r.added} added, ${r.removed} removed. Live in the storefront now.`);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner scale="s">Loading catalogue…</LoadingSpinner>;
  }
  if (error) {
    return <Text.Body tone="critical">{error}</Text.Body>;
  }

  return (
    <Spacings.Stack scale="s">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Text.Detail tone="secondary">
          <code>{selectionKey(storeKey)}</code>
        </Text.Detail>
        <Spacings.Inline alignItems="center" scale="s">
          {flash && <Text.Detail tone="secondary">{flash}</Text.Detail>}
          <PrimaryButton
            label={dirty ? `Save range (${inRange.size})` : 'Saved'}
            onClick={handleSave}
            isDisabled={!dirty || saving}
          />
        </Spacings.Inline>
      </div>
      <CatalogEditor
        products={products}
        categories={categories}
        inRange={inRange}
        onChange={setInRange}
        localCategoryId={categories.find((c) => c.key === 'local')?.id}
      />
    </Spacings.Stack>
  );
}
