import Text from '@commercetools-uikit/text';
import { bannerMeta } from '../lib/banners';
import { initials } from '../lib/conventions';
import BannerLogo from './BannerLogo';
import type { StoreData, RetailerOwnerObject, BannerKey } from '../lib/types';

interface Props {
  owner: RetailerOwnerObject;
  stores: StoreData[];
  onOpenOwner: (key: string) => void;
  onOpenStore: (key: string) => void;
}

export default function OwnerCard({ owner, stores, onOpenOwner, onOpenStore }: Props) {
  // count stores per banner
  const perBanner = new Map<BannerKey, number>();
  const states = new Set<string>();
  const pillars = new Set<string>();
  for (const s of stores) {
    const b = s.custom?.fields.banner as BannerKey | undefined;
    if (b) perBanner.set(b, (perBanner.get(b) ?? 0) + 1);
    const st = s.custom?.fields.state;
    if (st) states.add(st);
    const pillar = bannerMeta(b)?.pillar;
    if (pillar) pillars.add(pillar);
  }
  const multiBanner = perBanner.size > 1;

  return (
    <div
      style={{
        border: '1px solid #e3e7ee',
        borderRadius: 12,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* header */}
      <div
        onClick={() => onOpenOwner(owner.key)}
        style={{
          display: 'flex',
          gap: 12,
          padding: 16,
          cursor: 'pointer',
          borderBottom: '1px solid #f0f2f6',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'linear-gradient(135deg,#1f2a44,#3a4d78)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {initials(owner.value.displayName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text.Subheadline as="h4">{owner.value.displayName}</Text.Subheadline>
            {multiBanner && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#7a4d00',
                  background: '#fdefc9',
                  border: '1px solid #f4d78a',
                  borderRadius: 999,
                  padding: '2px 8px',
                }}
              >
                ★ Multi-banner
              </span>
            )}
          </div>
          <Text.Detail tone="secondary">
            ABN {owner.value.abn} · {owner.value.primaryContact?.name}
          </Text.Detail>
          <div style={{ marginTop: 4 }}>
            <Text.Detail tone="secondary">
              {stores.length} store{stores.length === 1 ? '' : 's'} · {perBanner.size} banner
              {perBanner.size === 1 ? '' : 's'}
              {states.size ? ` · ${[...states].join('/')}` : ''}
            </Text.Detail>
          </div>
        </div>
      </div>

      {/* banner footprint */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[...perBanner.entries()].map(([b, count]) => (
          <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <BannerLogo banner={b} height={20} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#475467',
                background: '#f2f4f8',
                borderRadius: 6,
                padding: '1px 6px',
              }}
            >
              {count}
            </span>
          </span>
        ))}
      </div>

      {/* store chips */}
      <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {stores.map((s) => {
          const f = s.custom?.fields ?? {};
          const name = s.name?.['en-AU'] ?? s.name?.['en'] ?? s.key;
          const lc = f.lifecycle_state ?? 'DRAFT';
          const meta = bannerMeta(f.banner);
          return (
            <div
              key={s.key}
              onClick={() => onOpenStore(s.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 8,
                border: '1px solid #eef1f5',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: meta?.color ?? '#9aa4b2',
                    flexShrink: 0,
                  }}
                />
                <Text.Detail>{name}</Text.Detail>
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  color: lc === 'ACTIVE' ? '#0b8043' : '#67728a',
                }}
              >
                {lc}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
