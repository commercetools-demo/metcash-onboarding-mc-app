import { useEffect, useState } from 'react';
import { useParams, useHistory, useRouteMatch } from 'react-router-dom';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import Card from '@commercetools-uikit/card';
import Stamp from '@commercetools-uikit/stamp';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import TextInput from '@commercetools-uikit/text-input';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { PlusBoldIcon } from '@commercetools-uikit/icons';
import { useNetwork } from '../hooks/useNetwork';
import { useCtClient } from '../lib/ctClient';
import { upsertOwner } from '../lib/ctWrites';
import { initials } from '../lib/conventions';
import { bannerMeta, TIER_LABELS, LIFECYCLE_TONE } from '../lib/banners';
import BannerLogo from '../components/BannerLogo';
import type { StoreData, BannerKey, LifecycleState } from '../lib/types';

function storeName(s: StoreData): string {
  return s.name?.['en-AU'] ?? s.name?.['en'] ?? s.key;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Spacings.Stack scale="xs">
      <Text.Detail isBold>{label}</Text.Detail>
      {children}
    </Spacings.Stack>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Text.Detail tone="secondary">{label}</Text.Detail>
      <Text.Body>{value || '—'}</Text.Body>
    </div>
  );
}

export default function OwnerView() {
  const { ownerKey } = useParams<{ ownerKey: string }>();
  const history = useHistory();
  const match = useRouteMatch();
  const base = match.url.replace(/\/network\/owner\/.*$/, '');
  const client = useCtClient();
  const { owners, groups, loading, error, reload } = useNetwork();

  const owner = owners.find((o) => o.key === ownerKey);
  const stores = groups.find((g) => g.owner.key === ownerKey)?.stores ?? [];

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: '',
    abn: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  useEffect(() => {
    if (owner) {
      setForm({
        displayName: owner.value.displayName ?? '',
        abn: owner.value.abn ?? '',
        contactName: owner.value.primaryContact?.name ?? '',
        contactEmail: owner.value.primaryContact?.email ?? '',
        contactPhone: owner.value.primaryContact?.phone ?? '',
      });
    }
  }, [owner]);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <LoadingSpinner scale="l">Loading owner…</LoadingSpinner>
      </div>
    );
  }
  if (error || !owner) {
    return (
      <div style={{ padding: 24 }}>
        <Spacings.Stack scale="s">
          <Text.Body tone="critical">{error?.message ?? 'Owner not found'}</Text.Body>
          <SecondaryButton label="Back to network" onClick={() => history.push(`${base}/network`)} />
        </Spacings.Stack>
      </div>
    );
  }

  const perBanner = new Map<BannerKey, number>();
  const states = new Set<string>();
  for (const s of stores) {
    const b = s.custom?.fields.banner as BannerKey | undefined;
    if (b) perBanner.set(b, (perBanner.get(b) ?? 0) + 1);
    if (s.custom?.fields.state) states.add(s.custom.fields.state);
  }
  const multiBanner = perBanner.size > 1;

  const handleSave = async () => {
    setSaving(true);
    setFlash(null);
    try {
      await upsertOwner(client, owner.key, {
        displayName: form.displayName.trim(),
        abn: form.abn.trim(),
        primaryContact: {
          name: form.contactName.trim(),
          email: form.contactEmail.trim(),
          phone: form.contactPhone.trim(),
        },
        stores: owner.value.stores ?? [],
      });
      setEditing(false);
      setFlash('Owner details saved.');
      reload();
    } catch (e) {
      setFlash(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onboardForOwner = () => history.push(`${base}/onboard?owner=${owner.key}`);

  return (
    <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto' }}>
      <Spacings.Stack scale="l">
        <SecondaryButton label="← Network" onClick={() => history.push(`${base}/network`)} />

        {/* identity header */}
        <Card>
          <Spacings.Stack scale="m">
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg,#1f2a44,#3a4d78)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {initials(owner.value.displayName)}
              </div>
              <div style={{ flex: 1 }}>
                <Spacings.Inline alignItems="center" scale="s">
                  <Text.Headline as="h1">{owner.value.displayName}</Text.Headline>
                  {multiBanner && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#7a4d00',
                        background: '#fdefc9',
                        border: '1px solid #f4d78a',
                        borderRadius: 999,
                        padding: '2px 10px',
                      }}
                    >
                      ★ Multi-banner
                    </span>
                  )}
                </Spacings.Inline>
                <Text.Detail tone="secondary">
                  {stores.length} store{stores.length === 1 ? '' : 's'} · {perBanner.size} banner
                  {perBanner.size === 1 ? '' : 's'}
                  {states.size ? ` · ${[...states].join('/')}` : ''}
                </Text.Detail>
              </div>
              <Spacings.Inline scale="s">
                {!editing && <SecondaryButton label="Edit details" onClick={() => setEditing(true)} />}
                <PrimaryButton
                  iconLeft={<PlusBoldIcon />}
                  label="Onboard another store"
                  onClick={onboardForOwner}
                />
              </Spacings.Inline>
            </div>

            {flash && <Text.Detail tone="secondary">{flash}</Text.Detail>}

            {editing ? (
              <Spacings.Stack scale="s">
                <Field label="Trading name">
                  <TextInput value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
                </Field>
                <Spacings.Inline scale="s">
                  <div style={{ flex: 1 }}>
                    <Field label="ABN">
                      <TextInput value={form.abn} onChange={(e) => setForm({ ...form, abn: e.target.value })} />
                    </Field>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Field label="Primary contact">
                      <TextInput value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                    </Field>
                  </div>
                </Spacings.Inline>
                <Spacings.Inline scale="s">
                  <div style={{ flex: 1 }}>
                    <Field label="Email">
                      <TextInput value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                    </Field>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Field label="Phone">
                      <TextInput value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                    </Field>
                  </div>
                </Spacings.Inline>
                <Spacings.Inline scale="s">
                  <PrimaryButton label="Save" onClick={handleSave} isDisabled={saving || form.displayName.trim().length < 2} />
                  <SecondaryButton label="Cancel" onClick={() => setEditing(false)} isDisabled={saving} />
                </Spacings.Inline>
              </Spacings.Stack>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <InfoRow label="ABN" value={owner.value.abn} />
                <InfoRow label="Primary contact" value={owner.value.primaryContact?.name} />
                <InfoRow label="Email" value={owner.value.primaryContact?.email} />
                <InfoRow label="Phone" value={owner.value.primaryContact?.phone} />
              </div>
            )}

            {/* banner footprint */}
            {perBanner.size > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {[...perBanner.entries()].map(([b, count]) => (
                  <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <BannerLogo banner={b} height={22} />
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
            )}
          </Spacings.Stack>
        </Card>

        {/* stores across banners */}
        <Spacings.Stack scale="s">
          <Text.Subheadline as="h4">Stores across all banners</Text.Subheadline>
          {stores.length === 0 ? (
            <Card>
              <Spacings.Stack scale="s">
                <Text.Body tone="secondary">
                  This owner has no stores yet. Onboard their first store to get started.
                </Text.Body>
                <div>
                  <PrimaryButton iconLeft={<PlusBoldIcon />} label="Onboard a store" onClick={onboardForOwner} />
                </div>
              </Spacings.Stack>
            </Card>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 12,
              }}
            >
              {stores.map((s) => {
                const f = s.custom?.fields ?? {};
                const lc = (f.lifecycle_state ?? 'DRAFT') as LifecycleState;
                const meta = bannerMeta(f.banner);
                return (
                  <div
                    key={s.key}
                    onClick={() => history.push(`${base}/network/store/${s.key}`)}
                    style={{
                      border: '1px solid #e3e7ee',
                      borderLeft: `4px solid ${meta?.color ?? '#9aa4b2'}`,
                      borderRadius: 10,
                      background: '#fff',
                      padding: 14,
                      cursor: 'pointer',
                    }}
                  >
                    <Spacings.Stack scale="xs">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <BannerLogo banner={f.banner} height={18} />
                        <Stamp isCondensed tone={LIFECYCLE_TONE[lc]} label={lc} />
                      </div>
                      <Text.Body isBold>{storeName(s)}</Text.Body>
                      <Text.Detail tone="secondary">
                        {f.suburb ? `${f.suburb}, ` : ''}
                        {f.state ?? ''}
                        {f.programme_tier ? ` · ${TIER_LABELS[f.programme_tier]}` : ''}
                      </Text.Detail>
                    </Spacings.Stack>
                  </div>
                );
              })}
            </div>
          )}
        </Spacings.Stack>
      </Spacings.Stack>
    </div>
  );
}
