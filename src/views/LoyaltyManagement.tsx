import { useState, useEffect, useCallback } from 'react';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import Card from '@commercetools-uikit/card';
import SelectInput from '@commercetools-uikit/select-input';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import { useIsAuthorized } from '@commercetools-frontend/permissions';
import { useCtClient, fetchLoyaltyPrograms } from '../lib/ctClient';
import { PERMISSIONS } from '../constants';
import ProgrammeEditor from '../components/loyalty/ProgrammeEditor';
import type { LoyaltyProgramObject } from '../lib/types';

/**
 * Loyalty & promotions console (see metcash-demo/docs/27).
 *
 * The Merchant Center has no native UI for custom objects, and the loyalty programme,
 * promotions and offers all live there. This screen gives the merchandiser a real editor
 * without registering a second Custom Application — the onboarding app already holds the
 * view/manage_key_value_documents scopes it needs.
 *
 * P1 (here): the programme itself. P2 adds promotions, P3 offers.
 */
export default function LoyaltyManagement() {
  const client = useCtClient();
  const { projectKey } = client;
  const canManage = useIsAuthorized({ demandedPermissions: [PERMISSIONS.Manage] });

  const [programs, setPrograms] = useState<LoyaltyProgramObject[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchLoyaltyPrograms(client);
      setPrograms(list);
      setSelectedKey((prev) => (prev && list.some((p) => p.key === prev) ? prev : list[0]?.key ?? ''));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey, tick]);

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <LoadingSpinner scale="l">Loading loyalty programme…</LoadingSpinner>
      </div>
    );
  }

  const selected = programs.find((p) => p.key === selectedKey);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <Spacings.Stack scale="l">
        <div>
          <Text.Detail tone="secondary">METCASH · HQ GOVERNANCE</Text.Detail>
          <Text.Headline as="h1">Loyalty &amp; promotions</Text.Headline>
          <Text.Body tone="secondary">
            The programme the storefront reads for tiers, points earn/burn and cashback. Saved changes
            are live on the next storefront page load — no rebuild, no deploy.
          </Text.Body>
        </div>

        {!canManage && (
          <Card theme="dark" insetScale="s">
            <Text.Body>
              View only — editing the programme requires the <b>Manage</b> permission for this app.
            </Text.Body>
          </Card>
        )}

        {error && (
          <Card insetScale="s">
            <Text.Body tone="critical">Could not load the programme: {error.message}</Text.Body>
          </Card>
        )}

        {!error && programs.length === 0 && (
          <Card insetScale="s">
            <Spacings.Stack scale="xs">
              <Text.Body isBold>No loyalty programme configured.</Text.Body>
              <Text.Detail tone="secondary">
                Expected a custom object in container <code>loyalty-program</code>. Seed one with{' '}
                <code>metcash-demo/scripts/seed-cellarbrations.ts</code>.
              </Text.Detail>
            </Spacings.Stack>
          </Card>
        )}

        {programs.length > 1 && (
          <div style={{ width: 280 }}>
            <Spacings.Stack scale="xs">
              <Text.Detail isBold>Banner</Text.Detail>
              <SelectInput
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value as string)}
                options={programs.map((p) => ({ value: p.key, label: p.value.program_name }))}
              />
            </Spacings.Stack>
          </div>
        )}

        {selected && (
          <ProgrammeEditor
            key={selected.key}
            program={selected}
            canManage={canManage}
            client={client}
            onSaved={reload}
          />
        )}
      </Spacings.Stack>
    </div>
  );
}
