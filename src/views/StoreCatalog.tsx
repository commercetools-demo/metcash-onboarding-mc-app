import { useEffect, useState } from 'react';
import { useParams, useHistory, useRouteMatch } from 'react-router-dom';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import Card from '@commercetools-uikit/card';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { useCtClient } from '../lib/ctClient';
import BannerLogo from '../components/BannerLogo';
import StoreRangeEditor from '../components/StoreRangeEditor';
import type { StoreData } from '../lib/types';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await client.get<StoreData>(`/stores/key=${storeKey}`);
        if (!cancelled) setStore(s);
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

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <LoadingSpinner scale="l">Loading store…</LoadingSpinner>
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
        <Spacings.Inline alignItems="center" scale="s">
          <Text.Headline as="h1">Manage range</Text.Headline>
          <BannerLogo banner={f.banner} height={22} />
          <Text.Detail tone="secondary">{storeName(store)}</Text.Detail>
        </Spacings.Inline>
        <Card>
          <StoreRangeEditor storeKey={storeKey} banner={f.banner} />
        </Card>
      </Spacings.Stack>
    </div>
  );
}
