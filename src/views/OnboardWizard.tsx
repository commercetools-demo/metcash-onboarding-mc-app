import { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation, useRouteMatch } from 'react-router-dom';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import Card from '@commercetools-uikit/card';
import Stamp from '@commercetools-uikit/stamp';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import TextInput from '@commercetools-uikit/text-input';
import SelectInput from '@commercetools-uikit/select-input';
import CheckboxInput from '@commercetools-uikit/checkbox-input';
import DateInput from '@commercetools-uikit/date-input';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { CheckBoldIcon } from '@commercetools-uikit/icons';
import { useNetwork } from '../hooks/useNetwork';
import { useCtClient } from '../lib/ctClient';
import {
  provisionStore,
  upsertOwner,
  PROVISION_STEPS,
  type ProvStep,
  type ProvStepId,
  type ProvStepStatus,
} from '../lib/ctWrites';
import {
  makeStoreKey,
  slugify,
  makeCoveoSourceId,
  makeBrazeSegmentId,
  makeProductFeedRef,
  makePricingFeedRef,
  makeInventoryFeedRef,
  AU_STATES,
} from '../lib/conventions';
import { BANNERS, PILLAR_LABELS, TIER_LABELS, bannersForPillar } from '../lib/banners';
import { fetchProductsByPillar, fetchCategories } from '../lib/catalog';
import BannerChip from '../components/BannerChip';
import FeatureUnlocks from '../components/FeatureUnlocks';
import ProvisionProgress from '../components/ProvisionProgress';
import CatalogEditor from '../components/CatalogEditor';
import type {
  BannerKey,
  Pillar,
  ProgrammeTierKey,
  StoreProgrammeFields,
  CatalogProduct,
  CategoryLite,
} from '../lib/types';

const STEPS = ['Owner', 'Banner', 'Store details', 'Programme tier', 'Catalogue', 'Fulfilment & feeds', 'Review'];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Spacings.Stack scale="xs">
      <Text.Detail isBold>{label}</Text.Detail>
      {children}
      {hint && <Text.Detail tone="secondary">{hint}</Text.Detail>}
    </Spacings.Stack>
  );
}

export default function OnboardWizard() {
  const history = useHistory();
  const location = useLocation();
  const match = useRouteMatch();
  const base = match.url.replace(/\/onboard$/, '');
  const client = useCtClient();
  const { owners, tiers, stores, loading, reload } = useNetwork();

  const preselectedOwner = new URLSearchParams(location.search).get('owner') ?? '';

  const [step, setStep] = useState(0);

  // owner
  const [ownerMode, setOwnerMode] = useState<'existing' | 'new'>(
    preselectedOwner ? 'existing' : 'existing'
  );
  const [ownerKey, setOwnerKey] = useState(preselectedOwner);
  const [newOwner, setNewOwner] = useState({
    displayName: '',
    abn: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  // banner
  const [pillar, setPillar] = useState<Pillar | ''>('');
  const [banner, setBanner] = useState<BannerKey | ''>('');

  // store details
  const [retailerName, setRetailerName] = useState('');
  const [keyOverride, setKeyOverride] = useState('');
  const [loc, setLoc] = useState({
    street_address: '',
    suburb: '',
    state: '',
    postcode: '',
    phone: '',
  });
  const [optInDate, setOptInDate] = useState(new Date().toISOString().slice(0, 10));

  // tier
  const [tierKey, setTierKey] = useState<ProgrammeTierKey | ''>('');

  // catalogue / range
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CategoryLite[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [inRange, setInRange] = useState<Set<string>>(new Set());

  // fulfilment & feeds
  const [rapidDelivery, setRapidDelivery] = useState(false);
  const [feedOverride, setFeedOverride] = useState({ product: '', pricing: '', inventory: '' });
  const [idOverride, setIdOverride] = useState({ coveo: '', braze: '' });

  // provisioning
  const [provSteps, setProvSteps] = useState<ProvStep[]>([]);
  const [provisioning, setProvisioning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // load categories once; load pillar products (default full range) whenever pillar changes
  useEffect(() => {
    fetchCategories(client).then(setCategories).catch(() => setCategories([]));
  }, [client]);

  useEffect(() => {
    if (!pillar) {
      setCatalogProducts([]);
      setInRange(new Set());
      return;
    }
    let cancelled = false;
    setLoadingCatalog(true);
    fetchProductsByPillar(client, pillar as Pillar)
      .then((ps) => {
        if (cancelled) return;
        setCatalogProducts(ps);
        setInRange(new Set(ps.map((p) => p.id))); // default: carry all pillar products
      })
      .catch(() => {
        if (!cancelled) setCatalogProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, pillar]);

  const computedKey = banner ? makeStoreKey(banner, retailerName) : '';
  const storeKey = (keyOverride.trim() || computedKey).trim();
  const bannerLabel = banner ? BANNERS[banner].label : '';
  const storeName = retailerName ? `${bannerLabel} ${retailerName}`.trim() : '';
  const keyExists = useMemo(
    () => stores.some((s) => s.key === storeKey),
    [stores, storeKey]
  );

  const selectedTier = tierKey ? tiers[tierKey] : undefined;
  const tierAllowsPillar =
    !selectedTier || !pillar ? true : selectedTier.value.allowedPillars.includes(pillar);

  const v = (override: string, computed: string) => (override.trim() ? override.trim() : computed);
  const feeds = {
    product: v(feedOverride.product, storeKey ? makeProductFeedRef(storeKey) : ''),
    pricing: v(feedOverride.pricing, storeKey ? makePricingFeedRef(storeKey) : ''),
    inventory: v(feedOverride.inventory, storeKey ? makeInventoryFeedRef(storeKey) : ''),
  };
  const ids = {
    coveo: v(idOverride.coveo, storeKey ? makeCoveoSourceId(storeKey) : ''),
    braze: v(idOverride.braze, storeKey ? makeBrazeSegmentId(storeKey) : ''),
  };

  // ---- per-step validity ----
  const ownerValid =
    ownerMode === 'existing'
      ? !!ownerKey
      : newOwner.displayName.trim().length > 1 && newOwner.contactName.trim().length > 1;
  const bannerValid = !!pillar && !!banner;
  const detailsValid =
    retailerName.trim().length > 1 && !!storeKey && !keyExists && !!loc.suburb && !!loc.state;
  const tierValid = !!tierKey && tierAllowsPillar;
  // steps: Owner, Banner, Store details, Tier, Catalogue, Fulfilment & feeds, Review
  const stepValid = [ownerValid, bannerValid, detailsValid, tierValid, true, true, true][step];

  const canProceed = stepValid && !provisioning;

  const handleProvision = async () => {
    setProvisioning(true);
    setError(null);
    setDone(false);
    setProvSteps(PROVISION_STEPS.map((s) => ({ ...s, status: 'pending' as ProvStepStatus })));

    const onStep = (id: ProvStepId, status: ProvStepStatus, detail?: string) =>
      setProvSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status, detail } : s))
      );

    try {
      let resolvedOwnerKey = ownerKey;
      if (ownerMode === 'new') {
        resolvedOwnerKey = slugify(newOwner.displayName);
        await upsertOwner(client, resolvedOwnerKey, {
          displayName: newOwner.displayName.trim(),
          abn: newOwner.abn.trim(),
          primaryContact: {
            name: newOwner.contactName.trim(),
            email: newOwner.contactEmail.trim(),
            phone: newOwner.contactPhone.trim(),
          },
          stores: [],
        });
      }

      const fields: StoreProgrammeFields = {
        banner: banner as BannerKey,
        programme_tier: tierKey as ProgrammeTierKey,
        opt_in_date: optInDate,
        lifecycle_state: 'DRAFT',
        rapid_delivery_enabled: rapidDelivery,
        coveo_source_id: ids.coveo,
        braze_segment_id: ids.braze,
        product_feed_ref: feeds.product,
        pricing_feed_ref: feeds.pricing,
        inventory_feed_ref: feeds.inventory,
        street_address: loc.street_address || undefined,
        suburb: loc.suburb || undefined,
        state: (loc.state as StoreProgrammeFields['state']) || undefined,
        postcode: loc.postcode || undefined,
        phone: loc.phone || undefined,
      };

      await provisionStore(
        client,
        { storeKey, storeName, ownerKey: resolvedOwnerKey, fields, productIds: [...inRange] },
        onStep
      );
      setDone(true);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProvisioning(false);
    }
  };

  const resetWizard = () => {
    setStep(0);
    setOwnerMode('existing');
    setOwnerKey('');
    setNewOwner({ displayName: '', abn: '', contactName: '', contactEmail: '', contactPhone: '' });
    setPillar('');
    setBanner('');
    setRetailerName('');
    setKeyOverride('');
    setLoc({ street_address: '', suburb: '', state: '', postcode: '', phone: '' });
    setTierKey('');
    setInRange(new Set());
    setRapidDelivery(false);
    setFeedOverride({ product: '', pricing: '', inventory: '' });
    setIdOverride({ coveo: '', braze: '' });
    setProvSteps([]);
    setDone(false);
    setError(null);
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <LoadingSpinner scale="l">Loading owners and programme tiers…</LoadingSpinner>
      </div>
    );
  }

  // ---- success screen ----
  if (done) {
    return (
      <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <Card>
          <Spacings.Stack scale="l">
            <Spacings.Inline alignItems="center" scale="s">
              <span style={{ color: '#0b8043', display: 'flex' }}>
                <CheckBoldIcon size="big" />
              </span>
              <Text.Headline as="h1">Store is live</Text.Headline>
            </Spacings.Inline>
            <Text.Body>
              <b>{storeName}</b> (<code>{storeKey}</code>) was provisioned and{' '}
              <b>activated</b> against the shared project. It now resolves its own range and
              price scope, with exactly the features <b>{selectedTier?.value.label}</b> unlocks.
            </Text.Body>
            <Spacings.Inline alignItems="center" scale="s">
              <BannerChip banner={banner} />
              <Stamp tone="positive" label="ACTIVE" isCondensed />
              <Text.Detail tone="secondary">
                Open the storefront and select this store to see it live.
              </Text.Detail>
            </Spacings.Inline>
            <Spacings.Inline scale="s">
              <PrimaryButton label="Onboard another store" onClick={resetWizard} />
              <SecondaryButton
                label="Back to network"
                onClick={() => history.push(`${base}/network`)}
              />
            </Spacings.Inline>
          </Spacings.Stack>
        </Card>
      </div>
    );
  }

  // ---- provisioning screen ----
  if (provisioning || provSteps.length > 0) {
    return (
      <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
        <Spacings.Stack scale="l">
          <Spacings.Stack scale="xs">
            <Text.Headline as="h1">Provisioning {storeName}</Text.Headline>
            <Text.Body tone="secondary">
              Creating Store scope, channels, selection and lifecycle — live against the shared
              commercetools project.
            </Text.Body>
          </Spacings.Stack>
          <Card>
            <ProvisionProgress steps={provSteps} />
          </Card>
          {error && (
            <Card>
              <Spacings.Stack scale="s">
                <Text.Body tone="critical">Provisioning failed: {error}</Text.Body>
                <Text.Detail tone="secondary">
                  Writes are idempotent — fix the issue and retry; nothing is duplicated.
                </Text.Detail>
                <Spacings.Inline scale="s">
                  <PrimaryButton label="Retry" onClick={handleProvision} />
                  <SecondaryButton label="Back to review" onClick={() => setProvSteps([])} />
                </Spacings.Inline>
              </Spacings.Stack>
            </Card>
          )}
        </Spacings.Stack>
      </div>
    );
  }

  // ---- wizard steps ----
  return (
    <div style={{ padding: 24, maxWidth: 1040, margin: '0 auto' }}>
      <Spacings.Stack scale="l">
        <Spacings.Stack scale="xs">
          <Text.Headline as="h1">Onboard a retailer</Text.Headline>
          <Text.Body tone="secondary">
            Governed configuration, not a project — provision a Store under a franchisee owner in
            a few steps.
          </Text.Body>
        </Spacings.Stack>

        {/* step rail */}
        <Spacings.Inline scale="s" alignItems="center">
          {STEPS.map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  background: i === step ? '#1a1a1a' : i < step ? '#0b8043' : '#e3e7ee',
                  color: i <= step ? '#fff' : '#67728a',
                }}
              >
                {i < step ? '✓' : i + 1}
              </span>
              <Text.Detail tone={i === step ? undefined : 'secondary'}>{label}</Text.Detail>
              {i < STEPS.length - 1 && <span style={{ color: '#c9d0da' }}>—</span>}
            </div>
          ))}
        </Spacings.Inline>

        <Card>
          <div style={{ minHeight: 320 }}>
            {/* STEP 0 — OWNER */}
            {step === 0 && (
              <Spacings.Stack scale="m">
                <Text.Subheadline as="h4">Who owns this store?</Text.Subheadline>
                <Spacings.Inline scale="s">
                  <SecondaryButton
                    label="Existing franchisee"
                    onClick={() => setOwnerMode('existing')}
                    isToggled={ownerMode === 'existing'}
                  />
                  <SecondaryButton
                    label="New franchisee"
                    onClick={() => setOwnerMode('new')}
                    isToggled={ownerMode === 'new'}
                  />
                </Spacings.Inline>

                {ownerMode === 'existing' ? (
                  <Field label="Franchisee owner" hint="One operator can run stores across several banners.">
                    <SelectInput
                      value={ownerKey}
                      onChange={(e) => setOwnerKey(e.target.value as string)}
                      options={owners.map((o) => ({
                        value: o.key,
                        label: `${o.value.displayName} (${o.value.stores?.length ?? 0} stores)`,
                      }))}
                      placeholder="Select an owner…"
                    />
                  </Field>
                ) : (
                  <Spacings.Stack scale="s">
                    <Field label="Trading name">
                      <TextInput
                        value={newOwner.displayName}
                        onChange={(e) => setNewOwner({ ...newOwner, displayName: e.target.value })}
                      />
                    </Field>
                    <Spacings.Inline scale="s">
                      <div style={{ flex: 1 }}>
                        <Field label="ABN">
                          <TextInput
                            value={newOwner.abn}
                            onChange={(e) => setNewOwner({ ...newOwner, abn: e.target.value })}
                          />
                        </Field>
                      </div>
                      <div style={{ flex: 1 }}>
                        <Field label="Primary contact">
                          <TextInput
                            value={newOwner.contactName}
                            onChange={(e) => setNewOwner({ ...newOwner, contactName: e.target.value })}
                          />
                        </Field>
                      </div>
                    </Spacings.Inline>
                    <Spacings.Inline scale="s">
                      <div style={{ flex: 1 }}>
                        <Field label="Email">
                          <TextInput
                            value={newOwner.contactEmail}
                            onChange={(e) => setNewOwner({ ...newOwner, contactEmail: e.target.value })}
                          />
                        </Field>
                      </div>
                      <div style={{ flex: 1 }}>
                        <Field label="Phone">
                          <TextInput
                            value={newOwner.contactPhone}
                            onChange={(e) => setNewOwner({ ...newOwner, contactPhone: e.target.value })}
                          />
                        </Field>
                      </div>
                    </Spacings.Inline>
                  </Spacings.Stack>
                )}
              </Spacings.Stack>
            )}

            {/* STEP 1 — BANNER */}
            {step === 1 && (
              <Spacings.Stack scale="m">
                <Text.Subheadline as="h4">Pillar & banner</Text.Subheadline>
                <Field label="Pillar">
                  <SelectInput
                    value={pillar}
                    onChange={(e) => {
                      setPillar(e.target.value as Pillar);
                      setBanner('');
                    }}
                    options={(['food', 'liquor', 'hardware'] as Pillar[]).map((p) => ({
                      value: p,
                      label: PILLAR_LABELS[p],
                    }))}
                    placeholder="Select a pillar…"
                  />
                </Field>
                {pillar && (
                  <Field label="Banner">
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {bannersForPillar(pillar).map((b) => (
                        <div
                          key={b.key}
                          onClick={() => setBanner(b.key)}
                          style={{
                            cursor: 'pointer',
                            padding: 12,
                            borderRadius: 8,
                            border: '2px solid',
                            borderColor: banner === b.key ? '#1a1a1a' : '#e3e7ee',
                            background: banner === b.key ? '#f7f8fa' : '#fff',
                          }}
                        >
                          <BannerChip banner={b.key} />
                        </div>
                      ))}
                    </div>
                  </Field>
                )}
              </Spacings.Stack>
            )}

            {/* STEP 2 — STORE DETAILS */}
            {step === 2 && (
              <Spacings.Stack scale="m">
                <Text.Subheadline as="h4">Store identity & location</Text.Subheadline>
                <Spacings.Inline scale="s">
                  <div style={{ flex: 2 }}>
                    <Field label="Retailer / location name" hint={storeName ? `Store name: ${storeName}` : undefined}>
                      <TextInput
                        value={retailerName}
                        onChange={(e) => setRetailerName(e.target.value)}
                        placeholder="e.g. Bondi Beach"
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 2 }}>
                    <Field
                      label="Store key"
                      hint={
                        keyExists
                          ? '⚠ A store with this key already exists'
                          : 'Convention: {banner}-{slug} — editable'
                      }
                    >
                      <TextInput
                        value={keyOverride || computedKey}
                        onChange={(e) => setKeyOverride(e.target.value)}
                        hasError={keyExists}
                      />
                    </Field>
                  </div>
                </Spacings.Inline>
                <Field label="Street address">
                  <TextInput
                    value={loc.street_address}
                    onChange={(e) => setLoc({ ...loc, street_address: e.target.value })}
                  />
                </Field>
                <Spacings.Inline scale="s">
                  <div style={{ flex: 2 }}>
                    <Field label="Suburb">
                      <TextInput value={loc.suburb} onChange={(e) => setLoc({ ...loc, suburb: e.target.value })} />
                    </Field>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Field label="State">
                      <SelectInput
                        value={loc.state}
                        onChange={(e) => setLoc({ ...loc, state: e.target.value as string })}
                        options={AU_STATES.map((s) => ({ value: s, label: s }))}
                        placeholder="—"
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Field label="Postcode">
                      <TextInput value={loc.postcode} onChange={(e) => setLoc({ ...loc, postcode: e.target.value })} />
                    </Field>
                  </div>
                </Spacings.Inline>
                <Spacings.Inline scale="s">
                  <div style={{ flex: 1 }}>
                    <Field label="Phone">
                      <TextInput value={loc.phone} onChange={(e) => setLoc({ ...loc, phone: e.target.value })} />
                    </Field>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Field label="Opt-in date">
                      <DateInput value={optInDate} onChange={(e) => setOptInDate(e.target.value ?? '')} />
                    </Field>
                  </div>
                </Spacings.Inline>
              </Spacings.Stack>
            )}

            {/* STEP 3 — TIER */}
            {step === 3 && (
              <Spacings.Stack scale="m">
                <Text.Subheadline as="h4">Programme tier</Text.Subheadline>
                <Field label="Assign a template" hint="Capabilities are HQ-governed — read live from programme-tiers.">
                  <SelectInput
                    value={tierKey}
                    onChange={(e) => setTierKey(e.target.value as ProgrammeTierKey)}
                    options={Object.values(tiers).map((t) => ({
                      value: t.key,
                      label: t.value.label,
                    }))}
                    placeholder="Select a tier…"
                  />
                </Field>
                {selectedTier && (
                  <Spacings.Stack scale="s">
                    <Text.Detail isBold>What {selectedTier.value.label} unlocks</Text.Detail>
                    <FeatureUnlocks features={selectedTier.value.features} />
                    {!tierAllowsPillar && (
                      <Text.Body tone="critical">
                        ⚠ {selectedTier.value.label} does not allow the {pillar} pillar (allowed:{' '}
                        {selectedTier.value.allowedPillars.join(', ')}). Pick another tier or banner.
                      </Text.Body>
                    )}
                  </Spacings.Stack>
                )}
              </Spacings.Stack>
            )}

            {/* STEP 4 — CATALOGUE (RANGE) */}
            {step === 4 && (
              <Spacings.Stack scale="m">
                <Text.Subheadline as="h4">Catalogue (range)</Text.Subheadline>
                <Text.Body tone="secondary">
                  Default range is every{' '}
                  {pillar ? PILLAR_LABELS[pillar as Pillar] : ''} product ({inRange.size} of{' '}
                  {catalogProducts.length}). Drag or click cards to remove what this store won’t
                  carry, or filter by category to bulk-edit. Feeds keep this in sync in production.
                </Text.Body>
                {loadingCatalog ? (
                  <LoadingSpinner scale="s">Loading products…</LoadingSpinner>
                ) : (
                  <CatalogEditor
                    products={catalogProducts}
                    categories={categories}
                    inRange={inRange}
                    onChange={setInRange}
                    localCategoryId={categories.find((c) => c.key === 'local')?.id}
                  />
                )}
              </Spacings.Stack>
            )}

            {/* STEP 5 — FULFILMENT & FEEDS */}
            {step === 5 && (
              <Spacings.Stack scale="m">
                <Text.Subheadline as="h4">Fulfilment & feed wiring</Text.Subheadline>
                <CheckboxInput
                  isChecked={rapidDelivery}
                  onChange={() => setRapidDelivery(!rapidDelivery)}
                >
                  Rapid delivery enabled
                </CheckboxInput>
                {selectedTier && (
                  <Text.Detail tone="secondary">
                    Click &amp; Collect is {selectedTier.value.features.clickCollect ? 'ON' : 'OFF'} for this
                    tier (governed by the template, not per-store).
                  </Text.Detail>
                )}
                <Text.Detail isBold>Feed references (wired, not authored)</Text.Detail>
                <Field label="Product feed">
                  <TextInput
                    value={feedOverride.product || feeds.product}
                    onChange={(e) => setFeedOverride({ ...feedOverride, product: e.target.value })}
                  />
                </Field>
                <Spacings.Inline scale="s">
                  <div style={{ flex: 1 }}>
                    <Field label="Pricing feed">
                      <TextInput
                        value={feedOverride.pricing || feeds.pricing}
                        onChange={(e) => setFeedOverride({ ...feedOverride, pricing: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Field label="Inventory feed">
                      <TextInput
                        value={feedOverride.inventory || feeds.inventory}
                        onChange={(e) => setFeedOverride({ ...feedOverride, inventory: e.target.value })}
                      />
                    </Field>
                  </div>
                </Spacings.Inline>
                <Spacings.Inline scale="s">
                  <div style={{ flex: 1 }}>
                    <Field label="Coveo source ID (auto)">
                      <TextInput
                        value={idOverride.coveo || ids.coveo}
                        onChange={(e) => setIdOverride({ ...idOverride, coveo: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Field label="Braze segment ID (auto)">
                      <TextInput
                        value={idOverride.braze || ids.braze}
                        onChange={(e) => setIdOverride({ ...idOverride, braze: e.target.value })}
                      />
                    </Field>
                  </div>
                </Spacings.Inline>
              </Spacings.Stack>
            )}

            {/* STEP 6 — REVIEW */}
            {step === 6 && (
              <Spacings.Stack scale="m">
                <Text.Subheadline as="h4">Review & provision</Text.Subheadline>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                  }}
                >
                  <ReviewRow label="Owner" value={ownerMode === 'new' ? `${newOwner.displayName} (new)` : owners.find((o) => o.key === ownerKey)?.value.displayName ?? ownerKey} />
                  <ReviewRow label="Banner" value={<BannerChip banner={banner} size="small" />} />
                  <ReviewRow label="Store" value={`${storeName}`} />
                  <ReviewRow label="Store key" value={<code>{storeKey}</code>} />
                  <ReviewRow label="Tier" value={selectedTier?.value.label ?? tierKey} />
                  <ReviewRow
                    label="Range"
                    value={`${inRange.size} of ${catalogProducts.length} products`}
                  />
                  <ReviewRow label="Location" value={`${loc.suburb}, ${loc.state} ${loc.postcode}`} />
                  <ReviewRow label="Rapid delivery" value={rapidDelivery ? 'Yes' : 'No'} />
                  <ReviewRow label="Opt-in date" value={optInDate} />
                  <ReviewRow label="Product feed" value={<code>{feeds.product}</code>} />
                  <ReviewRow label="Channels" value={<code>{storeKey}-price / -supply</code>} />
                </div>
                <Text.Detail tone="secondary">
                  On provision: create channels + selection → create Store (DRAFT) → link to owner →
                  activate. All writes are idempotent.
                </Text.Detail>
              </Spacings.Stack>
            )}
          </div>
        </Card>

        {/* nav */}
        <Spacings.Inline justifyContent="space-between">
          <SecondaryButton
            label="Back"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            isDisabled={step === 0}
          />
          {step < STEPS.length - 1 ? (
            <PrimaryButton
              label="Continue"
              onClick={() => setStep((s) => s + 1)}
              isDisabled={!canProceed}
            />
          ) : (
            <PrimaryButton
              label="Provision & activate"
              onClick={handleProvision}
              isDisabled={!ownerValid || !bannerValid || !detailsValid || !tierValid}
            />
          )}
        </Spacings.Inline>
      </Spacings.Stack>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Text.Detail tone="secondary">{label}</Text.Detail>
      <Text.Body>{value}</Text.Body>
    </div>
  );
}
