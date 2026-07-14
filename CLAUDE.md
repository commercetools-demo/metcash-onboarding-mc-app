# CLAUDE.md — Metcash Retailer Onboarding (Merchant Center Custom App)

Project memory for the **Retailer Onboarding** app — the sibling repo to `metcash-demo`.
Claude Code loads this file automatically. Keep it authoritative and concise.

## What this is
A **commercetools Merchant Center Custom Application** that makes the Metcash RFP **Section 6 (Opt-In Retailer
Network Model)** a *live demo* instead of a talk-track. Section 6 "carries significant weight" and is scored for
a 5/Exceptional. HQ uses this app to **onboard, tier, upgrade and off-board retailer Stores** across all Metcash
banners — governed configuration, not a migration project.

It **provisions**: it creates/activates Store scope, assigns a programme-tier template, wires feed references,
and creates channels + product selection. It does **NOT author products, range or prices** — those come from the
pillar APIs / upstream systems of record (Metcash clarification Set 2). Building it this way proves we understand
their operating model.

## Golden rules (do not violate)
1. **Same single commercetools Project as `metcash-demo`.** This is a separate *repo/build/deployment*, NOT a
   separate CT project. Banners/retailers are **Stores**, never separate projects.
2. **No API-client secret in the browser.** This is an MC Custom App: it runs inside Merchant Center and uses the
   **logged-in MC user's session/token** via the App Kit SDK/proxy. Never ship a CTP client secret. Never call
   the CT API directly with static credentials.
3. **Provision, don't author.** Create Store + channels + selection + tier + feeds + lifecycle. Do not create
   products or prices.
4. **The contract is the data model, not code.** This app and the storefront share the **same CT project** and
   communicate only through data: `programme-tiers` + `retailer-owners` custom objects and the `store-programme`
   custom fields. Never import storefront code; never assume storefront internals. Match field keys exactly.
5. **Owner-centric.** Metcash franchisees often own stores across *multiple* banners (IGA + Bottle-O + Total
   Tools + Mitre 10). The tool is organised around the **owner (franchisee)**, not the individual store. Model
   the owner as a `retailer-owners` custom object + `owner_key` on the store — **never** a Business Unit.

## Stack (from the commercetools-merchant-center skill — do not downgrade)
- **Merchant Center Application Kit** (`@commercetools-frontend/*` v27+), `mc-scripts`, **React 18**,
  **react-router-dom v5**, **commercetools UI Kit** (`@commercetools-uikit/*`), TypeScript.
- This is **NOT Next.js** and **NOT Tailwind**. Do not bring storefront conventions here.
- Data access via the App Kit **SDK actions** (`@commercetools-frontend/sdk`) / Apollo through the MC proxy —
  the logged-in user's token, scoped by `oAuthScopes` in `custom-application-config.mjs`.
- Reference scaffold that works today: `../business-mc-app/business-centre` (App Kit v27, same shape).

## The shared contract (must match the storefront exactly)
The storefront (`metcash-demo/site`) reads these; this app writes them. Keys are literal.

- **`programme-tiers`** custom-object container — one object per tier (`STANDARD`, `DIGITAL_PLUS`,
  `TRADE_ENABLED`, `PILOT`). Value: `{ label, allowedPillars[], features:{ search, clickCollect, rapidDelivery,
  personalisation, loyaltyEarnBurn, b2bTrade, jobCodes, accountingExport } }`. This app **reads** them (to show
  "what this template unlocks") and, in Template Management, **edits** them.
- **`retailer-owners`** custom-object container — one object per franchisee. Value: `{ displayName, abn,
  primaryContact:{name,email,phone}, stores:[storeKey,…] }`. This app owns the full CRUD.
- **`store-programme`** custom type on `store` (fields, snake_case keys):
  `programme_tier`, `banner`, `opt_in_date`, `coveo_source_id`, `braze_segment_id`, `rapid_delivery_enabled`,
  `lifecycle_state` (`DRAFT`/`ACTIVE`/`SUSPENDED`/`OFFBOARDED`), `activation_date`,
  `product_feed_ref`/`pricing_feed_ref`/`inventory_feed_ref`, `owner_key`, and location fields
  (`street_address`, `suburb`, `state`, `postcode`, `latitude`, `longitude`, `phone`, `opening_hours`).
- **Channels**: `{store-key}-price` (role `ProductDistribution`) + `{store-key}-supply` (role `InventorySupply`).
- **Storefront gate**: it serves only `lifecycle_state === 'ACTIVE'` stores → onboard/activate/deactivate is
  immediately visible in the storefront. That live round-trip IS the demo.

Spec (snapshots in `docs/`): `docs/02-data-model.md` (esp. "Opt-in onboarding additions") and
`docs/09-onboarding-app.md`. These are **copies** — the canonical source is the `metcash-demo` repo
(`../metcash-demo/docs/`). If they disagree, `metcash-demo` wins; re-sync the snapshot and update this file.

## Conventions
- Store keys: `{banner}-{retailer-slug}` (e.g. `bottle-o-bondi`, `total-tools-preston`, `mitre10-hawthorn`,
  `iga-neutral-bay`). Channel keys: `{store-key}-price` / `{store-key}-supply`. Owner keys: kebab-case slug.
- Currency AUD, country AU, locale en-AU. Banners/pillars: Food/IGA, Liquor, Hardware (Total Tools + Mitre 10).
- Idempotent writes: upsert by key, use version-based optimistic concurrency; re-running onboarding must not
  duplicate stores/channels/owners.
- Never hardcode tier capabilities — always resolve from `programme-tiers`.

## Tooling
- **commercetools-merchant-center skill** → scaffolding, App Kit config, UI Kit, permissions, MC registration &
  deployment. Use it for every step here.
- **commercetools-platform skill** + **Knowledge MCP** → exact current API shapes for Stores / Channels /
  Product Selections / Custom Objects. Trust the MCP over training data.
- **Commerce MCP** (dev project only) → verify writes landed (read back store, custom objects). Never commit secrets.

## Build order
See `IMPLEMENTATION.md` — ticket-sized tasks `MTC-O1…O9`, sequenced, one at a time, verify + commit each.
Start there for "what next".

## Repositories (two, one commercetools Project)
- **`metcash-demo`** (sibling) — storefront + BFF + catalog seed + mobile app. Consumer of this app's data.
- **`metcash-onboarding-mc-app`** (this repo) — the MC Custom App. Deployed separately, registered in Merchant
  Center, targets the **same** CT project. The `programme-tiers` + `retailer-owners` custom objects and
  `store-programme` fields are the contract between the two.
