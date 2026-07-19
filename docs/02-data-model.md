> **SNAPSHOT** — copied from `metcash-demo/docs/`. Canonical source is the `metcash-demo` repo. Re-synced with RFP v2 changes; see `docs/19-onboarding-app-sync.md`.

# 02 — commercetools Data Model

Implement with the **commercetools-platform skill** + **Commerce MCP** (create + verify directly). Use the
**Knowledge MCP** for exact current API shapes — do not hardcode field structures from memory. This doc is the
*spec* (the what); the skill/MCP give the *how* (current API).

## Product Types
Create one product type per pillar. Keep attributes nullable so immature/partial scraped data still imports.

### `liquor`
- `varietal` (enum/text), `region` (text), `country` (text), `vintage` (number, nullable)
- `abv` (number), `volume_ml` (number), `format` (enum: bottle/can/cask), `pack_size` (number)
- `age_restricted` (boolean, default true)
- variant-level: size/format variants
- common: `gtin` (text) ← needed for barcode scan

### `hardware`
- `brand` (enum/text), `model_number` (text)
- `spec` (set of text or nested type: key/value specs)
- `trade_only` (boolean)
- timber/variant example: `grade`, `species`, `length_mm` as variant attributes (proves variation w/o schema change)
- common: `gtin` (text)

### `grocery` (only if a Food skin is added)
- `unit_of_measure` (enum), `pack_size` (number), `price_per_unit_basis` (text)
- `dietary_tags` (set of enum: vegan/gluten-free/…)
- common: `gtin` (text)

## Stores (one per banner-retailer)
Keys: `bottle-o-neutral-bay`, `total-tools-preston`, `mitre10-hawthorn`.
Attach a custom type `store-programme` (see Custom Types). Set `distributionChannels` + `supplyChannels` +
`productSelections` per store.

## Channels
Per store, create two channels:
- `{store-key}-price` — roles: `ProductDistribution` (price scoping)
- `{store-key}-supply` — roles: `InventorySupply` (availability scoping)

## Product Selections
One per store (e.g. `bottle-o-neutral-bay-range`). Assign the SKUs that retailer carries → retailer-level ranging.
Include one SKU that is national-but-not-in-this-store's-range to demo the barcode fallback (Journey 5).

## Prices (use Standalone Prices)
- Currency AUD, country AU.
- Scope by `channel` (per-store price channel) for retailer pricing; by `customerGroup = trade` for trade pricing.
- Model a retail price and a trade price on hardware SKUs so Journey 6 shows trade pricing.

## Customer Groups
- `trade` (drives B2B trade pricing). Optionally `trade-gold` for a tier offer in Journey 4.

## Business Units (B2B, for Total Tools trade)
- Company (parent trade account) `tt-acme-builders` + Division (sub-account) `tt-acme-builders-sitecrew`.
- Associate Roles (create in Merchant Center; the storefront skill relies on these keys):
  `admin`, `buyer`, `approver`, `finance`, `view-only` (+ optional `superuser`).
- Assign a principal account holder (admin) and a team member (buyer) as associates.

## Custom Types
- `store-programme` (on `store`): `programme_tier` (enum), `banner` (enum), `opt_in_date` (date),
  `coveo_source_id` (string), `braze_segment_id` (string), `rapid_delivery_enabled` (boolean).
- `trade-order` (on `order` and `cart`): `po_number` (string), `job_code` (string), `fulfilment_method`
  (enum: delivery/click-collect/rapid), `collection_store` (string), `collection_slot` (datetime).
- `trade-line-item` (on `line-item`, optional): `job_code` (string) for per-line job allocation.

## Custom Objects (mock service state)
- container `job-codes` — active job codes per business unit.
- container `trade-credit` — trade credit balance/status per business unit.
- container `collect-slots` — click-&-collect slot capacity per store.
- container `loyalty` — mocked loyalty balance + tier per customer (loyalty engine is out of scope; mock it).

## Opt-in onboarding additions (Section 6) — additive, no structural change
These three additions make the opt-in retailer model *demonstrable* (Section 6 + the onboarding MC app, doc 09).
They extend the existing `store-programme` type and add one custom-object container; nothing else changes.

1. **Programme-tier template *definitions* (custom objects).** Container `programme-tiers`, one object per tier
   (`STANDARD`, `DIGITAL_PLUS`, `TRADE_ENABLED`, `PILOT`). Value = JSON, e.g.:
   ```json
   { "label": "Digital Plus",
     "allowedPillars": ["food","liquor","hardware"],
     "features": { "search": true, "clickCollect": true, "rapidDelivery": true,
                   "personalisation": true, "loyaltyEarnBurn": true,
                   "b2bTrade": false, "jobCodes": false, "accountingExport": false } }
   ```
   The BFF + frontend resolve a store's capabilities by reading its `programme_tier` → looking up this object
   (so features are HQ-governed centrally, not hardcoded). The onboarding app reads these to show "what this
   template unlocks" and (in template-management) lets HQ edit them. This is the governance layer.

2. **Store lifecycle field** on `store-programme`: `lifecycle_state` (enum: `DRAFT` / `ACTIVE` / `SUSPENDED` /
   `OFFBOARDED`) + `activation_date` (date). Enables the live onboard → activate → deactivate → off-board flow
   and realises "inactive Stores present in the model but not yet live." Storefront only serves `ACTIVE` stores.

3. **Feed-reference fields** on `store-programme`: `product_feed_ref`, `pricing_feed_ref`, `inventory_feed_ref`
   (strings). Onboarding *wires feeds*, it does not author products/prices (per Metcash clarification Set 2).

4. **Franchisee-owner grouping (multi-banner ownership).** In the Metcash model one franchisee often owns
   stores across *several* banners/pillars (e.g. an IGA **and** a Bottle-O **and** a Total Tools **and** a
   Mitre 10). Model the owner as governance data, not as a Business Unit (BUs are reserved for B2B trade-buying,
   §Business Units above — do not overload them):
   - Container `retailer-owners`, one custom object per owner. Value = JSON, e.g.:
     ```json
     { "displayName": "Nguyen Retail Group",
       "abn": "12 345 678 901",
       "primaryContact": { "name": "An Nguyen", "email": "an@nrg.au", "phone": "+61 …" },
       "stores": ["iga-bondi", "bottle-o-bondi", "mitre10-brunswick"] }
     ```
   - Field `owner_key` (string) on `store-programme` — a back-reference to the owning `retailer-owners` object,
     so the network list can group/filter by owner with no second lookup. The onboarding app keeps both sides in
     sync (adds the store key to the owner object AND stamps `owner_key` on the store).
   - This is what makes the tool **owner-centric**: one franchisee, many banners, one governed identity — the
     single-project / single-view-of-customer differentiator made literal for Section 6. The storefront does not
     need `owner_key`; it is for the onboarding/network-management surface (doc 09).

## API Clients (for Commerce MCP + BFF + seeding)
Create scoped API clients in Merchant Center:
- `mcp-dev` — broad manage scopes for the agent to build/verify (dev only).
- `bff` — runtime scopes the storefront needs (products, carts, orders, me, stores…).
- `import` — for the seed pipeline (products, prices, inventory import).
Store secrets in `.env.local` (never commit). See doc 05 for env var names.
