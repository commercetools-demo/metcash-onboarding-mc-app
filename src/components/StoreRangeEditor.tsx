import { useEffect, useState } from 'react';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import PrimaryButton from '@commercetools-uikit/primary-button';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { useCtClient } from '../lib/ctClient';
import { selectionKey } from '../lib/ctWrites';
import {
  fetchProductTypeIdForPillar,
  fetchCategories,
  fetchSelectionProductIds,
  setSelectionProducts,
} from '../lib/catalog';
import { bannerMeta } from '../lib/banners';
import CatalogEditor from './CatalogEditor';
import type { CategoryLite, Pillar } from '../lib/types';

/** Categories relevant to a pillar (pillar-prefixed keys) plus the shared `local` category. */
function categoriesForPillar(cats: CategoryLite[], pillar?: Pillar): CategoryLite[] {
  if (!pillar) return cats;
  return cats.filter((c) => c.key && (c.key.startsWith(pillar) || c.key === 'local'));
}

/**
 * Self-contained range editor for an EXISTING store: resolves the pillar catalogue, loads the
 * store's current selection, lets HQ search/curate (or carry the full range), and saves the diff.
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

  const [productTypeId, setProductTypeId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryLite[]>([]);
  const [inRange, setInRange] = useState<Set<string>>(new Set());
  const [baseline, setBaseline] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const pillar = bannerMeta(banner)?.pillar as Pillar | undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [ptId, cats, current] = await Promise.all([
          pillar ? fetchProductTypeIdForPillar(client, pillar) : Promise.resolve(null),
          fetchCategories(client),
          fetchSelectionProductIds(client, selectionKey(storeKey)),
        ]);
        if (cancelled) return;
        setProductTypeId(ptId);
        setCategories(cats);
        setInRange(new Set(current));
        setBaseline(new Set(current));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [client, storeKey, pillar]);

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

  if (loading) return <LoadingSpinner scale="s">Loading catalogue…</LoadingSpinner>;
  if (error) return <Text.Body tone="critical">{error}</Text.Body>;

  return (
    <Spacings.Stack scale="s">
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        {flash && <Text.Detail tone="secondary">{flash}</Text.Detail>}
        <PrimaryButton
          label={dirty ? `Save range (${inRange.size})` : 'Saved'}
          onClick={handleSave}
          isDisabled={!dirty || saving}
        />
      </div>
      <CatalogEditor
        productTypeId={productTypeId}
        categories={categoriesForPillar(categories, pillar)}
        inRange={inRange}
        onChange={setInRange}
        localCategoryId={categories.find((c) => c.key === 'local')?.id}
      />
    </Spacings.Stack>
  );
}
