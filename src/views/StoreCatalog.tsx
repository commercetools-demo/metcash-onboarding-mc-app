import { useEffect, useState } from 'react';
import { useParams, useHistory, useRouteMatch } from 'react-router-dom';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import Card from '@commercetools-uikit/card';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
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
import BannerLogo from '../components/BannerLogo';
import CatalogEditor from '../components/CatalogEditor';
import type { StoreData, CatalogProduct, CategoryLite, Pillar } from '../lib/types';

function storeName(s: StoreData): string {
  return s.name?.['en-AU'] ?? s.name?.['en'] ?? s.key;
}

export default function StoreCatalog() {
  const { storeKey } = useParams<{ storeKey: string }>();
  const history = useHistory();
  const match = useRouteMatch();
  const base = match.url.replace(/\/network\/store\/.*$/, '');
  const client = useCtClient();

  const [store, setStore] = useState<StoreData | null>(null);
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
        const s = await client.get<StoreData>(`/stores/key=${storeKey}`);
        if (cancelled) return;
        setStore(s);
        const pillar = bannerMeta(s.custom?.fields.banner)?.pillar as Pillar | undefined;
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
  }, [client, storeKey]);

  const dirty =
    inRange.size !== baseline.size || [...inRange].some((id) => !baseline.has(id));

  const handleSave = async () => {
    setSaving(true);
    setFlash(null);
    try {
      const r = await setSelectionProducts(client, selectionKey(storeKey), [...inRange], baseline);
      setBaseline(new Set(inRange));
      setFlash(`Range updated — ${r.added} added, ${r.removed} removed. Live in the storefront now.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <LoadingSpinner scale="l">Loading catalogue…</LoadingSpinner>
      </div>
    );
  }
  if (error || !store) {
    return (
      <div style={{ padding: 24 }}>
        <Spacings.Stack scale="s">
          <Text.Body tone="critical">{error ?? 'Store not found'}</Text.Body>
          <SecondaryButton label="Back" onClick={() => history.push(`${base}/network/store/${storeKey}`)} />
        </Spacings.Stack>
      </div>
    );
  }

  const f = store.custom?.fields ?? {};

  return (
    <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto' }}>
      <Spacings.Stack scale="l">
        <SecondaryButton label="← Store" onClick={() => history.push(`${base}/network/store/${storeKey}`)} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
          <div>
            <Spacings.Inline alignItems="center" scale="s">
              <Text.Headline as="h1">Manage range</Text.Headline>
              <BannerLogo banner={f.banner} height={22} />
            </Spacings.Inline>
            <Text.Detail tone="secondary">
              {storeName(store)} · <code>{selectionKey(storeKey)}</code>
            </Text.Detail>
          </div>
          <Spacings.Inline scale="s">
            {flash && <Text.Detail tone="secondary">{flash}</Text.Detail>}
            <PrimaryButton
              label={dirty ? `Save range (${inRange.size})` : 'Saved'}
              onClick={handleSave}
              isDisabled={!dirty || saving}
            />
          </Spacings.Inline>
        </div>

        <Card>
          <CatalogEditor
            products={products}
            categories={categories}
            inRange={inRange}
            onChange={setInRange}
            localCategoryId={categories.find((c) => c.key === 'local')?.id}
          />
        </Card>
      </Spacings.Stack>
    </div>
  );
}
