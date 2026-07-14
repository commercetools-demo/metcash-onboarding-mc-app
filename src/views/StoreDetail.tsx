import { useEffect, useState, useCallback } from 'react';
import { useParams, useHistory, useRouteMatch } from 'react-router-dom';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import Card from '@commercetools-uikit/card';
import Stamp from '@commercetools-uikit/stamp';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import SelectInput from '@commercetools-uikit/select-input';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { ConfirmationDialog, useModalState } from '@commercetools-frontend/application-components';
import { useCtClient, fetchTiers } from '../lib/ctClient';
import { updateTier, setLifecycle, selectionKey } from '../lib/ctWrites';
import { fetchProductsByPillar, fetchCategories, fetchSelectionProductIds } from '../lib/catalog';
import { BANNERS, TIER_LABELS, LIFECYCLE_TONE, bannerMeta } from '../lib/banners';
import BannerChip from '../components/BannerChip';
import FeatureUnlocks from '../components/FeatureUnlocks';
import type {
  StoreData,
  ProgrammeTierObject,
  ProgrammeTierKey,
  LifecycleState,
  RetailerOwnerObject,
  CatalogProduct,
  Pillar,
} from '../lib/types';

function storeName(s: StoreData): string {
  return s.name?.['en-AU'] ?? s.name?.['en'] ?? Object.values(s.name ?? {})[0] ?? s.key;
}

interface LifecycleAction {
  label: string;
  target: LifecycleState;
  primary?: boolean;
  message: string;
}

function lifecycleActions(state: LifecycleState): LifecycleAction[] {
  switch (state) {
    case 'DRAFT':
      return [{ label: 'Activate', target: 'ACTIVE', primary: true, message: 'Activate this store? It will immediately become visible in the storefront.' }];
    case 'ACTIVE':
      return [
        { label: 'Suspend', target: 'SUSPENDED', message: 'Suspend this store? It will drop out of the storefront but can be reactivated.' },
        { label: 'Off-board', target: 'OFFBOARDED', message: 'Off-board this store? It will be removed from the storefront network.' },
      ];
    case 'SUSPENDED':
      return [
        { label: 'Reactivate', target: 'ACTIVE', primary: true, message: 'Reactivate this store? It will return to the storefront.' },
        { label: 'Off-board', target: 'OFFBOARDED', message: 'Off-board this store? It will be removed from the storefront network.' },
      ];
    case 'OFFBOARDED':
      return [{ label: 'Reactivate', target: 'ACTIVE', primary: true, message: 'Reactivate this off-boarded store? It will return to the storefront.' }];
    default:
      return [];
  }
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Text.Detail tone="secondary">{label}</Text.Detail>
      <Text.Body>{value || '—'}</Text.Body>
    </div>
  );
}

export default function StoreDetail() {
  const { storeKey } = useParams<{ storeKey: string }>();
  const history = useHistory();
  const match = useRouteMatch();
  const base = match.url.replace(/\/network\/store\/.*$/, '');
  const client = useCtClient();
  const confirmModal = useModalState();

  const [store, setStore] = useState<StoreData | null>(null);
  const [tiers, setTiers] = useState<Record<ProgrammeTierKey, ProgrammeTierObject>>(
    {} as Record<ProgrammeTierKey, ProgrammeTierObject>
  );
  const [owner, setOwner] = useState<RetailerOwnerObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const [draftTier, setDraftTier] = useState<ProgrammeTierKey | ''>('');
  const [pendingAction, setPendingAction] = useState<LifecycleAction | null>(null);
  const [localLines, setLocalLines] = useState<CatalogProduct[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await client.get<StoreData>(`/stores/key=${storeKey}`);
      setStore(s);
      setDraftTier((s.custom?.fields.programme_tier as ProgrammeTierKey) ?? '');
      const tierList = await fetchTiers(client);
      const map = {} as Record<ProgrammeTierKey, ProgrammeTierObject>;
      tierList.forEach((t) => (map[t.key] = t));
      setTiers(map);
      const ownerKey = s.custom?.fields.owner_key;
      if (ownerKey) {
        try {
          const o = await client.get<RetailerOwnerObject>(
            `/custom-objects/retailer-owners/${ownerKey}`
          );
          setOwner(o);
        } catch {
          setOwner(null);
        }
      }
      // local/exclusive lines: products in this store's selection tagged `local`
      try {
        const pillar = bannerMeta(s.custom?.fields.banner)?.pillar as Pillar | undefined;
        const [cats, prods, selIds] = await Promise.all([
          fetchCategories(client),
          pillar ? fetchProductsByPillar(client, pillar) : Promise.resolve([]),
          fetchSelectionProductIds(client, selectionKey(storeKey)),
        ]);
        const localCatId = cats.find((c) => c.key === 'local')?.id;
        setLocalLines(
          localCatId
            ? prods.filter((p) => selIds.has(p.id) && p.categoryIds.includes(localCatId))
            : []
        );
      } catch {
        setLocalLines([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [client, storeKey]);

  useEffect(() => {
    load();
  }, [load]);

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
          <SecondaryButton label="Back to network" onClick={() => history.push(`${base}/network`)} />
        </Spacings.Stack>
      </div>
    );
  }

  const f = store.custom?.fields ?? {};
  const lifecycle = (f.lifecycle_state ?? 'DRAFT') as LifecycleState;
  const currentTier = f.programme_tier as ProgrammeTierKey | undefined;
  const previewTier = draftTier ? tiers[draftTier] : undefined;
  const tierChanged = !!draftTier && draftTier !== currentTier;
  const actions = lifecycleActions(lifecycle);

  const handleSaveTier = async () => {
    if (!tierChanged) return;
    setSaving(true);
    setFlash(null);
    try {
      await updateTier(client, store.key, draftTier as ProgrammeTierKey);
      setFlash(`Tier changed to ${TIER_LABELS[draftTier as ProgrammeTierKey]} — capabilities updated with no rebuild.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmLifecycle = (action: LifecycleAction) => {
    setPendingAction(action);
    confirmModal.openModal();
  };

  const handleConfirmLifecycle = async () => {
    if (!pendingAction) return;
    setSaving(true);
    setFlash(null);
    try {
      await setLifecycle(client, store.key, pendingAction.target);
      setFlash(`Lifecycle set to ${pendingAction.target}.`);
      confirmModal.closeModal();
      setPendingAction(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const meta = bannerMeta(f.banner);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <Spacings.Stack scale="l">
        {/* header */}
        <Spacings.Stack scale="xs">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SecondaryButton label="← Network" onClick={() => history.push(`${base}/network`)} />
            <PrimaryButton
              label="Manage range"
              onClick={() => history.push(`${base}/network/store/${store.key}/range`)}
            />
          </div>
          <Spacings.Inline alignItems="center" scale="s">
            <Text.Headline as="h1">{storeName(store)}</Text.Headline>
            <BannerChip banner={f.banner} />
            <Stamp tone={LIFECYCLE_TONE[lifecycle]} label={lifecycle} />
          </Spacings.Inline>
          <Text.Detail tone="secondary">
            <code>{store.key}</code>
            {owner ? ` · ${owner.value.displayName}` : ''}
            {meta ? ` · ${meta.label}` : ''}
          </Text.Detail>
        </Spacings.Stack>

        {flash && (
          <Card theme="dark" insetScale="s">
            <Text.Body>{flash}</Text.Body>
          </Card>
        )}

        {/* tier management (O7) */}
        <Card>
          <Spacings.Stack scale="m">
            <Text.Subheadline as="h4">Programme tier</Text.Subheadline>
            <Spacings.Inline scale="m" alignItems="center">
              <div style={{ minWidth: 260 }}>
                <SelectInput
                  value={draftTier}
                  onChange={(e) => setDraftTier(e.target.value as ProgrammeTierKey)}
                  options={Object.values(tiers).map((t) => ({ value: t.key, label: t.value.label }))}
                />
              </div>
              <PrimaryButton
                label={tierChanged ? 'Save tier change' : 'No changes'}
                onClick={handleSaveTier}
                isDisabled={!tierChanged || saving}
              />
              {currentTier && (
                <Text.Detail tone="secondary">Current: {TIER_LABELS[currentTier]}</Text.Detail>
              )}
            </Spacings.Inline>
            {previewTier && (
              <Spacings.Stack scale="xs">
                <Text.Detail isBold>
                  {tierChanged ? `${previewTier.value.label} would unlock` : `${previewTier.value.label} unlocks`}
                </Text.Detail>
                <FeatureUnlocks features={previewTier.value.features} />
              </Spacings.Stack>
            )}
          </Spacings.Stack>
        </Card>

        {/* lifecycle (O8) */}
        <Card>
          <Spacings.Stack scale="m">
            <Text.Subheadline as="h4">Lifecycle</Text.Subheadline>
            <Text.Body tone="secondary">
              The storefront serves only <b>ACTIVE</b> stores — changes here are visible there
              immediately.
            </Text.Body>
            <Spacings.Inline scale="s">
              {actions.map((a) =>
                a.primary ? (
                  <PrimaryButton
                    key={a.target}
                    label={a.label}
                    onClick={() => confirmLifecycle(a)}
                    isDisabled={saving}
                  />
                ) : (
                  <SecondaryButton
                    key={a.target}
                    label={a.label}
                    onClick={() => confirmLifecycle(a)}
                    isDisabled={saving}
                  />
                )
              )}
            </Spacings.Inline>
          </Spacings.Stack>
        </Card>

        {/* local / exclusive range */}
        {localLines.length > 0 && (
          <Card>
            <Spacings.Stack scale="s">
              <Spacings.Inline alignItems="center" scale="s">
                <Text.Subheadline as="h4">Local &amp; exclusive range</Text.Subheadline>
                <span
                  style={{
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: '#7a4d00',
                    background: '#fdefc9', border: '1px solid #f4d78a', borderRadius: 4, padding: '1px 6px',
                  }}
                >
                  {localLines.length} LOCAL
                </span>
              </Spacings.Inline>
              <Text.Detail tone="secondary">
                Products carried only by this store (not part of the national range).
              </Text.Detail>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {localLines.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', gap: 8,
                      padding: '7px 10px', border: '1px solid #eef1f5', borderRadius: 8,
                    }}
                  >
                    <Text.Detail isBold>{p.name}</Text.Detail>
                    <Text.Detail tone="secondary">{p.sku}</Text.Detail>
                  </div>
                ))}
              </div>
            </Spacings.Stack>
          </Card>
        )}

        {/* details */}
        <Card>
          <Spacings.Stack scale="m">
            <Text.Subheadline as="h4">Configuration</Text.Subheadline>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <InfoRow label="Location" value={`${f.suburb ?? ''}${f.state ? ', ' + f.state : ''} ${f.postcode ?? ''}`} />
              <InfoRow label="Address" value={f.street_address} />
              <InfoRow label="Phone" value={f.phone} />
              <InfoRow label="Rapid delivery" value={f.rapid_delivery_enabled ? 'Enabled' : 'Disabled'} />
              <InfoRow label="Opt-in date" value={f.opt_in_date} />
              <InfoRow label="Activation date" value={f.activation_date} />
              <InfoRow label="Product feed" value={<code>{f.product_feed_ref}</code>} />
              <InfoRow label="Pricing feed" value={<code>{f.pricing_feed_ref}</code>} />
              <InfoRow label="Inventory feed" value={<code>{f.inventory_feed_ref}</code>} />
              <InfoRow label="Coveo source" value={<code>{f.coveo_source_id}</code>} />
              <InfoRow label="Braze segment" value={<code>{f.braze_segment_id}</code>} />
              <InfoRow label="Owner key" value={<code>{f.owner_key}</code>} />
            </div>
          </Spacings.Stack>
        </Card>
      </Spacings.Stack>

      {pendingAction && (
        <ConfirmationDialog
          title={`${pendingAction.label} store`}
          isOpen={confirmModal.isModalOpen}
          onClose={() => {
            confirmModal.closeModal();
            setPendingAction(null);
          }}
          onCancel={() => {
            confirmModal.closeModal();
            setPendingAction(null);
          }}
          onConfirm={handleConfirmLifecycle}
          labelPrimary={pendingAction.label}
          labelSecondary="Cancel"
        >
          <Text.Body>{pendingAction.message}</Text.Body>
        </ConfirmationDialog>
      )}
    </div>
  );
}
