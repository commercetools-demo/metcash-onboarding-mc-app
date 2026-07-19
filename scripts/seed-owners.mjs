/**
 * seed-owners.mjs — MTC-O1: owner-centric grouping seed (idempotent).
 *
 * Adds the two onboarding-specific pieces on top of the storefront's existing data model:
 *   1. Upserts the `retailer-owners` custom objects (one per franchisee) with proper OBJECT
 *      values — NOT stringified (matches the `programme-tiers` convention the storefront uses).
 *   2. Backfills `store-programme.owner_key` on the existing seeded stores so the network list
 *      can group by owner, keeping both sides in sync with each owner's `stores[]`.
 *
 * At least one owner (Nguyen Retail Group) intentionally spans multiple banners
 * (Bottle-O + Total Tools + Mitre 10) to demo multi-banner ownership.
 *
 * Idempotent: custom objects upsert by (container,key); owner_key is set only when it differs.
 * Re-running does not duplicate or churn. Doubles as the reset/re-seed path for rehearsals.
 *
 * Run: `node scripts/seed-owners.mjs`  (reads ../.env.local)
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- env loader (mirrors metcash-demo/scripts) ----
function loadEnv() {
  const env = { ...process.env };
  try {
    for (let line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      if (line.startsWith('export ')) line = line.slice(7);
      const i = line.indexOf('=');
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!(k in process.env)) env[k] = v;
    }
  } catch { /* rely on process.env */ }
  return env;
}
const ENV = loadEnv();
const PROJECT = ENV.CTP_PROJECT_KEY;
const API = `${ENV.CTP_API_URL}/${PROJECT}`;

// ---- auth + ct helper (retry pattern from metcash-demo/scripts) ----
let token = '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function auth(attempt = 1) {
  const MAX = 6;
  const basic = Buffer.from(`${ENV.CTP_CLIENT_ID}:${ENV.CTP_CLIENT_SECRET}`).toString('base64');
  try {
    const res = await fetch(`${ENV.CTP_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    if (!res.ok) {
      if ((res.status === 429 || res.status >= 500) && attempt < MAX) {
        await sleep(300 * 2 ** (attempt - 1)); return auth(attempt + 1);
      }
      throw new Error(`auth failed: ${res.status} ${await res.text()}`);
    }
    token = (await res.json()).access_token;
  } catch (e) {
    if (attempt < MAX) { await sleep(300 * 2 ** (attempt - 1)); return auth(attempt + 1); }
    throw e;
  }
}
async function ct(method, path, body, attempt = 1) {
  const MAX = 5;
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if ((res.status === 429 || res.status >= 500) && attempt < MAX) {
      await sleep(250 * 2 ** (attempt - 1)); return ct(method, path, body, attempt + 1);
    }
    if (res.status === 401 && attempt < MAX) { await auth(); return ct(method, path, body, attempt + 1); }
    const text = await res.text();
    let parsed;
    try { parsed = text ? JSON.parse(text) : undefined; } catch { parsed = text; }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (e) {
    if (attempt < MAX) { await sleep(250 * 2 ** (attempt - 1)); return ct(method, path, body, attempt + 1); }
    return { ok: false, status: 0, body: { message: String(e?.message ?? e) } };
  }
}

const errors = [];

// ---------------------------------------------------------------------------
// Owner registry. Nguyen Retail Group spans 3 banners (the multi-banner demo).
// stores[] is the source of truth; owner_key is stamped on each store to match.
// ---------------------------------------------------------------------------
const OWNERS = [
  {
    key: 'nguyen-retail-group',
    displayName: 'Nguyen Retail Group',
    abn: '12 345 678 901',
    primaryContact: { name: 'An Nguyen', email: 'an@nrg.com.au', phone: '+61 400 111 222' },
    // cross-banner franchisee — Bottle-O + Cellarbrations + Total Tools + Mitre 10 (all four banners)
    stores: [
      'bottle-o-bondi',
      'total-tools-richmond',
      'mitre10-brunswick',
      'cb-store-3000',
      'cb-store-3125',
    ],
  },
  {
    key: 'coastal-cellars',
    displayName: 'Coastal Cellars Pty Ltd',
    abn: '45 678 901 234',
    primaryContact: { name: 'Maria Costa', email: 'maria@coastalcellars.com.au', phone: '+61 400 333 444' },
    // legacy Bottle-O + NSW Cellarbrations stores (a liquor operator growing its footprint)
    stores: ['bottle-o-neutral-bay', 'bottle-o-manly', 'cb-store-2000', 'cb-store-2156'],
  },
  {
    key: 'melbourne-trade-hardware',
    displayName: 'Melbourne Trade & Hardware Co',
    abn: '78 901 234 567',
    primaryContact: { name: 'David Papadopoulos', email: 'david@mthc.com.au', phone: '+61 400 555 666' },
    stores: ['total-tools-preston', 'mitre10-hawthorn'],
  },
];

// ---- 1. upsert owners as proper OBJECT values (POST /custom-objects upserts by container+key) ----
async function upsertOwner(o) {
  const value = {
    displayName: o.displayName,
    abn: o.abn,
    primaryContact: o.primaryContact,
    stores: o.stores,
  };
  const r = await ct('POST', '/custom-objects', { container: 'retailer-owners', key: o.key, value });
  if (!r.ok) { errors.push(`owner ${o.key}: ${r.status} ${JSON.stringify(r.body?.errors ?? r.body)}`); return 'error'; }
  return typeof r.body.value === 'object' ? 'ok(object)' : 'ok(string?!)';
}

// ---- 2. backfill owner_key on each store (idempotent setCustomField) ----
async function stampOwnerKey(storeKey, ownerKey) {
  const r = await ct('GET', `/stores/key=${storeKey}`);
  if (!r.ok) { errors.push(`store read ${storeKey}: ${r.status}`); return 'missing'; }
  const current = r.body.custom?.fields?.owner_key;
  if (current === ownerKey) return 'unchanged';
  const u = await ct('POST', `/stores/key=${storeKey}`, {
    version: r.body.version,
    actions: [{ action: 'setCustomField', name: 'owner_key', value: ownerKey }],
  });
  if (!u.ok) { errors.push(`store owner_key ${storeKey}: ${u.status} ${JSON.stringify(u.body?.errors ?? u.body)}`); return 'error'; }
  return current ? 'updated' : 'set';
}

async function main() {
  console.log(`Seeding retailer-owners into "${PROJECT}" via ${ENV.CTP_API_URL}\n`);
  await auth();

  for (const o of OWNERS) {
    const ownerStatus = await upsertOwner(o);
    const storeStatuses = [];
    for (const s of o.stores) storeStatuses.push(`${s}:${await stampOwnerKey(s, o.key)}`);
    console.log(`${o.key.padEnd(26)} owner:${ownerStatus.padEnd(12)} ${storeStatuses.join('  ')}`);
  }

  // ---- verify: read back one owner (proves object shape) + count stamped stores ----
  const check = await ct('GET', '/custom-objects/retailer-owners/nguyen-retail-group');
  const shape = typeof check.body?.value;
  const banners = new Set();
  if (shape === 'object') {
    for (const sk of check.body.value.stores) {
      const s = await ct('GET', `/stores/key=${sk}`);
      if (s.ok) banners.add(s.body.custom?.fields?.banner);
    }
  }
  console.log(`\nVerify: nguyen-retail-group value is a JS ${shape}; spans banners: [${[...banners].join(', ')}]`);

  if (errors.length) {
    console.log(`\n${errors.length} ERROR(S):`);
    for (const e of errors) console.log('  - ' + e);
    process.exitCode = 1;
  } else {
    console.log('\nNo errors. Owner seed complete.');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
