# Features

Code-derived inventory of what this repo implements. Bullets and key file paths —
the mechanism lives in `docs/how-it-works.md`, the walkthrough in `docs/demo-script.md`.

_Last generated: 2026-09-02 by feature-doc._

A commercetools **Merchant Center Custom Application** (App Kit v27, React 18,
`react-router-dom` v5, commercetools UI Kit, TypeScript — not Next.js) for the Metcash RFP
Section 6 (Opt-In Retailer Network Model) live demo. It runs inside Merchant Center on the
logged-in user's session (`@commercetools-frontend/sdk` through the MC proxy — no CT client
secret ships to the browser) and targets the **same commercetools project** as the sibling
`metcash-demo` storefront; the two communicate only through shared data (`programme-tiers` +
`retailer-owners` custom objects, `store-programme` custom fields on Store). Built from
scratch for this demo — it mirrors the shape of an internal reference scaffold
(`../business-mc-app/business-centre`) but is not a fork of a shared starter, so bullets below
carry no starter-provenance tags.

## Retailer network (owner-centric)

- Network list of every Store, **grouped by the franchisee owner** who runs it — one operator's
  cross-banner footprint (e.g. IGA + Bottle-O + Total Tools + Mitre 10) rendered as a single
  card instead of scattered rows (`src/views/NetworkList.tsx`, `src/hooks/useNetwork.ts`)
- Owner grouping resolves each store's `owner_key` against `retailer-owners` custom objects,
  preferring the owner's own `stores[]` list and falling back to the store-side back-reference,
  with an explicit "unassigned" bucket for stores with no owner (`src/hooks/useNetwork.ts`)
- Toggle between "by owner" (card grid) and "all stores" (sortable data table) views of the
  same filtered set (`src/views/NetworkList.tsx`, `src/components/StoresTable.tsx`)
- Live filtering by pillar, banner, programme tier, lifecycle state and free-text search across
  store name/key/suburb/postcode/owner name (`src/views/NetworkList.tsx`)
- Owner cards and groups are sorted multi-banner-owners-first so the cross-banner story surfaces
  without hunting (`src/views/NetworkList.tsx`)
- KPI band summarising franchisee count, store count, active/total ratio, banner count, and a
  programme-tier / lifecycle distribution mini-bar chart (`src/components/KpiBand.tsx`)
- Collapsible "unassigned stores" panel for dataset stores with no franchisee link, capped and
  overflow-counted so it doesn't dominate the page (`src/views/NetworkList.tsx`)

## Owner (franchisee) management

- Owner detail view: identity (trading name, ABN, primary contact), a multi-banner badge, and
  every store the owner runs across banners, each clickable through to its store detail
  (`src/views/OwnerView.tsx`)
- Inline create/edit of an owner's identity, writing the `retailer-owners` custom object
  (`src/views/OwnerView.tsx`, `upsertOwner` in `src/lib/ctWrites.ts`)
- "Onboard another store for this owner" carries the owner selection into the wizard via a
  query param so a repeat onboarding never re-asks who owns the store
  (`src/views/OwnerView.tsx` → `src/views/OnboardWizard.tsx`)

## Onboard wizard (provisioning, the centrepiece)

- Seven-step guided wizard — owner, pillar/banner, store identity & location, programme tier,
  catalogue/range, fulfilment & feed wiring, review — with per-step validation gating
  "Continue" (`src/views/OnboardWizard.tsx`)
- Store key auto-derived from banner + retailer name per the `{banner}-{slug}` convention, with
  live uniqueness checking and a manual override (`makeStoreKey` in `src/lib/conventions.ts`,
  `src/views/OnboardWizard.tsx`)
- Programme-tier picker reads live from the `programme-tiers` custom objects and shows exactly
  what the selected tier unlocks (never hardcoded) before committing, plus a pillar/tier
  compatibility check (`src/components/FeatureUnlocks.tsx`, `src/views/OnboardWizard.tsx`)
- New stores default to carrying the **full national range** for their pillar the first time the
  catalogue step is shown, with search/category filtering to trim it down or curate a smaller
  range (`src/components/CatalogEditor.tsx`, `fetchAllProductIds` in `src/lib/catalog.ts`)
- Auto-generated integration identifiers (`coveo_source_id`, `braze_segment_id`) and feed
  reference conventions (`feed://products/{key}`, pricing, inventory) per store, each editable
  before provisioning (`src/lib/conventions.ts`)
- Fulfilment configuration per store — rapid delivery (with radius) and Click & Collect (with
  timeslot capacity) — surfaced against the selected tier's capability so a merchandiser sees
  when a per-store flag is inert at the tier level (`src/views/OnboardWizard.tsx`)
- Full review step before commit, listing every field that will be written
  (`src/views/OnboardWizard.tsx`)
- **Idempotent provisioning orchestrator**: creates price/supply channels, an (empty or ranged)
  product selection, the Store as DRAFT with custom fields, links it to the owner, then
  activates it — each step reports live status (pending/running/done/error) so a retry after a
  partial failure never duplicates work (`provisionStore` + `PROVISION_STEPS` in
  `src/lib/ctWrites.ts`, animated by `src/components/ProvisionProgress.tsx`)
- Success screen confirms the store is live and links straight back to the network or into
  onboarding the next store for the same owner (`src/views/OnboardWizard.tsx`)
- Deliberately **provisions, never authors**: creates Store/channel/selection scope and wires
  feed references, but never creates products or prices — those are modelled as arriving from
  upstream pillar feeds (`src/lib/ctWrites.ts` module doc, `CLAUDE.md`)

## Store detail & lifecycle management

- Store detail page: banner, lifecycle stamp, owner link, fulfilment settings, programme tier,
  lifecycle actions, local/exclusive range, and full configuration read-out (feeds, integration
  IDs, owner key) (`src/views/StoreDetail.tsx`)
- **Tier upgrade/downgrade** on an existing store, previewing what the new tier would unlock
  before saving; capability changes propagate to the storefront reading `store-programme` with
  no rebuild (`updateTier` in `src/lib/ctWrites.ts`, `src/views/StoreDetail.tsx`)
- **Lifecycle transitions** (Activate / Suspend / Off-board / Reactivate) gated behind a
  confirmation dialog, with state-specific action sets and messaging (`lifecycleActions` in
  `src/views/StoreDetail.tsx`, `setLifecycle` in `src/lib/ctWrites.ts`)
- Fulfilment settings (rapid delivery + radius, Click & Collect + timeslot capacity) editable
  in place with dirty-state save gating (`src/views/StoreDetail.tsx`)
- Embedded product-assortment editor toggle ("Manage assortment") plus a dedicated full-page
  range route (`src/views/StoreCatalog.tsx`) for the same store
- **Local/exclusive range surfacing**: cross-references products tagged with a `local` category
  against the store's own product selection to show SKUs carried only by that store
  (`src/views/StoreDetail.tsx`)
- Non-destructive deprovision path for demo rehearsals — sets a store OFFBOARDED and unlinks it
  from its owner without deleting the Store/channels, so re-onboarding stays instant and
  idempotent (`deprovisionStore` in `src/lib/ctWrites.ts`)

## Catalogue / range curation (scale-aware)

- Store range = an **Individual-mode Product Selection**; ranging never authors products or
  prices, only chooses which existing ones a store carries (`src/lib/catalog.ts`)
- Server-side, paginated product search via the Product Projection Search API (category +
  product-type filters, free text) so a ~4k-product catalogue never loads into the browser at
  once (`searchProductsPage`, `searchPath` in `src/lib/catalog.ts`)
- Bulk actions: "carry full national range" and "add all products in category" against a
  pillar's product type, plus a one-click "clear range" (`src/components/CatalogEditor.tsx`)
- Toggle between "browse catalogue" and "in range" views with independent pagination
  (`src/components/CatalogEditor.tsx`)
- Range save is a **diffed, idempotent reconciliation** against the current selection —
  computes add/remove sets and batches selection actions rather than replacing wholesale
  (`setSelectionProducts` in `src/lib/catalog.ts`)
- Reusable range editor embedded both inside Store Detail and as its own route, backed by the
  same component (`src/components/StoreRangeEditor.tsx`, used by `StoreDetail.tsx` and
  `StoreCatalog.tsx`)

## Programme template management (HQ governance)

- HQ screen listing every programme tier (`STANDARD`, `DIGITAL_PLUS`, `TRADE_ENABLED`, `PILOT`)
  with the live count of stores currently on each (`src/views/TemplateManagement.tsx`)
- In-place editing of a tier's label, allowed pillars, and the eight-flag capability set
  (search, Click & Collect, rapid delivery, personalisation, loyalty earn/burn, B2B trade, job
  codes, accounting export) — a save here changes capabilities for every store on that tier with
  no rebuild, proving central/federated governance (`updateTierTemplate` in
  `src/lib/ctWrites.ts`, `src/views/TemplateManagement.tsx`)
- Edit access gated behind the app's `Manage` permission scope; view-only otherwise
  (`useIsAuthorized` + `PERMISSIONS.Manage` from `src/constants.ts`, in
  `src/views/TemplateManagement.tsx`)

## Loyalty & promotions console

- A loyalty-programme editor for the `loyalty-program` custom object that the storefront reads
  for tier ladders, points earn/burn and cashback — built here specifically because Merchant
  Center has no native UI for custom objects, and this app already holds the required
  `key_value_documents` scopes, avoiding a second Custom Application registration
  (`src/views/LoyaltyManagement.tsx`)
- Banner picker across multiple loyalty programmes once more than one exists
  (`fetchLoyaltyPrograms` in `src/lib/ctClient.ts`, `src/views/LoyaltyManagement.tsx`)
- Editable tier ladder (name, points threshold, comma-separated benefits) with add/remove rows,
  sorted by threshold on save (`src/components/loyalty/ProgrammeEditor.tsx`)
- Editable earn rate, redemption value, minimum redemption, tender-redemption toggle, and
  cashback percentage, each annotated with the exact storefront field name it maps to
  (`src/components/loyalty/ProgrammeEditor.tsx`)
- Live "worked example" panel that recomputes a $100-basket's points/cashback/effective member
  value as the merchandiser edits rates, before saving (`WorkedExample` in
  `src/components/loyalty/ProgrammeEditor.tsx`)
- Same `Manage`-permission gate as template management; view-only without it
  (`src/views/LoyaltyManagement.tsx`)

## Branding & presentation

- Per-banner colour/label metadata (IGA, Cellarbrations, Bottle-O, Total Tools, Mitre 10) driving
  chips, cards and KPI charts (`src/lib/banners.ts`)
- Banner logo component that renders an official artwork image when supplied (Cellarbrations
  today) and otherwise falls back to a branded colour wordmark tile, so new banners look
  finished with zero code changes once an asset is dropped in
  (`src/components/BannerLogo.tsx`)
- Distinct owner-initials avatar tiles and a "★ Multi-banner" badge wherever a franchisee's
  cross-banner footprint should be called out (`initials` in `src/lib/conventions.ts`,
  `src/components/OwnerCard.tsx`, `src/views/OwnerView.tsx`)

## commercetools integration surface

- **Stores** — create/read/update with `store-programme` custom type fields (tier, banner,
  lifecycle, feeds, integration IDs, location, owner key), all writes idempotent and
  version-safe (`src/lib/ctWrites.ts`)
- **Channels** — `{store}-price` (ProductDistribution) / `{store}-supply` (InventorySupply),
  created on demand and reused if already present (`ensureChannel` in `src/lib/ctWrites.ts`)
- **Product Selections** — one Individual-mode selection per store (`{store}-range`), diffed and
  reconciled rather than replaced (`src/lib/catalog.ts`)
- **Custom objects** — `programme-tiers` (read + template-managed edit), `retailer-owners`
  (full CRUD), `loyalty-program` (full CRUD) (`src/lib/ctClient.ts`, `src/lib/ctWrites.ts`)
- **Product Projection Search** — category/product-type-filtered, paginated catalogue browsing
  at scale (`src/lib/catalog.ts`)
- All CT access goes through one typed module pair (`src/lib/ctClient.ts` reads,
  `src/lib/ctWrites.ts` writes) built on the App Kit SDK / MC proxy using the logged-in user's
  session — screens never construct raw requests

## Demo tooling & seed scripts

- `scripts/seed-owners.mjs` — idempotent seed for the `retailer-owners` container plus
  backfilling `owner_key` on existing stores; deliberately seeds one owner
  (`nguyen-retail-group`) spanning three banners to make the multi-banner story demoable, and
  doubles as the rehearsal reset/re-seed path
- `scripts/seed-local-products.mjs` — seeds store-exclusive "local" SKUs (single-store product
  selection membership) to back the Local & Exclusive range panel in Store Detail
- `npm run seed:owners` script entry wired to the owner seed (`package.json`)

## Deployment

- Deployable as a commercetools Connect application (`connect.yaml`, `deployAs:
  merchant-center-custom-application`) with `CUSTOM_APPLICATION_ID`, `CLOUD_IDENTIFIER` and
  `ENTRY_POINT_URI_PATH` as standard configuration
- Also configured for direct static hosting on Netlify (`netlify.toml`) and Vercel
  (`vercel.json`), both rewriting all paths to `index.html` for the MC's client-side deep-linked
  routes (`/:projectKey/retailer-onboarding/...`)
- Production build config (`.env.production`) points at the shared `metcash-demo` CT project and
  the registered Merchant Center Custom Application ID; no secrets committed
