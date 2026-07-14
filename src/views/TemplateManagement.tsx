import { useState } from 'react';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import Card from '@commercetools-uikit/card';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import CheckboxInput from '@commercetools-uikit/checkbox-input';
import TextInput from '@commercetools-uikit/text-input';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { useIsAuthorized } from '@commercetools-frontend/permissions';
import { useNetwork } from '../hooks/useNetwork';
import { useCtClient, type CtClient } from '../lib/ctClient';
import { updateTierTemplate } from '../lib/ctWrites';
import { PERMISSIONS } from '../constants';
import { TIER_COLORS, PILLAR_LABELS } from '../lib/banners';
import FeatureUnlocks from '../components/FeatureUnlocks';
import type {
  ProgrammeTierObject,
  ProgrammeTierKey,
  TierFeatures,
  Pillar,
} from '../lib/types';

const TIER_ORDER: ProgrammeTierKey[] = ['STANDARD', 'DIGITAL_PLUS', 'TRADE_ENABLED', 'PILOT'];
const PILLARS: Pillar[] = ['food', 'liquor', 'hardware'];

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

function TierCard({
  tier,
  storeCount,
  canManage,
  client,
  onSaved,
}: {
  tier: ProgrammeTierObject;
  storeCount: number;
  canManage: boolean;
  client: CtClient;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [label, setLabel] = useState(tier.value.label);
  const [pillars, setPillars] = useState<Set<Pillar>>(new Set(tier.value.allowedPillars));
  const [features, setFeatures] = useState<TierFeatures>({ ...tier.value.features });

  const startEdit = () => {
    setLabel(tier.value.label);
    setPillars(new Set(tier.value.allowedPillars));
    setFeatures({ ...tier.value.features });
    setFlash(null);
    setEditing(true);
  };

  const togglePillar = (p: Pillar) => {
    const next = new Set(pillars);
    next.has(p) ? next.delete(p) : next.add(p);
    setPillars(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setFlash(null);
    try {
      await updateTierTemplate(client, tier.key, {
        label: label.trim() || tier.value.label,
        allowedPillars: PILLARS.filter((p) => pillars.has(p)),
        features,
      });
      setEditing(false);
      setFlash(`Saved — capabilities updated for ${storeCount} store${storeCount === 1 ? '' : 's'} on this tier.`);
      onSaved();
    } catch (e) {
      setFlash(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div style={{ borderTop: `4px solid ${TIER_COLORS[tier.key]}`, margin: '-16px -16px 12px', borderRadius: '6px 6px 0 0' }} />
      <Spacings.Stack scale="m">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {editing ? (
              <div style={{ width: 220 }}>
                <TextInput value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
            ) : (
              <Text.Subheadline as="h4">{tier.value.label}</Text.Subheadline>
            )}
            <Text.Detail tone="secondary">
              <code>{tier.key}</code> · governs {storeCount} store{storeCount === 1 ? '' : 's'}
            </Text.Detail>
          </div>
          {canManage &&
            (editing ? (
              <Spacings.Inline scale="xs">
                <PrimaryButton label="Save" onClick={handleSave} isDisabled={saving} />
                <SecondaryButton label="Cancel" onClick={() => setEditing(false)} isDisabled={saving} />
              </Spacings.Inline>
            ) : (
              <SecondaryButton label="Edit" onClick={startEdit} />
            ))}
        </div>

        {flash && <Text.Detail tone="secondary">{flash}</Text.Detail>}

        {/* allowed pillars */}
        <Spacings.Stack scale="xs">
          <Text.Detail isBold>Allowed pillars</Text.Detail>
          {editing ? (
            <Spacings.Inline scale="m">
              {PILLARS.map((p) => (
                <CheckboxInput key={p} isChecked={pillars.has(p)} onChange={() => togglePillar(p)}>
                  {PILLAR_LABELS[p]}
                </CheckboxInput>
              ))}
            </Spacings.Inline>
          ) : (
            <Text.Body>
              {tier.value.allowedPillars.map((p) => PILLAR_LABELS[p]).join(', ') || '—'}
            </Text.Body>
          )}
        </Spacings.Stack>

        {/* features */}
        <Spacings.Stack scale="xs">
          <Text.Detail isBold>Capabilities</Text.Detail>
          {editing ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {FEATURE_LABELS.map(({ key, label: fl }) => (
                <CheckboxInput
                  key={key}
                  isChecked={features[key]}
                  onChange={() => setFeatures({ ...features, [key]: !features[key] })}
                >
                  {fl}
                </CheckboxInput>
              ))}
            </div>
          ) : (
            <FeatureUnlocks features={tier.value.features} />
          )}
        </Spacings.Stack>
      </Spacings.Stack>
    </Card>
  );
}

export default function TemplateManagement() {
  const client = useCtClient();
  const { tiers, stores, loading, error, reload } = useNetwork();
  const canManage = useIsAuthorized({ demandedPermissions: [PERMISSIONS.Manage] });

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <LoadingSpinner scale="l">Loading programme templates…</LoadingSpinner>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Text.Body tone="critical">Could not load templates: {error.message}</Text.Body>
      </div>
    );
  }

  const countForTier = (key: ProgrammeTierKey) =>
    stores.filter((s) => s.custom?.fields.programme_tier === key).length;

  const orderedTiers = TIER_ORDER.map((k) => tiers[k]).filter(Boolean);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <Spacings.Stack scale="l">
        <div>
          <Text.Detail tone="secondary">METCASH · HQ GOVERNANCE</Text.Detail>
          <Text.Headline as="h1">Programme templates</Text.Headline>
          <Text.Body tone="secondary">
            Capabilities are defined centrally per tier and resolved by every store on that tier —
            change a flag here and it applies across the network with no rebuild.
          </Text.Body>
        </div>

        {!canManage && (
          <Card theme="dark" insetScale="s">
            <Text.Body>
              View only — editing templates requires the <b>Manage</b> permission for this app.
            </Text.Body>
          </Card>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 16, alignItems: 'start' }}>
          {orderedTiers.map((t) => (
            <TierCard
              key={t.key}
              tier={t}
              storeCount={countForTier(t.key)}
              canManage={canManage}
              client={client}
              onSaved={reload}
            />
          ))}
        </div>
      </Spacings.Stack>
    </div>
  );
}
