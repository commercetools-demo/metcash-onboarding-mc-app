import { useState, useMemo } from 'react';
import DataTable from '@commercetools-uikit/data-table';
import Stamp from '@commercetools-uikit/stamp';
import { TIER_LABELS, LIFECYCLE_TONE } from '../lib/banners';
import BannerLogo from './BannerLogo';
import type { StoreData, LifecycleState, ProgrammeTierKey } from '../lib/types';

export interface StoreRow {
  id: string;
  key: string;
  name: string;
  ownerName: string;
  banner?: string;
  tier?: ProgrammeTierKey;
  state?: string;
  suburb?: string;
  lifecycle: LifecycleState;
}

export function toRow(store: StoreData, ownerName: string): StoreRow {
  const f = store.custom?.fields ?? {};
  return {
    id: store.key,
    key: store.key,
    name: store.name?.['en-AU'] ?? store.name?.['en'] ?? store.key,
    ownerName,
    banner: f.banner,
    tier: f.programme_tier,
    state: f.state,
    suburb: f.suburb,
    lifecycle: (f.lifecycle_state ?? 'DRAFT') as LifecycleState,
  };
}

type Dir = 'asc' | 'desc';

export default function StoresTable({
  rows,
  onOpenStore,
}: {
  rows: StoreRow[];
  onOpenStore: (key: string) => void;
}) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDir, setSortDir] = useState<Dir>('asc');

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = String((a as unknown as Record<string, unknown>)[sortBy] ?? '').toLowerCase();
      const bv = String((b as unknown as Record<string, unknown>)[sortBy] ?? '').toLowerCase();
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortBy, sortDir]);

  const columns = [
    { key: 'name', label: 'Store', isSortable: true },
    { key: 'ownerName', label: 'Owner', isSortable: true },
    { key: 'banner', label: 'Banner', isSortable: true },
    { key: 'tier', label: 'Tier', isSortable: true },
    { key: 'suburb', label: 'Suburb', isSortable: true },
    { key: 'state', label: 'State', isSortable: true },
    { key: 'lifecycle', label: 'Lifecycle', isSortable: true },
  ];

  const itemRenderer = (row: StoreRow, column: { key: string }) => {
    switch (column.key) {
      case 'banner':
        return row.banner ? <BannerLogo banner={row.banner} height={18} /> : '—';
      case 'tier':
        return row.tier ? TIER_LABELS[row.tier] : '—';
      case 'lifecycle':
        return <Stamp isCondensed tone={LIFECYCLE_TONE[row.lifecycle]} label={row.lifecycle} />;
      default:
        return (row as unknown as Record<string, string>)[column.key] ?? '—';
    }
  };

  return (
    <DataTable<StoreRow>
      rows={sorted}
      columns={columns}
      itemRenderer={itemRenderer}
      sortedBy={sortBy}
      sortDirection={sortDir}
      onSortChange={(key: string, dir: Dir) => {
        setSortBy(key);
        setSortDir(dir);
      }}
      onRowClick={(row: StoreRow) => onOpenStore(row.key)}
    />
  );
}
