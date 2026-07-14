> **SNAPSHOT** — copied from `metcash-demo/docs/` for convenience. The **canonical source of truth is
> the `metcash-demo` repo**; if they diverge, that repo wins. This is the shared contract, not app-local spec.

# 09 — Retailer Onboarding (Merchant Center Custom App)

Demonstrates **RFP Section 6 (Opt-In Retailer Network Model)** — the section that "carries significant weight."
Section 6 is the **Session 3** artifact (Retailer network model, 15 min), not one of the six shopper journeys.
Turning it from a talk-track into a **live onboarding demo** is a differentiator that targets a 5/Exceptional score.

## Separate repo, shared project
This is a **Merchant Center Custom Application** — its own repo, build, hosting and MC registration, deployed
independently of the storefront. It is **not** part of the storefront/BFF codebase.
- Repo: `metcash-onboarding-mc-app` (sibling to `metcash-demo`).
- Shares the **same commercetools Project** and, crucially, the **`programme-tiers` custom objects** as the
  contract between this app (writes/reads tier definitions + provisions stores) and the storefront (reads them).
- Built with the **commercetools Merchant Center Application Kit** (React). Runs inside Merchant Center, uses the
  logged-in MC user's session/token — so it operates with that user's project permissions and needs **no API
  client secret in the browser**. When building, let Claude Code + the Knowledge MCP confirm the current
  scaffolding (create-mc-app / app-kit templates), config (`custom-application-config.mjs`), route + permissions,
  and the MC registration steps.

## Golden rule: provision, don't author
Onboarding **provisions the Store scope + assigns a template + wires feed references + activates**. It does
**not** author products, range or prices — those come from the pillar APIs / upstream systems of record
(Metcash clarification Set 2). Building it this way proves we understand their operating model.

## Organising principle: owner-centric, not store-centric
Metcash's franchise model: **one franchisee often owns stores across several banners/pillars** — the same
operator can run an IGA, a Bottle-O, a Total Tools and a Mitre 10, all managed through this one tool. So the
app is organised around the **owner (franchisee)**, not the individual store. This is the single-project /
single-view-of-customer differentiator made literal: one operator, many banners, one governed identity.
- Owner = a `retailer-owners` custom object (displayName, ABN, contact, `stores[]`); each Store back-references
  its owner via `owner_key` on `store-programme` (doc 02, onboarding addition 4). **Not** a Business Unit —
  BUs are reserved for B2B trade-buying and must not be overloaded.
- The wizard onboards a store **under an owner** (pick existing / create new); the network list groups by owner
  so HQ sees "everything this operator runs across all four banners" at a glance.
- Pillars/banners the tool provisions across: **Food/IGA, Liquor (Bottle-O), Hardware (Total Tools + Mitre 10)**.
  The storefront currently skins 3 banners; the onboarding tool still offers IGA so the multi-banner owner story
  is demoable (an IGA store can be provisioned even though its skin ships later).

## Screens
1. **Network list** — all Stores; **group by owner**, filter by pillar / banner / programme_tier /
   lifecycle_state. Shows the federated network — and each franchisee's cross-banner footprint — at a glance.
2. **Owner (franchisee) view** — one operator's stores across all banners; entry point to "onboard another
   store for this owner". Create/edit owner identity (displayName, ABN, contact).
3. **Onboard a retailer (wizard)**
   - **owner step**: pick an existing owner or create one (proves multi-banner ownership)
   - pick pillar → banner
   - store identity: name, key (`{banner}-{slug}`), location, postcode
   - **assign programme-tier template** — UI shows what the template unlocks (read from `programme-tiers`)
   - fulfilment config: click&collect, `rapid_delivery_enabled`
   - **wire feed references**: `product_feed_ref` / `pricing_feed_ref` / `inventory_feed_ref`
   - auto-generate `coveo_source_id` + `braze_segment_id`
   - create Store as `DRAFT` → create price/supply channels → attach Product Selection → set `owner_key` +
     add store to the owner object → **Activate** (`lifecycle_state=ACTIVE`, `activation_date=now`)
4. **Upgrade / downgrade tier** — change `programme_tier` on an existing store; capabilities change with no
   rebuild (answers "retailers that grow can be upgraded without migration").
5. **Deactivate / off-board** — set `lifecycle_state` to `SUSPENDED` / `OFFBOARDED`; store drops out of the
   storefronts without disrupting others (answers 6.1 off-boarding).
6. **(Optional) Template management** — HQ views/edits the `programme-tiers` definitions (proves central governance).

## What it touches in commercetools
Stores (create/update + custom fields incl. `owner_key`), `programme-tiers` custom objects (read; edit in
template mgmt), `retailer-owners` custom objects (create/read/update — the owner registry), Channels (create
`{store}-price` / `{store}-supply`), Product Selection (attach), the feed-ref + lifecycle fields.

## Session 3 live demo script (~5 min)
1. Show the network list grouped by owner — pick a franchisee who already runs an IGA + a Bottle-O + a Mitre 10,
   to make the multi-banner ownership point up front.
2. Onboard a **new** Bottle-O store **for that same owner** live: wizard → owner step (pick existing) → assign
   `DIGITAL_PLUS` → wire feeds → Activate (~2 min). "Same operator, another banner, one tool."
3. Open that store's storefront immediately — it resolves its own range/price and the exact features the tier
   unlocks (rapid delivery + personalisation on; B2B off).
4. Upgrade a Total Tools store STANDARD → `TRADE_ENABLED` and show the B2B surface appear with no rebuild.
5. Deactivate a store and show it disappear from the storefront while everything else keeps running.
6. One line: "adding or changing a retailer is governed configuration, not a project — and one franchisee's
   whole multi-banner footprint is managed from one identity" — ties to 6.1's minimum-viable-setup /
   onboarding-time question and the reference-network analogues (SPAR, Ace, PLUS).

## Maps to Section 6
- **6.1 Onboarding & off-boarding** → the wizard + activate/deactivate/off-board flows; owner-centric onboarding
  shows one franchisee's multi-banner footprint managed from a single identity.
- **6.2 Federated catalogue & pricing** → per-store Product Selection + channel-scoped price wired at onboarding;
  range gaps handled by the storefront (the barcode/national-not-local fallback, Journey 5).
- **6.3 Loyalty & identity** → `braze_segment_id` / `coveo_source_id` set per store at onboarding; unified shopper
  identity is the single-project customer model (doc 01). Consent/opt-in flags flow to Segment.
