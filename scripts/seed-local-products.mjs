/**
 * seed-local-products.mjs — store-EXCLUSIVE local products (the "local craft beer" case).
 *
 * Models the national-vs-local range story: some SKUs are carried by only ONE store (a local
 * supplier's product). In commercetools this is simply a product ranged into a single store's
 * Product Selection — exclusivity is selection scope, no special data model needed.
 *
 * This script plays the role of the upstream FEED (it authors product data); the onboarding
 * MC app never creates products — it only ranges + marks them. Local products get a `local`
 * category so the app can badge/filter them as "Local / exclusive".
 *
 * For each local product it (idempotently):
 *   1. ensures the `local` category exists
 *   2. upserts + publishes the product (pillar product type, [pillar-subcat, local] categories)
 *   3. ensures a standalone price on the store's price channel (AUD)
 *   4. ensures inventory on the store's supply channel
 *   5. assigns it to ONLY that store's product selection ({store}-range)
 *
 * Run: `node scripts/seed-local-products.mjs`  (reads ../.env.local)
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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
      if ((res.status === 429 || res.status >= 500) && attempt < MAX) { await sleep(300 * 2 ** (attempt - 1)); return auth(attempt + 1); }
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
    if ((res.status === 429 || res.status >= 500) && attempt < MAX) { await sleep(250 * 2 ** (attempt - 1)); return ct(method, path, body, attempt + 1); }
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
const slugify = (s) => s.toLowerCase().replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---- local product definitions (each exclusive to ONE store) ----
const LOCAL_PRODUCTS = [
  {
    key: 'BO-BONDI-LOCAL-PALE', name: 'Bondi Local Pale Ale 375mL', store: 'bottle-o-bondi',
    productType: 'liquor', subCategory: 'liquor-beer', price: 1800, stock: 48, gtin: '9300000009001',
    attributes: [
      { name: 'format', value: 'can' }, { name: 'volume_ml', value: 375 }, { name: 'abv', value: 4.8 },
      { name: 'country', value: 'Australia' }, { name: 'varietal', value: 'Pale Ale' },
      { name: 'pack_size', value: 1 }, { name: 'age_restricted', value: true }, { name: 'gtin', value: '9300000009001' },
    ],
  },
  {
    key: 'BO-MANLY-SESSION-ALE', name: 'Manly Northside Session Ale 375mL', store: 'bottle-o-manly',
    productType: 'liquor', subCategory: 'liquor-beer', price: 1700, stock: 36, gtin: '9300000009002',
    attributes: [
      { name: 'format', value: 'can' }, { name: 'volume_ml', value: 375 }, { name: 'abv', value: 4.2 },
      { name: 'country', value: 'Australia' }, { name: 'varietal', value: 'Session Ale' },
      { name: 'pack_size', value: 1 }, { name: 'age_restricted', value: true }, { name: 'gtin', value: '9300000009002' },
    ],
  },
  {
    key: 'TT-PRESTON-FORGE-HAMMER', name: 'Preston Forge Claw Hammer (Local Maker)', store: 'total-tools-preston',
    productType: 'hardware', subCategory: 'hardware-hand-tools', price: 4500, stock: 20, gtin: '9300000009003',
    attributes: [
      { name: 'brand', value: 'Preston Forge' }, { name: 'model_number', value: 'PF-CLAW-16' },
      { name: 'trade_only', value: false }, { name: 'gtin', value: '9300000009003' },
    ],
  },
];

async function ensureLocalCategory() {
  const r = await ct('GET', '/categories/key=local');
  if (r.ok) return true;
  const c = await ct('POST', '/categories', {
    key: 'local',
    name: { 'en-AU': 'Local & Exclusive' },
    slug: { 'en-AU': 'local-exclusive' },
  });
  if (!c.ok) errors.push(`category local: ${c.status} ${JSON.stringify(c.body?.errors ?? c.body)}`);
  return c.ok;
}

async function upsertProduct(def) {
  const existing = await ct('GET', `/products/key=${def.key}`);
  if (existing.ok) return existing.body.id;
  const create = await ct('POST', '/products', {
    key: def.key,
    productType: { typeId: 'product-type', key: def.productType },
    name: { 'en-AU': def.name },
    slug: { 'en-AU': slugify(def.key) },
    priceMode: 'Standalone',
    categories: [
      { typeId: 'category', key: def.subCategory },
      { typeId: 'category', key: 'local' },
    ],
    masterVariant: { sku: def.key, key: def.key, attributes: def.attributes },
    publish: true,
  });
  if (!create.ok) { errors.push(`product ${def.key}: ${create.status} ${JSON.stringify(create.body?.errors ?? create.body)}`); return null; }
  return create.body.id;
}

async function ensurePrice(def) {
  const key = `${def.key}__${def.store}-price`;
  const existing = await ct('GET', `/standalone-prices/key=${encodeURIComponent(key)}`);
  if (existing.ok) return;
  const p = await ct('POST', '/standalone-prices', {
    key, sku: def.key,
    value: { type: 'centPrecision', currencyCode: 'AUD', centAmount: def.price },
    channel: { typeId: 'channel', key: `${def.store}-price` },
  });
  if (!p.ok) errors.push(`price ${key}: ${p.status} ${JSON.stringify(p.body?.errors ?? p.body)}`);
}

async function ensureInventory(def) {
  const chRes = await ct('GET', `/channels/key=${def.store}-supply`);
  const chId = chRes.ok ? chRes.body.id : undefined;
  if (!chId) { errors.push(`inventory: supply channel missing ${def.store}-supply`); return; }
  const where = encodeURIComponent(`sku="${def.key}"`);
  const list = await ct('GET', `/inventory?where=${where}&limit=50`);
  const exists = list.ok && (list.body.results ?? []).some((e) => e.supplyChannel?.id === chId);
  if (exists) return;
  const inv = await ct('POST', '/inventory', {
    sku: def.key, quantityOnStock: def.stock, supplyChannel: { typeId: 'channel', key: `${def.store}-supply` },
  });
  if (!inv.ok) errors.push(`inventory ${def.key}: ${inv.status} ${JSON.stringify(inv.body?.errors ?? inv.body)}`);
}

async function ensureRanged(def, productId) {
  const selKey = `${def.store}-range`;
  const sel = await ct('GET', `/product-selections/key=${selKey}`);
  if (!sel.ok) { errors.push(`selection missing ${selKey}`); return; }
  const cur = await ct('GET', `/product-selections/key=${selKey}/products?limit=500`);
  const already = cur.ok && (cur.body.results ?? []).some((a) => a.product?.id === productId);
  if (already) return;
  const add = await ct('POST', `/product-selections/key=${selKey}`, {
    version: sel.body.version,
    actions: [{ action: 'addProduct', product: { typeId: 'product', id: productId } }],
  });
  if (!add.ok) errors.push(`range ${def.key}->${selKey}: ${add.status} ${JSON.stringify(add.body?.errors ?? add.body)}`);
}

async function main() {
  console.log(`Seeding local/exclusive products into "${PROJECT}"\n`);
  await auth();
  await ensureLocalCategory();

  for (const def of LOCAL_PRODUCTS) {
    const id = await upsertProduct(def);
    if (!id) continue;
    await ensurePrice(def);
    await ensureInventory(def);
    await ensureRanged(def, id);
    console.log(`${def.key.padEnd(26)} → exclusive to ${def.store}`);
  }

  if (errors.length) {
    console.log(`\n${errors.length} ERROR(S):`);
    for (const e of errors) console.log('  - ' + e);
    process.exitCode = 1;
  } else {
    console.log('\nNo errors. Local products seeded.');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
