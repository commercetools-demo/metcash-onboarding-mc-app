import { useState } from 'react';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import Card from '@commercetools-uikit/card';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import FlatButton from '@commercetools-uikit/flat-button';
import CheckboxInput from '@commercetools-uikit/checkbox-input';
import TextInput from '@commercetools-uikit/text-input';
import Stamp from '@commercetools-uikit/stamp';
import { PlusBoldIcon, CloseBoldIcon } from '@commercetools-uikit/icons';
import { upsertLoyaltyProgram } from '../../lib/ctWrites';
import type { CtClient } from '../../lib/ctClient';
import type { LoyaltyProgramObject, LoyaltyTier } from '../../lib/types';

/**
 * Editor for the `loyalty-program` custom object — the programme the storefront reads for
 * tier ladders, points earn/burn and cashback (site/lib/ct/loyalty.ts).
 *
 * Numbers are held in state as STRINGS and coerced with Number() on save, matching the
 * convention in OnboardWizard — it keeps partially-typed values ("0.", "") editable.
 */

// Ascending visual weight, so the ladder reads Bronze → Silver → Gold at a glance.
const TIER_TONE = ['secondary', 'information', 'primary', 'warning'] as const;

/** Draft mirror of LoyaltyTier with string-typed numerics for editing. */
interface TierDraft {
  tier: string;
  threshold: string;
  benefits: string; // comma-separated in the input, split on save
}

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

const toDraft = (t: LoyaltyTier): TierDraft => ({
  tier: t.tier,
  threshold: String(t.threshold ?? 0),
  benefits: (t.benefits ?? []).join(', '),
});

const money = (aud: number) =>
  `$${aud.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The "why this matters" line: turns the raw rates into the sentence a merchandiser
 * actually reasons about. Recomputes live while editing.
 */
function WorkedExample({
  earnRate,
  redemptionValue,
  cashbackPct,
  minRedemption,
}: {
  earnRate: number;
  redemptionValue: number;
  cashbackPct: number;
  minRedemption: number;
}) {
  const basket = 100;
  const points = basket * earnRate;
  const worth = points * redemptionValue;
  const cashback = (basket * cashbackPct) / 100;

  return (
    <Card theme="dark" insetScale="s">
      <Spacings.Stack scale="xs">
        <Text.Detail isBold>Worked example</Text.Detail>
        {/*
          Do NOT use the <>…</> fragment shorthand anywhere in this app: mc-scripts' Babel
          config sets the JSX pragma but leaves pragmaFrag as a literal `React.Fragment`,
          which is never imported — it type-checks and builds, then throws
          "React is not defined" at runtime. Use an element (or <React.Fragment>) instead.
        */}
        <Text.Body>
          A {money(basket)} basket earns <b>{points.toLocaleString('en-AU')} points</b> (worth{' '}
          <b>{money(worth)}</b>)
          {cashbackPct > 0 && (
            <span>
              {' '}
              plus <b>{money(cashback)}</b> cashback
            </span>
          )}
          .
        </Text.Body>
        <Text.Detail tone="secondary">
          Effective member value {((worth + cashback) / basket * 100).toFixed(1)}% · redemption unlocks at{' '}
          {minRedemption.toLocaleString('en-AU')} points ({money(minRedemption * redemptionValue)}).
        </Text.Detail>
      </Spacings.Stack>
    </Card>
  );
}

export default function ProgrammeEditor({
  program,
  canManage,
  client,
  onSaved,
}: {
  program: LoyaltyProgramObject;
  canManage: boolean;
  client: CtClient;
  onSaved: () => void;
}) {
  const v = program.value;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(v.program_name);
  const [tiers, setTiers] = useState<TierDraft[]>((v.tiers ?? []).map(toDraft));
  const [earnRate, setEarnRate] = useState(String(v.points_earn_rate ?? 1));
  const [redemption, setRedemption] = useState(String(v.points_redemption_value ?? 0.01));
  const [minRedemption, setMinRedemption] = useState(String(v.min_redemption ?? 0));
  const [asTender, setAsTender] = useState(Boolean(v.redeem_as_tender));
  const [cashbackPct, setCashbackPct] = useState(String(v.cashback_model?.default_pct ?? 0));

  const startEdit = () => {
    setName(v.program_name);
    setTiers((v.tiers ?? []).map(toDraft));
    setEarnRate(String(v.points_earn_rate ?? 1));
    setRedemption(String(v.points_redemption_value ?? 0.01));
    setMinRedemption(String(v.min_redemption ?? 0));
    setAsTender(Boolean(v.redeem_as_tender));
    setCashbackPct(String(v.cashback_model?.default_pct ?? 0));
    setFlash(null);
    setError(null);
    setEditing(true);
  };

  const patchTier = (i: number, patch: Partial<TierDraft>) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const addTier = () => setTiers((prev) => [...prev, { tier: '', threshold: '0', benefits: '' }]);
  const removeTier = (i: number) => setTiers((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    // Drop blank rows, coerce numerics, and sort by threshold — the storefront sorts too
    // (loyalty.ts), but storing them ordered keeps the object readable in the API.
    const cleanTiers: LoyaltyTier[] = tiers
      .filter((t) => t.tier.trim())
      .map((t) => ({
        tier: t.tier.trim(),
        threshold: Number(t.threshold) || 0,
        benefits: t.benefits
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean),
      }))
      .sort((a, b) => a.threshold - b.threshold);

    if (!cleanTiers.length) {
      setError('Add at least one tier — the storefront enrols new members into the lowest one.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await upsertLoyaltyProgram(client, program.key, {
        program_name: name.trim() || v.program_name,
        tiers: cleanTiers,
        points_earn_rate: Number(earnRate) || 0,
        points_redemption_value: Number(redemption) || 0,
        min_redemption: Number(minRedemption) || 0,
        redeem_as_tender: asTender,
        cashback_model: {
          accrual: v.cashback_model?.accrual ?? 'percent_of_spend',
          default_pct: Number(cashbackPct) || 0,
        },
      });
      setEditing(false);
      setFlash('Saved — live on the storefront from the next page load.');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // Preview reads the draft while editing, the saved object otherwise.
  const preview = editing
    ? {
        earn: Number(earnRate) || 0,
        redeem: Number(redemption) || 0,
        cashback: Number(cashbackPct) || 0,
        min: Number(minRedemption) || 0,
      }
    : {
        earn: v.points_earn_rate ?? 0,
        redeem: v.points_redemption_value ?? 0,
        cashback: v.cashback_model?.default_pct ?? 0,
        min: v.min_redemption ?? 0,
      };

  const displayTiers = editing ? tiers : (v.tiers ?? []).map(toDraft);

  return (
    <Spacings.Stack scale="l">
      <Card>
        <Spacings.Stack scale="m">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {editing ? (
                <div style={{ width: 380 }}>
                  <TextInput value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              ) : (
                <Text.Subheadline as="h4">{v.program_name}</Text.Subheadline>
              )}
              <Text.Detail tone="secondary">
                custom object <code>loyalty-program / {program.key}</code>
              </Text.Detail>
            </div>
            {canManage &&
              (editing ? (
                <Spacings.Inline scale="xs">
                  <PrimaryButton label="Save" onClick={handleSave} isDisabled={saving} />
                  <SecondaryButton
                    label="Cancel"
                    onClick={() => setEditing(false)}
                    isDisabled={saving}
                  />
                </Spacings.Inline>
              ) : (
                <SecondaryButton label="Edit programme" onClick={startEdit} />
              ))}
          </div>

          {flash && <Text.Detail tone="positive">{flash}</Text.Detail>}
          {error && <Text.Detail tone="critical">{error}</Text.Detail>}

          {/* ---- tier ladder ---- */}
          <Spacings.Stack scale="xs">
            <Text.Detail isBold>Tier ladder</Text.Detail>
            {displayTiers.length === 0 && <Text.Body tone="secondary">No tiers defined.</Text.Body>}

            {editing
              ? displayTiers.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '160px 140px 1fr 32px',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <TextInput
                      value={t.tier}
                      placeholder="Tier name"
                      onChange={(e) => patchTier(i, { tier: e.target.value })}
                    />
                    <TextInput
                      value={t.threshold}
                      placeholder="Points threshold"
                      onChange={(e) => patchTier(i, { threshold: e.target.value })}
                    />
                    <TextInput
                      value={t.benefits}
                      placeholder="Benefits, comma separated"
                      onChange={(e) => patchTier(i, { benefits: e.target.value })}
                    />
                    <FlatButton
                      tone="secondary"
                      icon={<CloseBoldIcon />}
                      label=""
                      onClick={() => removeTier(i)}
                    />
                  </div>
                ))
              : displayTiers.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '160px 140px 1fr',
                      gap: 8,
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    <Stamp
                      isCondensed
                      tone={TIER_TONE[Math.min(i, TIER_TONE.length - 1)]}
                      label={t.tier}
                    />
                    <Text.Detail tone="secondary">
                      {Number(t.threshold).toLocaleString('en-AU')} pts
                    </Text.Detail>
                    <Text.Detail>{t.benefits || '—'}</Text.Detail>
                  </div>
                ))}

            {editing && (
              <div>
                <FlatButton
                  tone="primary"
                  icon={<PlusBoldIcon />}
                  label="Add tier"
                  onClick={addTier}
                />
              </div>
            )}
          </Spacings.Stack>

          {/* ---- earn & burn ---- */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            <Field label="Points earned per $1" hint="points_earn_rate">
              {editing ? (
                <TextInput value={earnRate} onChange={(e) => setEarnRate(e.target.value)} />
              ) : (
                <Text.Body>{v.points_earn_rate}</Text.Body>
              )}
            </Field>

            <Field label="Value per point (AUD)" hint="points_redemption_value">
              {editing ? (
                <TextInput value={redemption} onChange={(e) => setRedemption(e.target.value)} />
              ) : (
                <Text.Body>{money(v.points_redemption_value ?? 0)}</Text.Body>
              )}
            </Field>

            <Field label="Minimum redemption (points)" hint="min_redemption">
              {editing ? (
                <TextInput
                  value={minRedemption}
                  onChange={(e) => setMinRedemption(e.target.value)}
                />
              ) : (
                <Text.Body>{(v.min_redemption ?? 0).toLocaleString('en-AU')}</Text.Body>
              )}
            </Field>

            <Field label="Cashback (% of spend)" hint="cashback_model.default_pct">
              {editing ? (
                <TextInput value={cashbackPct} onChange={(e) => setCashbackPct(e.target.value)} />
              ) : (
                <Text.Body>{v.cashback_model?.default_pct ?? 0}%</Text.Body>
              )}
            </Field>
          </div>

          <Spacings.Stack scale="xs">
            <Text.Detail isBold>Redemption</Text.Detail>
            {editing ? (
              <CheckboxInput isChecked={asTender} onChange={() => setAsTender(!asTender)}>
                Points can be redeemed as tender at checkout
              </CheckboxInput>
            ) : (
              <Text.Body>
                {v.redeem_as_tender
                  ? 'Points can be redeemed as tender at checkout.'
                  : 'Points accrue only — no redemption at checkout.'}
              </Text.Body>
            )}
          </Spacings.Stack>
        </Spacings.Stack>
      </Card>

      <WorkedExample
        earnRate={preview.earn}
        redemptionValue={preview.redeem}
        cashbackPct={preview.cashback}
        minRedemption={preview.min}
      />
    </Spacings.Stack>
  );
}
