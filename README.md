# Metcash Retailer Onboarding — Merchant Center Custom App

The **Section 6 (Opt-In Retailer Network Model)** live demo for the Metcash RFP. A commercetools **Merchant
Center Custom Application** that lets HQ **onboard, tier, upgrade and off-board** retailer Stores across all
Metcash banners — governed configuration, not a migration project. It **provisions** (Store + channels +
product selection + tier + feeds + lifecycle); it does **not** author products or prices.

Organised **owner-centric**: one franchisee often runs stores across several banners (IGA + Bottle-O + Total
Tools + Mitre 10), all managed from one identity — the single-project / single-view-of-customer differentiator.

- **Same commercetools project** as the `metcash-demo` storefront (sibling repo). Separate repo/build/deploy.
- Runs inside Merchant Center on the **logged-in user's session** — no API-client secret in the browser.
- Stack: MC Application Kit (`@commercetools-frontend/*` v27), `mc-scripts`, React 18, react-router-dom v5,
  commercetools UI Kit, TypeScript. **Not** Next.js.

## Start here
1. `CLAUDE.md` — project memory: golden rules + the shared data contract (read first).
2. `IMPLEMENTATION.md` — the build runbook, tickets `MTC-O1…O9`. One ticket at a time; verify + commit each.
3. `docs/` — snapshots of the shared spec (canonical lives in `../metcash-demo/docs/`).

## Run (once scaffolded — see MTC-O2)
```bash
npm install
npm start          # mc-scripts start — dev against the shared project
npm run build      # mc-scripts build — static bundle for MC registration
```

## Working with Claude Code
```bash
claude
# approve the Commerce MCP (.mcp.json → same metcash-demo project) on first launch,
# then: "Read IMPLEMENTATION.md and start MTC-O1."
```
Reference scaffold to mirror: `../business-mc-app/business-centre` (App Kit v27, same shape).
