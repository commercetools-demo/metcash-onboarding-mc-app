import { useCallback, useMemo } from 'react';
import { useAsyncDispatch, actions } from '@commercetools-frontend/sdk';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import type {
  CtPagedQueryResponse,
  StoreData,
  ProgrammeTierObject,
  RetailerOwnerObject,
  ChannelData,
  LoyaltyProgramObject,
} from './types';

/**
 * Low-level CT access through the MC proxy using the LOGGED-IN USER'S session.
 * No static client secret — the proxy attaches the user's token (scoped by oAuthScopes
 * in custom-application-config.mjs). This is the single source of CT access for the app;
 * screens import the typed helpers below and never build raw requests.
 *
 * MTC-O3 extends this module with the write actions (create store/channels/selection,
 * update custom fields, owner CRUD, template edits). Reads live here now to power the
 * network list.
 */
export function useCtClient() {
  const dispatch = useAsyncDispatch();
  const projectKey = useApplicationContext((ctx) => ctx.project?.key ?? '');

  const get = useCallback(
    <T>(path: string): Promise<T> =>
      dispatch(
        actions.get({ uri: `/${projectKey}${path}`, mcApiProxyTarget: 'ctp' })
      ) as Promise<T>,
    [dispatch, projectKey]
  );

  const post = useCallback(
    <T>(path: string, payload: unknown): Promise<T> =>
      dispatch(
        actions.post({
          uri: `/${projectKey}${path}`,
          mcApiProxyTarget: 'ctp',
          payload,
        })
      ) as Promise<T>,
    [dispatch, projectKey]
  );

  // Memoise so the returned object has a STABLE reference across renders.
  // Consumers put `client` in useEffect/useCallback deps; an unstable object here
  // causes an infinite fetch loop.
  return useMemo(() => ({ projectKey, get, post }), [projectKey, get, post]);
}

// ---- typed reads ------------------------------------------------------------

export type CtClient = ReturnType<typeof useCtClient>;

export async function fetchStores(client: CtClient): Promise<StoreData[]> {
  const data = await client.get<CtPagedQueryResponse<StoreData>>(
    '/stores?limit=500&expand=productSelections[*].productSelection'
  );
  return data.results;
}

export async function fetchTiers(client: CtClient): Promise<ProgrammeTierObject[]> {
  const data = await client.get<CtPagedQueryResponse<ProgrammeTierObject>>(
    '/custom-objects/programme-tiers?limit=100'
  );
  return data.results;
}

export async function fetchOwners(client: CtClient): Promise<RetailerOwnerObject[]> {
  const data = await client.get<CtPagedQueryResponse<RetailerOwnerObject>>(
    '/custom-objects/retailer-owners?limit=500'
  );
  return data.results;
}

/**
 * Loyalty programme config, one object per banner (today only `cellarbrations`).
 * Returned as a list so the editor can offer a banner picker as soon as a second one exists.
 */
export async function fetchLoyaltyPrograms(
  client: CtClient
): Promise<LoyaltyProgramObject[]> {
  const data = await client.get<CtPagedQueryResponse<LoyaltyProgramObject>>(
    '/custom-objects/loyalty-program?limit=50'
  );
  return data.results;
}

export async function fetchChannelsByIds(
  client: CtClient,
  ids: string[]
): Promise<Record<string, ChannelData>> {
  const map: Record<string, ChannelData> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const where = `id in (${batch.map((id) => `"${id}"`).join(',')})`;
    const data = await client.get<CtPagedQueryResponse<ChannelData>>(
      `/channels?limit=100&where=${encodeURIComponent(where)}`
    );
    data.results.forEach((ch) => (map[ch.id] = ch));
  }
  return map;
}
