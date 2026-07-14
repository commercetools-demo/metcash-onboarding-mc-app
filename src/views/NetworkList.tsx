import { useMemo, useState } from 'react';
import { useHistory, useRouteMatch } from 'react-router-dom';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SelectInput from '@commercetools-uikit/select-input';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { PlusBoldIcon } from '@commercetools-uikit/icons';
import { useNetwork } from '../hooks/useNetwork';
import KpiBand from '../components/KpiBand';
import OwnerCard from '../components/OwnerCard';
import StoresTable, { toRow } from '../components/StoresTable';
import { BANNERS, PILLAR_LABELS, TIER_LABELS, bannerMeta } from '../lib/banners';
import type { StoreData, BannerKey, Pillar, ProgrammeTierKey, LifecycleState } from '../lib/types';

type ViewMode = 'owner' | 'stores';

const ALL = '__all__';

function matchesStore(
  s: StoreData,
  filters: { pillar: string; banner: string; tier: string; lifecycle: string; q: string },
  ownerName: string
): boolean {
  const f = s.custom?.fields ?? {};
  if (filters.pillar !== ALL && bannerMeta(f.banner)?.pillar !== filters.pillar) return false;
  if (filters.banner !== ALL && f.banner !== filters.banner) return false;
  if (filters.tier !== ALL && f.programme_tier !== filters.tier) return false;
  if (filters.lifecycle !== ALL && (f.lifecycle_state ?? 'DRAFT') !== filters.lifecycle) return false;
  if (filters.q) {
    const hay = [
      s.key,
      s.name?.['en-AU'],
      f.suburb,
      f.state,
      f.postcode,
      ownerName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!hay.includes(filters.q.toLowerCase())) return false;
  }
  return true;
}

export default function NetworkList() {
  const { groups, unassigned, stores, owners, loading, error, reload } = useNetwork();
  const history = useHistory();
  const match = useRouteMatch();
  const base = match.url.replace(/\/network$/, '');

  const [view, setView] = useState<ViewMode>('owner');
  const [q, setQ] = useState('');
  const [pillar, setPillar] = useState(ALL);
  const [banner, setBanner] = useState(ALL);
  const [tier, setTier] = useState(ALL);
  const [lifecycle, setLifecycle] = useState(ALL);

  const openOwner = (key: string) => history.push(`${base}/network/owner/${key}`);
  const openStore = (key: string) => history.push(`${base}/network/store/${key}`);
  const openOnboard = () => history.push(`${base}/onboard`);

  const ownerNameByStoreKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) for (const s of g.stores) map.set(s.key, g.owner.value.displayName);
    return map;
  }, [groups]);

  const filters = { pillar, banner, tier, lifecycle, q };

  // filtered owner groups (owner shown if any of its stores match; only matching stores rendered)
  const filteredGroups = useMemo(() => {
    return groups
      .map((g) => ({
        owner: g.owner,
        stores: g.stores.filter((s) => matchesStore(s, filters, g.owner.value.displayName)),
      }))
      .filter((g) => g.stores.length > 0)
      // multi-banner owners first, then by store count
      .sort((a, b) => {
        const ab = new Set(a.stores.map((s) => s.custom?.fields.banner)).size;
        const bb = new Set(b.stores.map((s) => s.custom?.fields.banner)).size;
        if (bb !== ab) return bb - ab;
        return b.stores.length - a.stores.length;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, pillar, banner, tier, lifecycle, q]);

  const filteredStoreRows = useMemo(() => {
    const rows = stores
      .filter((s) => matchesStore(s, filters, ownerNameByStoreKey.get(s.key) ?? ''))
      .map((s) => toRow(s, ownerNameByStoreKey.get(s.key) ?? '—'));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores, ownerNameByStoreKey, pillar, banner, tier, lifecycle, q]);

  const shownStoreCount =
    view === 'owner'
      ? filteredGroups.reduce((n, g) => n + g.stores.length, 0)
      : filteredStoreRows.length;

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <LoadingSpinner scale="l">Loading the retailer network…</LoadingSpinner>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <Spacings.Stack scale="s">
          <Text.Headline as="h1">Retailer Network</Text.Headline>
          <Text.Body tone="critical">
            {error.message === 'permission'
              ? 'You do not have permission to view stores/custom objects in this project.'
              : `Could not load the network: ${error.message}`}
          </Text.Body>
          <div>
            <PrimaryButton label="Retry" onClick={reload} />
          </div>
        </Spacings.Stack>
      </div>
    );
  }

  const bannerOptions = [
    { value: ALL, label: 'All banners' },
    ...Object.values(BANNERS).map((b) => ({ value: b.key, label: b.label })),
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', background: '#f7f8fa' }}>
      <Spacings.Stack scale="l">
        {/* hero header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
          <div>
            <Text.Detail tone="secondary">METCASH · OPT-IN RETAILER NETWORK</Text.Detail>
            <Text.Headline as="h1">Retailer Network</Text.Headline>
            <Text.Body tone="secondary">
              Every opted-in Store, grouped by the franchisee that owns it — one operator’s
              cross-banner footprint at a glance.
            </Text.Body>
          </div>
          <PrimaryButton iconLeft={<PlusBoldIcon />} label="Onboard a store" onClick={openOnboard} />
        </div>

        {/* KPI band */}
        <KpiBand stores={stores} ownerCount={owners.length} />

        {/* toolbar: search + filters + view toggle */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '12px 16px',
            background: '#fff',
            border: '1px solid #e3e7ee',
            borderRadius: 12,
          }}
        >
          <div style={{ flex: '1 1 220px', minWidth: 200 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search owner, store, suburb, postcode…"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #c9d0da',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
          <div style={{ width: 150 }}>
            <SelectInput
              value={pillar}
              onChange={(e) => setPillar(e.target.value as string)}
              options={[
                { value: ALL, label: 'All pillars' },
                ...(['food', 'liquor', 'hardware'] as Pillar[]).map((p) => ({ value: p, label: PILLAR_LABELS[p] })),
              ]}
            />
          </div>
          <div style={{ width: 160 }}>
            <SelectInput value={banner} onChange={(e) => setBanner(e.target.value as string)} options={bannerOptions} />
          </div>
          <div style={{ width: 150 }}>
            <SelectInput
              value={tier}
              onChange={(e) => setTier(e.target.value as string)}
              options={[
                { value: ALL, label: 'All tiers' },
                ...(Object.keys(TIER_LABELS) as ProgrammeTierKey[]).map((t) => ({ value: t, label: TIER_LABELS[t] })),
              ]}
            />
          </div>
          <div style={{ width: 150 }}>
            <SelectInput
              value={lifecycle}
              onChange={(e) => setLifecycle(e.target.value as string)}
              options={[
                { value: ALL, label: 'All lifecycle' },
                ...(['ACTIVE', 'DRAFT', 'SUSPENDED', 'OFFBOARDED'] as LifecycleState[]).map((l) => ({
                  value: l,
                  label: l.charAt(0) + l.slice(1).toLowerCase(),
                })),
              ]}
            />
          </div>

          {/* view toggle */}
          <div style={{ display: 'inline-flex', border: '1px solid #c9d0da', borderRadius: 8, overflow: 'hidden' }}>
            {(['owner', 'stores'] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setView(m)}
                style={{
                  border: 'none',
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: view === m ? '#1a1a1a' : '#fff',
                  color: view === m ? '#fff' : '#475467',
                }}
              >
                {m === 'owner' ? 'By owner' : 'All stores'}
              </button>
            ))}
          </div>
        </div>

        <Text.Detail tone="secondary">
          Showing {shownStoreCount} store{shownStoreCount === 1 ? '' : 's'}
          {view === 'owner' ? ` across ${filteredGroups.length} owner${filteredGroups.length === 1 ? '' : 's'}` : ''}
        </Text.Detail>

        {/* content */}
        {view === 'owner' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 16,
              alignItems: 'start',
            }}
          >
            {filteredGroups.map((g) => (
              <OwnerCard
                key={g.owner.key}
                owner={g.owner}
                stores={g.stores}
                onOpenOwner={openOwner}
                onOpenStore={openStore}
              />
            ))}
            {filteredGroups.length === 0 && (
              <Text.Body tone="secondary">No owners match the current filters.</Text.Body>
            )}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e3e7ee', borderRadius: 12, overflow: 'hidden' }}>
            <StoresTable rows={filteredStoreRows} onOpenStore={openStore} />
          </div>
        )}

        {unassigned.length > 0 && view === 'owner' && q === '' && (
          <Text.Detail tone="secondary">
            {unassigned.length} store{unassigned.length === 1 ? '' : 's'} not yet linked to an owner.
          </Text.Detail>
        )}
      </Spacings.Stack>
    </div>
  );
}
