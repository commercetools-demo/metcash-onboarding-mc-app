import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import { CheckBoldIcon, CloseBoldIcon } from '@commercetools-uikit/icons';
import type { TierFeatures } from '../lib/types';

const FEATURE_LABELS: { key: keyof TierFeatures; label: string }[] = [
  { key: 'search', label: 'Search' },
  { key: 'clickCollect', label: 'Click & Collect' },
  { key: 'rapidDelivery', label: 'Rapid Delivery' },
  { key: 'personalisation', label: 'Personalisation' },
  { key: 'loyaltyEarnBurn', label: 'Loyalty Earn/Burn' },
  { key: 'b2bTrade', label: 'B2B Trade' },
  { key: 'jobCodes', label: 'Job Codes' },
  { key: 'accountingExport', label: 'Accounting Export' },
];

/**
 * Shows exactly what a programme tier unlocks, read live from the programme-tiers
 * custom object (never hardcoded) — the "what this template turns on" preview.
 */
export default function FeatureUnlocks({ features }: { features: TierFeatures }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 8,
      }}
    >
      {FEATURE_LABELS.map(({ key, label }) => {
        const on = features[key];
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: on ? '#b3e0c4' : '#e3e7ee',
              background: on ? '#f0faf3' : '#f7f8fa',
              opacity: on ? 1 : 0.6,
            }}
          >
            <span style={{ color: on ? '#0b8043' : '#aab2c0', display: 'flex' }}>
              {on ? <CheckBoldIcon size="small" /> : <CloseBoldIcon size="small" />}
            </span>
            <Text.Detail tone={on ? undefined : 'secondary'}>{label}</Text.Detail>
          </div>
        );
      })}
    </div>
  );
}
