import Text from '@commercetools-uikit/text';
import { TIER_COLORS, TIER_LABELS, LIFECYCLE_COLORS } from '../lib/banners';
import type { StoreData, ProgrammeTierKey, LifecycleState } from '../lib/types';

interface Segment {
  key: string;
  label: string;
  count: number;
  color: string;
}

function MiniBar({ title, segments }: { title: string; segments: Segment[] }) {
  const total = segments.reduce((s, seg) => s + seg.count, 0) || 1;
  const present = segments.filter((s) => s.count > 0);
  return (
    <div style={{ minWidth: 200, flex: 1 }}>
      <Text.Detail tone="secondary">{title}</Text.Detail>
      <div
        style={{
          display: 'flex',
          height: 10,
          borderRadius: 6,
          overflow: 'hidden',
          margin: '6px 0',
          background: '#eef1f5',
        }}
      >
        {present.map((seg) => (
          <div
            key={seg.key}
            title={`${seg.label}: ${seg.count}`}
            style={{ width: `${(seg.count / total) * 100}%`, background: seg.color }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
        {present.map((seg) => (
          <span key={seg.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, display: 'inline-block' }}
            />
            <Text.Detail tone="secondary">
              {seg.label} {seg.count}
            </Text.Detail>
          </span>
        ))}
      </div>
    </div>
  );
}

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ minWidth: 96 }}>
      <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.05, color: '#1a1a1a' }}>{value}</div>
      <Text.Detail tone="secondary">{label}</Text.Detail>
    </div>
  );
}

export default function KpiBand({
  stores,
  ownerCount,
}: {
  stores: StoreData[];
  ownerCount: number;
}) {
  const active = stores.filter((s) => s.custom?.fields.lifecycle_state === 'ACTIVE').length;
  const bannerCount = new Set(stores.map((s) => s.custom?.fields.banner).filter(Boolean)).size;

  const tierSegments: Segment[] = (Object.keys(TIER_LABELS) as ProgrammeTierKey[]).map((k) => ({
    key: k,
    label: TIER_LABELS[k],
    count: stores.filter((s) => s.custom?.fields.programme_tier === k).length,
    color: TIER_COLORS[k],
  }));

  const lifecycleOrder: LifecycleState[] = ['ACTIVE', 'DRAFT', 'SUSPENDED', 'OFFBOARDED'];
  const lifecycleSegments: Segment[] = lifecycleOrder.map((k) => ({
    key: k,
    label: k.charAt(0) + k.slice(1).toLowerCase(),
    count: stores.filter((s) => (s.custom?.fields.lifecycle_state ?? 'DRAFT') === k).length,
    color: LIFECYCLE_COLORS[k],
  }));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        flexWrap: 'wrap',
        padding: '20px 24px',
        background: '#ffffff',
        border: '1px solid #e3e7ee',
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
      }}
    >
      <div style={{ display: 'flex', gap: 28 }}>
        <StatTile value={ownerCount} label="Franchisee owners" />
        <StatTile value={stores.length} label="Stores" />
        <StatTile value={`${active}/${stores.length}`} label="Active" />
        <StatTile value={bannerCount} label="Banners" />
      </div>
      <div style={{ display: 'flex', gap: 28, flex: 1, minWidth: 320 }}>
        <MiniBar title="Programme tier mix" segments={tierSegments} />
        <MiniBar title="Lifecycle mix" segments={lifecycleSegments} />
      </div>
    </div>
  );
}
