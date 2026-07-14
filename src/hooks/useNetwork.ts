import { useState, useEffect, useCallback } from 'react';
import {
  useCtClient,
  fetchStores,
  fetchTiers,
  fetchOwners,
} from '../lib/ctClient';
import type {
  StoreData,
  ProgrammeTierObject,
  RetailerOwnerObject,
  ProgrammeTierKey,
} from '../lib/types';

export interface OwnerGroup {
  owner: RetailerOwnerObject;
  stores: StoreData[];
}

export interface NetworkData {
  stores: StoreData[];
  owners: RetailerOwnerObject[];
  tiers: Record<ProgrammeTierKey, ProgrammeTierObject>;
  /** Stores grouped by resolved owner_key, plus an "unassigned" bucket. */
  groups: OwnerGroup[];
  unassigned: StoreData[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

function isPermissionError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes('403') || err.message.includes('insufficient_scope'))
  );
}

export function useNetwork(): NetworkData {
  const client = useCtClient();
  const { projectKey } = client;

  const [stores, setStores] = useState<StoreData[]>([]);
  const [owners, setOwners] = useState<RetailerOwnerObject[]>([]);
  const [tiers, setTiers] = useState<Record<ProgrammeTierKey, ProgrammeTierObject>>(
    {} as Record<ProgrammeTierKey, ProgrammeTierObject>
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    try {
      const [storeList, tierList, ownerList] = await Promise.all([
        fetchStores(client),
        fetchTiers(client),
        fetchOwners(client),
      ]);
      setStores(storeList);
      setOwners(ownerList);
      const tierMap = {} as Record<ProgrammeTierKey, ProgrammeTierObject>;
      tierList.forEach((t) => (tierMap[t.key] = t));
      setTiers(tierMap);
    } catch (err) {
      setError(
        isPermissionError(err)
          ? new Error('permission')
          : err instanceof Error
          ? err
          : new Error(String(err))
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey, tick]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- group stores by owner ----
  const byKey = new Map<string, StoreData>();
  stores.forEach((s) => byKey.set(s.key, s));

  const claimed = new Set<string>();
  const groups: OwnerGroup[] = owners.map((owner) => {
    const ownerStores: StoreData[] = [];
    // Prefer the owner's stores[] list; fall back to owner_key back-reference.
    for (const sk of owner.value.stores ?? []) {
      const s = byKey.get(sk);
      if (s) {
        ownerStores.push(s);
        claimed.add(s.key);
      }
    }
    for (const s of stores) {
      if (s.custom?.fields.owner_key === owner.key && !claimed.has(s.key)) {
        ownerStores.push(s);
        claimed.add(s.key);
      }
    }
    return { owner, stores: ownerStores };
  });

  const unassigned = stores.filter((s) => !claimed.has(s.key));

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { stores, owners, tiers, groups, unassigned, loading, error, reload };
}
