# IMPLEMENTATION.md — Retailer Onboarding MC App

How to build this app, ticket by ticket. Read `CLAUDE.md` first (contract + golden rules). Do **one ticket at a
time**: implement → verify (read the data back, or open the storefront) → commit. Use the
**commercetools-merchant-center** skill for scaffolding/UI-Kit/deploy and the **Knowledge MCP** for exact API
shapes — do not hardcode field structures from memory.

## Prerequisites
- Access to the **same commercetools project** as `metcash-demo` (do not create a new project).
- The demo data model already exists (created for the storefront): `store-programme` custom type,
  `programme-tiers` custom objects, existing stores/channels. Verify with the Commerce MCP before you start —
  `MTC-O1` only *adds* the two onboarding-specific pieces (`owner_key` field, `retailer-owners` container).
- Node ≥ 20. A Merchant Center account with permissions to register a Custom Application (or use dev mode).
- Working reference scaffold to mirror: `../business-mc-app/business-centre`.

## Sub-agent workflow (recommended)
This is a self-contained repo build. A good split:
- **Scaffold agent** (MTC-O2): stand up the App Kit shell + routing + config; verify `mc-scripts start` loads.
- **Data-layer agent** (MTC-O1, O3): custom-type field + container + all CT read/write SDK actions with a
  typed client module; verify every call against the Knowledge MCP and read back with Commerce MCP.
- **Screens agents** (MTC-O4…O8): one screen per agent, all depending on the data layer. Can run in parallel
  once O3 lands. Keep them to UI Kit components only.
Keep the data-layer module (`src/lib/ct/*`) as the single source of CT access; screens never build raw requests.

---

## MTC-O1 — Data model: owner grouping + owner_key (additive)
Extend the shared contract for owner-centric onboarding. **Additive only** — do not touch existing fields.
```
Using the Knowledge MCP for exact shapes, in the SAME ct project as metcash-demo:
1. Add field `owner_key` (String, optional) to the existing `store-programme` custom type on `store`.
2. Create custom-object container `retailer-owners`. Seed 2–3 owners; at least one MUST own stores across
   multiple banners (e.g. IGA + Bottle-O + Mitre 10) to demo multi-banner ownership. Value shape:
   { displayName, abn, primaryContact:{name,email,phone}, stores:[storeKey,…] }.
3. Backfill: set store-programme.owner_key on the EXISTING seeded stores to point at their owner, and make sure
   each owner object's stores[] matches. Keep both sides in sync.
Verify: read back the store-programme type shows owner_key; read retailer-owners; one owner lists stores from
≥2 different banners; the storefront still works (it ignores owner_key).
```
Spec: `docs/02-data-model.md` (onboarding addition 4) — snapshot; canonical in `../metcash-demo`.

## MTC-O2 — Scaffold the MC Custom Application
```
Scaffold an MC Custom App with the Application Kit (commercetools-merchant-center skill; mirror
../business-mc-app/business-centre — App Kit v27, React 18, react-router-dom v5, @commercetools-uikit/*).
- create-mc-app / app-kit starter template, TypeScript.
- custom-application-config.mjs: name "Retailer Onboarding"; entryPointUriPath; env for CLOUD_IDENTIFIER,
  CTP_PROJECT_KEY, CUSTOM_APPLICATION_ID, APPLICATION_URL; mainMenuLink + submenuLinks for the screens below.
- oAuthScopes (view + manage): stores, product_selections, key_value_documents (custom objects), and whatever
  Channels/Stores writes require — confirm exact scope names with the Knowledge MCP / skill.
Verify: `mc-scripts start` boots and the app loads in dev mode against the shared project.
```

## MTC-O3 — CT data-access layer (the SDK module)
```
Build src/lib/ct/* — typed read/write actions through the App Kit SDK (@commercetools-frontend/sdk) / MC proxy
using the LOGGED-IN USER'S session (no static secret). One module, screens import from it. Cover:
READ:  list stores (+ resolve store-programme fields), get store by key, list programme-tiers, list/get
       retailer-owners, list product selections & channels.
WRITE: create store (DRAFT) w/ custom type + fields, create price/supply channels, attach product selection,
       update store custom fields (tier, lifecycle_state, activation_date, feeds, owner_key), update/create
       retailer-owners object (add/remove store), update programme-tiers object (template mgmt).
All writes idempotent (upsert by key, version-based concurrency). Validate every request against the Knowledge
MCP. Verify with a scratch call + Commerce MCP read-back.
```

## MTC-O4 — Network list (grouped by owner)
```
Screen 1. Table/cards of all Stores, GROUPED BY OWNER (resolve owner_key → retailer-owners). Filters: pillar,
banner, programme_tier, lifecycle_state. Show each franchisee's cross-banner footprint at a glance. UI Kit only.
Row shows: store name, banner, tier (Stamp/Tag), lifecycle_state (Stamp), suburb. Link to store + owner views.
Verify: an owner with stores in ≥2 banners renders as one group spanning banners.
```

## MTC-O5 — Owner (franchisee) view
```
Screen 2. One owner's identity (displayName, ABN, contact) + all their stores across banners, with a
"Onboard another store for this owner" CTA into the wizard (owner pre-selected). Create/edit owner identity
(writes retailer-owners). Verify: editing an owner persists; CTA carries owner context into MTC-O6.
```

## MTC-O6 — Onboard wizard (the centrepiece)
```
Screen 3. Multi-step wizard. Steps:
1) OWNER: pick existing owner or create new.
2) pillar → banner (Food/IGA, Liquor=Bottle-O, Hardware=Total Tools|Mitre 10).
3) store identity: name, key {banner}-{slug} (validate uniqueness), location fields (address, suburb, state,
   postcode, geo, phone, opening_hours), opt_in_date.
4) programme-tier: pick tier; show WHAT IT UNLOCKS by reading the programme-tiers object (features list).
5) fulfilment: click&collect, rapid_delivery_enabled.
6) feeds: product_feed_ref / pricing_feed_ref / inventory_feed_ref (auto-suggest a convention).
7) auto-generate coveo_source_id + braze_segment_id.
8) REVIEW → PROVISION: create Store DRAFT → create {key}-price + {key}-supply channels → attach a Product
   Selection → set owner_key + add store to the owner object → ACTIVATE (lifecycle_state=ACTIVE,
   activation_date=now). Show progress per step; handle/rollback partial failures.
Verify (the money shot): run the wizard live, then open that store's storefront in metcash-demo — it resolves
its own range/price and exactly the tier's features (rapid delivery + personalisation on; B2B off for DIGITAL_PLUS).
```

## MTC-O7 — Upgrade / downgrade tier
```
Screen 4. On an existing store, change programme_tier (with the unlocks preview). Save updates the field only.
Verify: upgrade a Total Tools store STANDARD → TRADE_ENABLED, reload its storefront, B2B surface appears with
NO rebuild.
```

## MTC-O8 — Deactivate / off-board
```
Screen 5. Set lifecycle_state SUSPENDED / OFFBOARDED (and back to ACTIVE) on a store. Confirmation dialog.
Verify: deactivate a store → it disappears from the banner's store selector in the storefront while every other
store keeps running.
```

## MTC-O9 — (Optional) Template management
```
Screen 6. HQ views/edits the programme-tiers custom objects (the feature flags per tier). Editing a tier changes
capabilities for every store on it — prove central governance. Read-mostly; guard edits behind a manage scope.
Verify: toggle a feature on a tier, reload a store on that tier in the storefront, the capability changes.
```

---

## Deployment & MC registration (after the screens work in dev)
Use the commercetools-merchant-center skill for the current steps. Outline:
1. `mc-scripts build` → static bundle; host it (Netlify/Vercel/static — mirror `../business-mc-app`'s
   `netlify.toml`/`serve.json`).
2. Register the Custom Application in Merchant Center (Organizations → Custom Applications): entryPointUriPath,
   application URL, permissions, menu links — match `custom-application-config.mjs`.
3. Install it into the project; confirm the logged-in user's permissions cover the app's oAuthScopes.
4. Smoke test in MC against the shared project, then run the Session-3 script below.

## Definition of done (Session 3 demo, ~5 min)
1. Network list grouped by owner; pick a franchisee already running IGA + Bottle-O + Mitre 10.
2. Onboard a NEW Bottle-O store FOR THAT OWNER live (~2 min) → Activate.
3. Open its storefront immediately — own range/price + tier features live.
4. Upgrade a Total Tools store STANDARD → TRADE_ENABLED → B2B surface appears, no rebuild.
5. Deactivate a store → it drops from the storefront; everything else keeps running.
6. Land the line: "adding or changing a retailer is governed configuration, not a project — and one
   franchisee's whole multi-banner footprint is managed from one identity."

Maps to Section 6: 6.1 onboarding/off-boarding (wizard + lifecycle), 6.2 federated catalogue & pricing
(per-store selection + channel price wired at onboarding), 6.3 loyalty & identity (coveo_source_id /
braze_segment_id per store; owner = one identity across banners).
