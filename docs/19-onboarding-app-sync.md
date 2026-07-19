# 19 — Onboarding MC App: sync with RFP v2 changes

Handover for the **`metcash-onboarding-mc-app`** repo / Claude project so it picks up the recent
storefront (RFP v2) work. **Both apps share ONE commercetools project (`metcash-demo`)** — so all data
below is already live and visible to the onboarding app; there is **nothing to copy or import**. What
follows is the *context* (what's now in the project) + a few **branding action items** (the Bottle-O logo).

## 1. Data now in the shared project (imported for the storefront/RFP demo)
The Metcash **shared dataset** (commercial-in-confidence) was transformed + seeded into the project:

| Pack / banner | Products | Categories | Stores | Prices | Inventory | Customers | Other |
|---|---|---|---|---|---|---|---|
| **Cellarbrations** (liquor, B2C) | 795 | 59 | 20 (`cb-store-####`) | 1,095 | 10,000 | 10 shoppers | 22 offers, 14 promos, loyalty, 60 orders |
| **Total Tools** (hardware, trade) | 2,998 | 30 | 20 (`store-####`) | 2,000 | 10,001 | 6 trade members | 3 business units, 15 promos, 57 trade prices, 14 trade orders |

New **custom-object containers** now present (the onboarding app can ignore these — listed so it doesn't
collide): `promotions`, `offers`, `loyalty`, `loyalty-program`, `rapid-eligibility`, `accounting-exports`,
`substitution-prefs`, `job-codes`, `trade-credit`.
New **types/roles**: `liquor` + `hardware` product types extended (additive); `shopper-loyalty` customer
type; `view-only` associate role; `trade` customer group (existing).

## 2. The network now (what the onboarding "Network list" will show)
**47 stores** total — **45 ACTIVE**, 2 SUSPENDED:

| banner enum | count | notes |
|---|---|---|
| `CELLARBRATIONS` | 20 | dataset liquor stores (`cb-store-*`) — **the new liquor banner** |
| `TOTAL_TOOLS` | 20 ACTIVE (+2 SUSPENDED) | dataset hardware stores (`store-*`); `total-tools-preston`/`-richmond` (legacy) parked |
| `BOTTLE_O` | 3 ACTIVE | **legacy** scraped stores — the onboarding app's own owner/network demo data |
| `MITRE10` | 2 ACTIVE | **legacy** scraped stores — onboarding demo data |

**`store-programme` field list (current):** `programme_tier, banner, opt_in_date, coveo_source_id,
braze_segment_id, rapid_delivery_enabled, lifecycle_state, activation_date, product_feed_ref,
pricing_feed_ref, inventory_feed_ref, street_address, suburb, state, postcode, latitude, longitude,
phone, opening_hours, owner_key, rapid_delivery_radius_km, click_collect_enabled, timeslot_capacity`.
→ **New fields to add to the onboarding wizard's fulfilment step:** `rapid_delivery_radius_km`,
`click_collect_enabled`, `timeslot_capacity`.

**`banner` enum values (current):** `IGA · CELLARBRATIONS · BOTTLE_O · TOTAL_TOOLS · MITRE10`.
**`programme-tiers`:** `STANDARD · DIGITAL_PLUS · TRADE_ENABLED · PILOT` (governance contract — unchanged).
**`retailer-owners`:** 3 owners already present (onboarding app's own) — built on the **legacy** stores,
incl. the cross-banner franchisee `nguyen-retail-group` (bottle-o-bondi + total-tools-richmond +
mitre10-brunswick). Do **not** park/offboard the legacy stores — that breaks this owner demo.

## 3. New banner + the Bottle-O logo (action needed in the onboarding app)
The storefront's **liquor banner is now Cellarbrations** (rebranded from The Bottle-O). The onboarding app
still shows the **Bottle-O logo** because (a) 3 legacy `BOTTLE_O` stores are still ACTIVE, and (b) the
onboarding app's banner→logo/label mapping still points at Bottle-O for liquor.

**Recommended fix (branding only — no data change):**
1. In the onboarding app's banner config/asset map, **add `CELLARBRATIONS`** as the liquor banner with the
   Cellarbrations logo. Asset provided: `docs/assets/cellarbrations-logo.png` (copied into this repo; source
   `metcash-demo/site/public/banners/cellarbrations/logo.png`). Brand = **black + gold/amber (#F5A800) + white**.
2. Keep the 3 legacy `BOTTLE_O` stores as **legacy** (they back the owner demo). Either relabel them as
   Cellarbrations in the UI, **or** — nicer Section-6 narrative — use them to demo **off-boarding Bottle-O +
   onboarding Cellarbrations** (lifecycle: SUSPENDED/OFFBOARDED → new CELLARBRATIONS store ACTIVE).

⚠️ **Do NOT** change the legacy stores' `banner` to `CELLARBRATIONS` in the data — the storefront's
Cellarbrations store selector lists `banner=CELLARBRATIONS + ACTIVE`, so those 3 scraped stores (no dataset
range/pricing) would pollute the storefront. Keep the storefront (dataset stores) and onboarding (legacy +
owners) demos on their own store sets.

## 4. Action items for the onboarding app
- [ ] Add **Cellarbrations** banner branding + logo (fixes the Bottle-O logo).
- [ ] Add the 3 new fulfilment fields (`rapid_delivery_radius_km`, `click_collect_enabled`, `timeslot_capacity`)
      to the onboard/edit wizard.
- [ ] (Optional) Assign `owner_key` to some dataset stores if you want them grouped under owners in the network view.
- [ ] Re-read the refreshed snapshots `docs/02-data-model.md` + `docs/09-onboarding-app.md` (this repo) and
      `metcash-demo/docs/16` (RFP v2) + `docs/18` (implementation summary) for full context.

## 5. Connection + confidentiality
- Same commercetools project (`metcash-demo`, `australia-southeast1`) — the onboarding `.mcp.json` already
  targets it. No credential change.
- The project now holds the **commercial-in-confidence** Metcash dataset. Do **not** commit or export CT data
  from the onboarding repo; keep any data dumps gitignored.
